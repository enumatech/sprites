// ----------------------------------------------------------------------------
// reader.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {curry, assoc, assocPath, last, isNil, identity} = require('ramda')
const {threadP} = require('sprites/lib/fp.js')
const assert = require('assert')
const {inspect} = require('util')
const Web3Eth = require('web3-eth')
const low = require('lowdb')
const LowMem = require('lowdb/adapters/Memory')
const Sprites = require('sprites')
const ChannelState = require('sprites/lib/channel-state.js')

const Reader = {
    make(opts={}) {
        return {
            db: low(new LowMem()),
            sprites: Sprites.make(),
            ...opts
        }
    },

    /**
     * Initialize the sprites client based on the configuration
     * returned by Paywall.config()
     * */
    withPaywall: curry(async (config, rdr) => {
        const {publisher, preimageManager, reg, token} = config
        const {sprites} = rdr
        const readerWithPaywall = {
            ...rdr,
            publisher,
            sprites: Sprites.withWeb3Contracts({
                ...sprites, preimageManager, reg, token
            })
        }
        const chId = last(await sprites.offChainReg.with(publisher))

        const maybeWithChannel = isNil(chId) ? identity : Reader.channel(chId)
        return maybeWithChannel(readerWithPaywall)
    }),

    /**
     * Checks if the configuration contains addresses for
     * all the required contracts and those addresses contain
     * some bytecode, otherwise calls to such contracts might
     * just silently succeed.
     * */
    validatePaywall: curry(async (publisherConfig, rdr) => {
        const {web3Provider} = rdr.sprites
        const eth = new Web3Eth(web3Provider)

        const hasCode = async (contractName) => {
            if (!(contractName in publisherConfig))
                throw new Error(
                    `No address for the "${contractName}" contract in config:\n` +
                    inspect(publisherConfig))

            const addr = publisherConfig[contractName]
            if (await eth.getCode(addr) === '0x')
                throw new Error(
                    `No code found for contract "${contractName}"` +
                    ` at address ${addr}`)
        }
        return Promise.all(['reg', 'preimageManager', 'token'].map(hasCode))
    }),

    /**
     * Retrieve the receipts for the already bought articles
     */
    library: async (rdr) =>
        rdr.db.value(),

    saveReceipt: curry(async (receipt, rdr) => {
        await rdr.db.set(receipt.articleId, receipt).write()
        return rdr
    }),

    /**
     * Approve the Sprites channel registry to deposit tokens up to
     * the specified `amount` into an open payment channel with
     * any number of publishers.
     *
     * Requires a signature.
     * */
    approve: curry(async (amount, rdr) => {
        const {sprites} = rdr
        return {
            ...rdr,
            sprites: await Sprites.approve(amount, sprites)
        }
    }),

    /**
     * Stake some tokens with a publisher by opening a payment
     * channel and depositing `amount` tokens into it.
     *
     * Requires a signature.
     * */
    firstDeposit: curry(async (amount, rdr) => {
        const {publisher, sprites} = rdr
        return {
            ...rdr,
            sprites: await threadP(sprites,
                Sprites.createWithDeposit(publisher, amount),
                Sprites.channelState,
                Sprites.save)
        }
    }),

    /**
     * Order an article.
     *
     * Paywall should return a signed `{invoice}` in exchange.
     * */
    order: curry((articleId, rdr) => {
        const {sprites: {chId}} = rdr
        return {
            ...rdr,
            order: {
                articleId, chId
            }
        }
    }),

    /**
     * Pay for an article invoice by signing it.
     *
     * Returns a `{payment}` suitable for `Paywall.processPayment`.
     * */
    pay: curry(async (invoice, rdr) => {
        const {xforms, chId, round, sigs} = invoice
        const [_buyerSig, sellerSig] = sigs

        assert(sellerSig,
            `Invoice should have a signature:\n` + inspect(invoice))

        const sprite = await threadP(rdr.sprites,
            assoc('chId', chId),
            Sprites.channelState,
            Sprites.transition(xforms),
            assocPath(['channel', 'sigs'], sigs))

        assert(sprite.channel.round === round,
            `Invoice round doesn't match latest channel state:\n` +
            inspect(invoice) + '\n' +
            inspect(sprite.channel))

        assert(ChannelState.checkAvailSigs(sprite.channel),
            `Invalid signatures:\n`
            + inspect(invoice) + '\n' +
            inspect(sprite.channel))

        const signedSprite = await Sprites.sign(sprite)
        const payment = {...invoice, sigs: signedSprite.channel.sigs}
        return {...rdr, sprites: signedSprite, payment}
    }),

    channel: curry(async (chId, rdr) => {
        const sprites = await Sprites.channelState({...rdr.sprites, chId})
        return {...rdr, sprites}
    }),

    processReceipt: curry(async (paymentReceipt, rdr) => {
        const {xforms, chId, round, sigs} = paymentReceipt.payment
        const [buyerSig, sellerSig] = sigs

        assert(sellerSig,
            `Receipt should have a seller signature:\n`
            + inspect(paymentReceipt))

        assert(buyerSig,
            `Receipt should have a buyer signature:\n`
            + inspect(paymentReceipt))

        const sprites = await threadP(rdr.sprites,
            assoc('chId', chId),
            Sprites.channelState,
            Sprites.transition(xforms),
            assocPath(['channel', 'sigs'], sigs))

        assert(sprites.channel.round === round,
            `Receipt round doesn't match latest channel state:\n` +
            inspect(paymentReceipt) + '\n' +
            inspect(sprites.channel))

        assert(ChannelState.checkAvailSigs(sprites.channel),
            `Invalid signatures:\n`
            + inspect(paymentReceipt) + '\n' +
            inspect(sprites.channel))

        await Sprites.save(sprites)
        const {payment, ...receipt} = paymentReceipt
        await Reader.saveReceipt(receipt, rdr)
        return {...rdr, sprites, receipt}
    }),

    requestWithdraw: curry(async (rdr) => {
        const sprites0 = await Sprites.channelState(rdr.sprites)
        const ownIdx = Sprites.ownIdx(sprites0)
        const balance = ChannelState.balance(ownIdx, sprites0.channel)
        const xforms = [['withdraw', ownIdx, balance]]
        const sprites = await threadP(
            sprites0,
            Sprites.transition(xforms),
            Sprites.sign)
        const {chId, channel: {round, sigs}} = sprites
        const withdrawalRequest = {chId, xforms, round, sigs}
        return {...rdr, sprites, withdrawalRequest}
    })
}

module.exports = Reader
