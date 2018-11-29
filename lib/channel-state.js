// ----------------------------------------------------------------------------
//
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {
    __, map, assoc, omit, curry, clone, inc, add, subtract,
    transpose, all, either, isNil, equals, includes
} = require('ramda')
const {thread, update, updatePath} = require('./fp.js')
const assert = require('assert')
const {inspect} = require('util')
const Web3ABI = require('web3-eth-abi')
const {
    hashPersonalMessage,
    toBuffer,
    ecrecover,
    pubToAddress,
    fromRpcSig
} = require('ethereumjs-util')

const ChannelState = {
    make() {
        return clone({
            chId: undefined,
            players: [undefined, undefined],
            sigs: [undefined, undefined],
            round: -1,
            deposits: [0, 0],
            credits: [0, 0],
            withdrawals: [0, 0],
            withdrawn: [0, 0],

            // Payment
            amount: undefined,
            expiry: undefined,
            preimageHash: undefined,
            recipient: undefined
        })
    },

    between(actor1, actor2, chId = 0) {
        return {
            ...ChannelState.make(),
            chId,
            players: [actor1, actor2],

            // Payment
            amount: 0,
            expiry: 0,
            preimageHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
            recipient: '0x0000000000000000000000000000000000000000'
        }
    },

    /**
     * Inspect channel state without the conditional payment fields
     * which are not used at the moment and without the actual signatures,
     * assuming there is signature metadata available instead.
     * */
    inspector(depth, opts) {
        const conditionalPaymentFields =
            `amount expiry preimageHash recipient`
                .split(/\s+/)

        return omit(conditionalPaymentFields, this)
    },

    invalidateSigs: assoc('sigs', [undefined, undefined]),

    vector(channelState) {
        return [
            channelState.chId,
            channelState.credits,
            channelState.withdrawals,
            channelState.round,
            channelState.preimageHash,
            channelState.recipient,
            channelState.amount,
            channelState.expiry
        ]
    },

    serialize(channelState) {
        //// Having one function call doesn't allow pinpointing which parameter decoding fails
        // return Web3ABI.encodeParameters(
        //     [
        //         "uint", // chId
        //         "int[2]", // credits
        //         "uint[2]", // withdrawals
        //         "int", // round
        //         "bytes32", // preimageHash
        //         "address", // recipient
        //         "uint", // amount
        //         "uint", // expiry
        //     ],
        //     ChannelState.vector(channelState)
        // )

        let i = 0
        const ch = ChannelState.vector(channelState)
        const enc = (type, val) => Web3ABI.encodeParameter(type, val).slice(2)
        return "0x" + [
            enc("uint", ch[i++]), // chId,
            enc("int[2]", ch[i++]), // credits,
            enc("uint[2]", ch[i++]), // withdrawals,
            enc("int", ch[i++]), // round,
            enc("bytes32", ch[i++]), // preimageHash,
            enc("address", ch[i++]), // recipient
            enc("uint", ch[i++]), // amount,
            enc("uint", ch[i++]) // expiry
        ].join("")
    },

    checkAvailSigs(ch) {
        const h = hashPersonalMessage(toBuffer(ChannelState.serialize(ch)))

        const vrs = (web3vrs) => {
            const [v_, r_, s_] = map(toBuffer, web3vrs)
            const {v, r, s} = fromRpcSig(Buffer.concat([r_, s_, v_]))
            return [v, r, s]
        }

        const noSig = idx => isNil(ch.sigs[idx])

        const matchSig = (idx) =>
            equals(
                toBuffer(ch.players[idx]),
                pubToAddress(ecrecover(h, ...vrs(ch.sigs[idx]))))

        return all(either(noSig, matchSig), [0, 1])
    },

    validIdx: idx => includes(idx, [0, 1]),

    validateIdx: curry((idx, ch) => {
        assert(ChannelState.validIdx(idx),
            `Invalid actor index ${idx} in channel:\n` + inspect(ch))
    }),

    deposit: curry((to, amt, ch) => {
        ChannelState.validateIdx(to)
        assert(!isNil(amt), `Deposit amount is mandatory`)
        return thread(ch,
            update('round', inc),
            updatePath(['deposits', to], add(amt)),
            ChannelState.invalidateSigs)
    }),

    credit: curry((to, amt, ch) => {
        const from = to === 0 ? 1 : 0
        assert(ChannelState.balance(from, ch) >= amt,
            `Index(${from}) has insufficient balance to credit ${amt}:\n`
            + inspect(ch))

        return thread(ch,
            update('round', inc),
            updatePath(['credits', from], subtract(__, amt)),
            updatePath(['credits', to], add(amt)),
            ChannelState.invalidateSigs)
    }),

    withdraw: curry((idx, amt, ch) =>
        thread(ch,
            update('round', inc),
            updatePath(['withdrawals', idx], add(amt)),
            ChannelState.invalidateSigs)),

    balance: curry((idx, ch) => {
        const {deposits, credits, withdrawals, withdrawn: withdrawnS} = ch
        const [deposit, credit, withdrawal, withdrawn] =
            transpose([deposits, credits, withdrawals, withdrawnS])[idx]
        return deposit + credit - withdrawn
    })
}

module.exports = ChannelState
