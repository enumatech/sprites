// ----------------------------------------------------------------------------
//
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {curry, map, assoc, assocPath, last, isNil, identity} = require('ramda')
const {thread, threadP} = require('./fp.js')
const assert = require('assert')
const {inspect} = require('util')
const Web3Eth = require('web3-eth')
const low = require('lowdb')
const LowMem = require('lowdb/adapters/Memory')
const Sprites = require('./sprites.js')
const SC = require('./sc.js')

const PaywallClient = {
    new() {
        return {
            db: low(new LowMem()),
            sprites: Sprites.new()
        }
    },

    /**
     * Initialize the sprites client based on the configuration
     * returned by Paywall.config()
     * */
    withPaywall: curry(async (config, pwc) => {
        const {publisher, preimageManager, reg, token} = config
        const {sprites} = pwc
        const pwcWithPaywall = {
            ...pwc,
            publisher,
            sprites: Sprites.withWeb3Contracts({
                ...sprites, preimageManager, reg, token
            })
        }
        const chId = last(await sprites.offChainReg.with(publisher))

        const maybeWithChannel = isNil(chId) ? identity : PaywallClient.channel(chId)
        return maybeWithChannel(pwcWithPaywall)
    }),

    /**
     * Checks if the configuration contains addresses for
     * all the required contracts and those addresses contain
     * some bytecode, otherwise calls to such contracts might
     * just silently succeed.
     * */
    validatePaywall: curry(async (paywallConfig, pwc) => {
        const {web3Provider} = pwc.sprites
        const eth = new Web3Eth(web3Provider)

        const hasCode = async (contractName) => {
            if (!(contractName in paywallConfig))
                throw new Error(
                    `No address for the "${contractName}" contract in config:\n` +
                    inspect(paywallConfig))

            const addr = paywallConfig[contractName]
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
    library: async (pwc) =>
        pwc.db.value(),

    saveReceipt: curry(async (receipt, pwc) => {
        await pwc.db.set(receipt.articleId, receipt).write()
        return pwc
    }),

    /**
     * Approve the Sprites channel registry to deposit tokens up to
     * the specified `amount` into an open payment channel with
     * any number of publishers.
     *
     * Requires a signature.
     * */
    approve: curry(async (amount, pwc) => {
        const {sprites} = pwc
        return {
            ...pwc,
            sprites: await Sprites.approve(amount, sprites)
        }
    }),

    /**
     * Stake some tokens with a publisher by opening a payment
     * channel and depositing `amount` tokens into it.
     *
     * Requires a signature.
     * */
    firstDeposit: curry(async (amount, pwc) => {
        const {publisher, sprites} = pwc
        return {
            ...pwc,
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
    order: curry((articleId, pwc) => {
        const {sprites: {chId}} = pwc
        return {
            ...pwc,
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
    pay: curry(async (invoice, pwc) => {
        const {cmd, chId, round, sigs} = invoice
        const [_buyerSig, sellerSig] = sigs

        assert(sellerSig,
            `Invoice should have a signature:\n` + inspect(invoice))

        const sprite = await threadP(pwc.sprites,
            assoc('chId', chId),
            Sprites.channelState,
            assoc('cmd', cmd),
            Sprites.cmd.apply,
            assocPath(['channel', 'sigs'], sigs))

        assert(sprite.channel.round === round,
            `Invoice round doesn't match latest channel state:\n` +
            inspect(invoice) + '\n' +
            inspect(sprite.channel))

        assert(SC.checkAvailSigs(sprite.channel),
            `Invalid signatures:\n`
            + inspect(invoice) + '\n' +
            inspect(sprite.channel))

        const signedSprite = await Sprites.sign(sprite)
        const payment = {...invoice, sigs: signedSprite.channel.sigs}
        return {...pwc, sprites: signedSprite, payment}
    }),

    channel: curry(async (chId, pwc) => {
        const sprites = await Sprites.channelState({...pwc.sprites, chId})
        return {...pwc, sprites}
    }),

    processReceipt: curry(async (paymentReceipt, pwc) => {
        const {cmd, chId, round, sigs} = paymentReceipt.payment
        const [buyerSig, sellerSig] = sigs

        assert(sellerSig,
            `Receipt should have a seller signature:\n`
            + inspect(paymentReceipt))

        assert(buyerSig,
            `Receipt should have a buyer signature:\n`
            + inspect(paymentReceipt))

        const sprites = await threadP(pwc.sprites,
            assoc('chId', chId),
            Sprites.channelState,
            assoc('cmd', cmd),
            Sprites.cmd.apply,
            assocPath(['channel', 'sigs'], sigs))

        assert(sprites.channel.round === round,
            `Receipt round doesn't match latest channel state:\n` +
            inspect(paymentReceipt) + '\n' +
            inspect(sprites.channel))

        assert(SC.checkAvailSigs(sprites.channel),
            `Invalid signatures:\n`
            + inspect(paymentReceipt) + '\n' +
            inspect(sprites.channel))

        await Sprites.save(sprites)
        const {payment, ...receipt} = paymentReceipt
        await PaywallClient.saveReceipt(receipt, pwc)
        return {...pwc, sprites, receipt}
    })
}

module.exports = PaywallClient
