// ----------------------------------------------------------------------------
//
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {curry, assoc, assocPath, project, values, prop} = require('ramda')
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

const Paywall = {
    new() {
        const paywall = {
            db: undefined,
            sprites: Sprites.new()
        }
        return paywall
    },

    /**
     * Returns parameters necessary for a PaywallClient to establish
     * payment channels with the Paywall
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
        // TODO: sent blurb instead of content
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
            Paywall.receiptData,
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

        const sig = await Paywall.receiptSig({articleId, chId}, paywall)

        await Sprites.save(sprites)
        return {...paywall, sprites, paymentReceipt: {articleId, chId, sig, payment}}
    }),

    getArticle: curry(async (receipt, paywall) => {
        const {sig, articleId} = receipt
        const receiptHash = hashPersonalMessage(Paywall.receiptData(receipt))
        const {sprites} = paywall
        assert(Sign.by(sprites.ownAddress, receiptHash, sig),
            `Invalid signture on receipt:\n` + inspect(receipt))
        const article = paywall.db[articleId]
        return {...paywall, article}
    }),

    withdraw: curry(async (chId, paywall) => {
        const ifChannelExists = (sprites) => {
            const {chId, channel} = sprites
            if (isNil(channel))
                throw new Error(`No channel found for chId "${chId}"`)
            return sprites
        }

        const sprites = await threadP(
            Paywall.channel(chId, paywall),
            prop('sprites'),
            ifChannelExists,
            Sprites.updateAndWithdraw,
            Sprites.save)
        return {...paywall, sprites}
    }),

    channel: curry(async (chId, paywall) => {
        const sprites = await Sprites.channelState({...paywall.sprites, chId})
        return {...paywall, sprites}
    })
}

module.exports = Paywall
