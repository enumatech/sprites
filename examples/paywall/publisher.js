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
const {update, thread, threadP} = require('sprites/lib/fp.js')
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
    config(publisher) {
        const {sprites: {ownAddress, preimageManager, reg, token}} = publisher
        return {
            publisher: ownAddress,
            preimageManager: address(preimageManager),
            reg: address(reg),
            token: address(token),
        }
    },

    async catalog(publisher) {
        const publicFields = ['id', 'price', 'title', 'blurb']
        return project(publicFields, values(publisher.db))
    },

    /**
     * Create an invoice for an order.
     * */
    invoice: curry(async (order, publisher) => {
        const {db} = publisher
        const {chId, articleId} = order

        const article = db[articleId]
        assert(article, `Missing article for id: ${articleId}`)

        const {price} = article
        assert(price, `Missing price for article id: ${articleId}`)

        const spritesBefore =
            await Sprites.channelState({...publisher.sprites, chId})

        // FIXME deprecate
        const {cmd} = Sprites.cmd.invoice(price, spritesBefore)

        const ownIdx = Sprites.ownIdx(spritesBefore)
        const xforms = [
            ['credit', ownIdx, price],
            ['withdraw', ownIdx, price]]

        const sprites = await threadP(
            spritesBefore,
            update('channel', ChannelState.transition(xforms)),
            Sprites.sign)
        const {round, sigs} = sprites.channel

        return {
            ...publisher,
            sprites,
            invoice: {
                articleId, price,
                cmd /* FIXME deprecate in favor of xforms*/,
                xforms, chId, round, sigs
            }
        }
    }),

    receiptData({articleId, chId}) {
        return Buffer.concat([toBuffer(articleId), toUnsigned(new BN(chId))])
    },

    receiptSig: curry(async (unsignedReceipt, publisher) => {
        const {sprites} = publisher
        const sig = await thread(
            unsignedReceipt,
            Publisher.receiptData,
            bufferToHex,
            addHexPrefix,
            publisher.sprites.sign)

        sig.by = {actor: sprites.ACTOR_NAME, addr: sprites.ownAddress}
        sig.receipt = unsignedReceipt
        // sig[inspect.custom] = function () {
        //     return this.by.actor + '('
        //         + this.receipt.articleId
        //         + '|ch' + this.receipt.chId + ')'
        // }
        return sig
    }),

    processPayment: curry(async (payment, publisher) => {
        const {articleId, chId, cmd, sigs} = payment
        const [buyerSig, _sellerSig] = sigs
        assert(buyerSig,
            `Signature missing from payment:\n` + inspect(payment))

        const sprites = await threadP(publisher.sprites,
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

        const sig = await Publisher.receiptSig({articleId, chId}, publisher)

        await Sprites.save(sprites)
        return {
            ...publisher,
            sprites,
            paymentReceipt: {articleId, chId, sig, payment}
        }
    }),

    getArticle: curry(async (receipt, publisher) => {
        const {sig, articleId} = receipt
        const receiptHash = hashPersonalMessage(Publisher.receiptData(receipt))
        const {sprites} = publisher
        assert(Sign.by(sprites.ownAddress, receiptHash, sig),
            `Invalid signture on receipt:\n` + inspect(receipt))
        // This might be async, hence the whole function is async
        const article = publisher.db[articleId]
        return {...publisher, article}
    }),

    /**
     * Withdraws accumulated payments to the blockchain.
     * */
    publisherWithdraw: curry(async (chId, publisher) => {
        const spritesBefore = await threadP(
            publisher,
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
        return {...publisher, sprites: spritesAfter, withdrawn}
    }),

    /**
     * Agrees that the reader can withdraw their remaining
     * deposit from the channel onto the blockchain.
     * */
    readerWithdraw: curry(async (withdrawalRequest, publisher) => {
        const {chId, cmd, sigs} = withdrawalRequest
        const sprites = await threadP(publisher.sprites,
            assoc('chId', chId),
            Sprites.channelState,
            assoc('cmd', cmd),
            Sprites.cmd.apply,
            assocPath(['channel', 'sigs'], sigs))

        assert(ChannelState.checkAvailSigs(sprites.channel),
            `Invalid signatures in withdrawalRequest:\n`
            + inspect(withdrawalRequest) + '\n'
            + 'in channel:\n'
            + inspect(sprites.channel))

        const signedSprites = await Sprites.sign(sprites)
        await Sprites.save(signedSprites)
        const withdrawal = {
            ...withdrawalRequest,
            sigs: signedSprites.channel.sigs
        }
        return {...publisher, sprites: signedSprites, withdrawal}
    }),

    channel: curry(async (chId, publisher) => {
        return {
            ...publisher,
            sprites: await Sprites.channelState({...publisher.sprites, chId})
        }
    }),

    /**
     * Returns the off-chain balance of the publisher,
     * irregardless of its player index.
     *
     * It's meant to be a testing convenience, hence not chainable.
     * */
    balance: curry(async (chId, publisher) => {
        const {sprites} = await Publisher.channel(chId, publisher)
        return ChannelState.balance(Sprites.ownIdx(sprites), sprites.channel)
    })
}

module.exports = Publisher
