// ----------------------------------------------------------------------------
// publisher.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {
    isNil, curry, assoc, assocPath, project, values, prop
} = require('ramda')
const {thread, threadP} = require('sprites/lib/fp.js')
const assert = require('assert')
const {inspect} = require('util')
const {
    BN,
    addHexPrefix,
    bufferToHex,
    toBuffer,
    toUnsigned,
    hashPersonalMessage
} = require('ethereumjs-util')
const H = require('sprites/lib/test-helpers.js')
const {address} = H
const Sign = require('sprites/lib/sign.js')
const ChannelState = require('sprites/lib/channel-state.js')
const Sprites = require('sprites')

const Publisher = {
    make(opts) {
        return {
            db: undefined,
            sprites: Sprites.make(),
            ...opts
        }
    },

    /**
     * Returns parameters necessary for a Reader to establish
     * payment channels with the Publisher
     * */
    config(paywall) {
        const {sprites: {ownAddress, preimageManager, reg, token}} = paywall
        return {
            publisher: ownAddress,
            preimageManager: address(preimageManager),
            reg: address(reg),
            token: address(token),
        }
    },

    async catalog(paywall) {
        const publicFields = ['id', 'price', 'title', 'blurb']
        return project(publicFields, values(paywall.db))
    },

    /**
     * Create an invoice for an order.
     * */
    invoice: curry(async (order, paywall) => {
        const {db} = paywall
        const {chId, articleId} = order

        const article = db[articleId]
        assert(article, `Missing article for id: ${articleId}`)

        const {price} = article
        assert(price, `Missing price for article id: ${articleId}`)

        const sprites = await threadP({...paywall.sprites, chId},
            Sprites.channelState,
            Sprites.cmd.invoice(price),
            Sprites.sign)
        const {cmd, channel: {round, sigs}} = sprites

        return {
            ...paywall,
            sprites,
            invoice: {articleId, price, cmd, chId, round, sigs}
        }
    }),

    receiptData({articleId, chId}) {
        return Buffer.concat([toBuffer(articleId), toUnsigned(new BN(chId))])
    },

    receiptSig: curry(async (unsignedReceipt, paywall) => {
        const {sprites} = paywall
        const sig = await thread(
            unsignedReceipt,
            Publisher.receiptData,
            bufferToHex,
            addHexPrefix,
            paywall.sprites.sign)

        sig.by = {actor: sprites.ACTOR_NAME, addr: sprites.ownAddress}
        sig.receipt = unsignedReceipt
        // sig[inspect.custom] = function () {
        //     return this.by.actor + '('
        //         + this.receipt.articleId
        //         + '|ch' + this.receipt.chId + ')'
        // }
        return sig
    }),

    processPayment: curry(async (payment, paywall) => {
        const {articleId, chId, cmd, sigs} = payment
        const [buyerSig, _sellerSig] = sigs
        assert(buyerSig,
            `Signature missing from payment:\n` + inspect(payment))

        const sprites = await threadP(paywall.sprites,
            assoc('chId', chId),
            Sprites.channelState,
            assoc('cmd', cmd),
            Sprites.cmd.apply,
            assocPath(['channel', 'sigs'], sigs))

        assert(ChannelState.checkAvailSigs(sprites.channel),
            `Invalid signatures in payment:\n`
            + inspect(payment) + '\n'
            + 'in channel:\n'
            + inspect(sprites.channel))

        const sig = await Publisher.receiptSig({articleId, chId}, paywall)

        await Sprites.save(sprites)
        return {...paywall, sprites, paymentReceipt: {articleId, chId, sig, payment}}
    }),

    getArticle: curry(async (receipt, paywall) => {
        const {sig, articleId} = receipt
        const receiptHash = hashPersonalMessage(Publisher.receiptData(receipt))
        const {sprites} = paywall
        assert(Sign.by(sprites.ownAddress, receiptHash, sig),
            `Invalid signture on receipt:\n` + inspect(receipt))
        const article = paywall.db[articleId]
        return {...paywall, article}
    }),

    publisherWithdraw: curry(async (chId, paywall) => {
        const spritesBefore = await threadP(
            paywall,
            Publisher.channel(chId),
            prop('sprites'))

        const spritesAfter = await threadP(
            spritesBefore,
            Sprites.updateAndWithdraw,
            Sprites.channelState,
            Sprites.save)

        const ownIdx = Sprites.ownIdx(spritesAfter)
        const withdrawn =
            spritesAfter.channel.withdrawn[ownIdx] -
            spritesBefore.channel.withdrawn[ownIdx]
        return {...paywall, sprites: spritesAfter, withdrawn}
    }),

    readerWithdraw: curry(async (chId, paywall) => {
    }),

    channel: curry(async (chId, paywall) => {
        const sprites = await Sprites.channelState({...paywall.sprites, chId})
        return {...paywall, sprites}
    }),

    /**
     * Returns the off-chain balance of the paywall,
     * irregardless of its player index.
     *
     * It's meant to be a testing convenience, hence not chainable.
     * */
    balance: curry(async (chId, paywall) => {
        const {sprites} = await Publisher.channel(chId, paywall)
        return ChannelState.balance(Sprites.ownIdx(sprites), sprites.channel)
    })
}

module.exports = Publisher