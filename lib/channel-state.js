// ----------------------------------------------------------------------------
// channel-state.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {
    __, map, assoc, assocPath, omit, curry, clone, inc, add, subtract,
    path, transpose, all, either, isNil, equals, includes, reduce
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

    /**
     * Credits to the indexed player the specified amount, given
     * there is enough balance available.
     * */
    credit: curry((to, amt, ch) => {
        const from = to === 0 ? 1 : 0
        assert(ChannelState.balance(from, ch) >= amt,
            `Index(${from}) has insufficient balance to credit ${amt}:\n`
            + inspect(ch))

        return thread(ch,
            updatePath(['credits', from], subtract(__, amt)),
            updatePath(['credits', to], add(amt)),
            ChannelState.invalidateSigs)
    }),

    withdraw: curry((idx, amt, ch) =>
        thread(ch,
            updatePath(['withdrawals', idx], add(amt)),
            ChannelState.invalidateSigs)),

    /**
     * Simulate on-chain withdrawal for testing purposes only.
     * */
    withdrawOnChain: curry((idx, ch) => {
        const withdrawals = path(['withdrawals', idx], ch)
        const withdrawn = path(['withdrawn', idx], ch)
        assert(withdrawals >= withdrawn,
            new Error(
                `Withdrawals (${withdrawals}) is less` +
                ` than withdrawn (${withdrawn})`))
        const toWithdraw = withdrawals - withdrawn
        const balance = ChannelState.balance(idx, ch)
        assert(balance >= toWithdraw,
            new Error(
                `Insufficient balance: ${balance} >= ${toWithdraw} =` +
                ` withdrawals (${withdrawals}) - withdrawn (${withdrawn})`))
        return assocPath(['withdrawn', idx], withdrawals, ch)
    }),

    creditAndWithdraw: curry((to, amt, ch) => {
        const from = (to === 0) ? 1 : 0
        assert(ChannelState.balance(from, ch) >= amt,
            `Index(${from}) has insufficient balance to credit ${amt}:\n`
            + inspect(ch))

        const withdrawBalance = idx => ch =>
            assocPath(['withdrawals', idx],
                ChannelState.balance(idx, ch) + ch.withdrawn[idx], ch)

        return thread(ch,
            updatePath(['credits', from], subtract(__, amt)),
            updatePath(['credits', to], add(amt)),
            withdrawBalance(to),
            ChannelState.invalidateSigs)
    }),

    balance: curry((idx, ch) => {
        const amountsByPlayer =
            transpose([ch.deposits, ch.credits, ch.withdrawals, ch.withdrawn])
        const [deposit, credit, withdrawal, withdrawn] = amountsByPlayer[idx]
        return deposit - withdrawn + credit
    }),

    xforms: ['credit', 'withdraw', 'creditAndWithdraw'],

    /**
     * Returns command name if it's valid, otherwise throws.
     * */
    validCmd(cmdName) {
        assert(includes(cmdName, ChannelState.xforms),
            `Unknown state channel command: "${cmdName}"`)
        return cmdName
    },

    /**
     * Reducer function for applying a transformation onto a channel state.
     *
     * It throws if the function name of the transformation is invalid,
     * because it's not listed in `ChannelState.transforms`.
     *
     * @param {ChannelState} ch - Channel state
     * @param {Array} -
     *     Transformation function name (a method of `ChannelState`)
     *     and any number of parameters.
     * @return {ChannelState} Transformed channel state
     * */
    xform: (ch, [name, ...params]) =>
        ChannelState[ChannelState.validCmd(name)](...params, ch),

    transition: (xforms, ch) =>
        thread(xforms,
            reduce(ChannelState.xform, ch),
            update('round', inc))
}

module.exports = ChannelState
