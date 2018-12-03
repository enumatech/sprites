// ----------------------------------------------------------------------------
// channel-state-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {thread} = require('../fp.js')
const {toBuffer} = require('ethereumjs-util')
const H = require('../test-helpers.js')
const ChannelState = require('../channel-state.js')
const {
    make, between, vector, serialize, balance, checkAvailSigs, validateIdx,
    credit, deposit, withdraw, creditAndWithdraw
} = ChannelState
const Sign = require('../sign.js')

describe('Channel State', function () {
    const EXAMPLE_CHANNEL = {
        deposits: ["1", "2"],
        credits: ["3", "4"],
        withdrawals: ["5", "6"],
        withdrawn: ["50", "60"],
        round: "7",
        amount: "8",
        expiry: "9",
        preimageHash: "0xA00000000000000000000000000000000000000000000000000000000000000A",
        recipient: "0xB00000000000000000000000000000000000000B",
        chId: "0xC",
        players: [
            "0xD00000000000000000000000000000000000000D",
            "0xE00000000000000000000000000000000000000E"
        ],
        sigs: ["sig1", "sig2"]
    }

    test('.vector', function () {
        expect(vector(EXAMPLE_CHANNEL)).toEqual([
            EXAMPLE_CHANNEL.chId,
            EXAMPLE_CHANNEL.credits,
            EXAMPLE_CHANNEL.withdrawals,
            EXAMPLE_CHANNEL.round,
            EXAMPLE_CHANNEL.preimageHash,
            EXAMPLE_CHANNEL.recipient,
            EXAMPLE_CHANNEL.amount,
            EXAMPLE_CHANNEL.expiry
        ])
    })

    test('.serialize', function () {
        const expectedSerialization = [
            "000000000000000000000000000000000000000000000000000000000000000C" +
            "0000000000000000000000000000000000000000000000000000000000000003" +
            "0000000000000000000000000000000000000000000000000000000000000004" +
            "0000000000000000000000000000000000000000000000000000000000000005" +
            "0000000000000000000000000000000000000000000000000000000000000006" +
            "0000000000000000000000000000000000000000000000000000000000000007" +
            "A00000000000000000000000000000000000000000000000000000000000000A" +
            "000000000000000000000000B00000000000000000000000000000000000000B" +
            "0000000000000000000000000000000000000000000000000000000000000008" +
            "0000000000000000000000000000000000000000000000000000000000000009"
        ]

        const serializedState = serialize(EXAMPLE_CHANNEL)

        expect(H.col(serializedState.slice(2)))
            .toEqual(H.col(expectedSerialization.join("")))

        expect(toBuffer(serializedState))
            .toHaveLength(10 /*params*/ * 32 /*bytes*/)
    })

    test('.checkAvailSigs', async () => {
        const {ALICE, BOB} = H.NAMED_ACCOUNTS
        const ALICE_PK = H.pk(ALICE)
        const BOB_PK = H.pk(BOB)
        const sign = Sign.locallyWithoutWeb3
        const ch = between(ALICE, BOB)
        const ch$ = serialize(ch)
        const sigA = sign(ALICE_PK, ch$)
        const sigB = sign(BOB_PK, ch$)

        expect(checkAvailSigs({...ch})).toBe(true)

        expect(checkAvailSigs({...ch, sigs: [sigA, null]})).toBe(true)
        expect(checkAvailSigs({...ch, sigs: [null, sigB]})).toBe(true)
        expect(checkAvailSigs({...ch, sigs: [sigA, sigB]})).toBe(true)

        expect(checkAvailSigs({...ch, sigs: [null, sigA]})).toBe(false)
        expect(checkAvailSigs({...ch, sigs: [sigB, null]})).toBe(false)
        expect(checkAvailSigs({...ch, sigs: [sigB, sigA]})).toBe(false)
    })

    describe('.validateIdx', () => {
        expect(() => validateIdx(-1, {channel: "state"}))
            .toThrowError(/Invalid.+-1.+\n.+channel:.+state.+/)
    })

    test('.deposit', function () {
        const ch = make()
        const amt = 10
        const round = ch.round

        const ch0 = deposit(0, amt, ch)
        expect(ch0).toHaveProperty('round', round + 1)
        expect(ch0).toHaveProperty('deposits.0', amt)

        const ch1 = deposit(1, amt, ch)
        expect(ch1).toHaveProperty('round', round + 1)
        expect(ch1).toHaveProperty('deposits.1', amt)
    })

    describe('.credit', () => {
        it('unless insufficient balance', () => {
            const deposit0 = 10
            const deposit1 = 5
            const ch = thread(
                make(),
                deposit(0, deposit0),
                deposit(1, deposit1))

            expect(() => credit(1, deposit0, ch)).not.toThrowError()
            expect(() => credit(1, deposit0 + 1, ch))
                .toThrowError(/insufficient balance/i)

            expect(() => credit(0, deposit1, ch)).not.toThrowError()
            expect(() => credit(0, deposit1 + 1, ch))
                .toThrowError(/insufficient balance/i)
        })

        it('when there is sufficient balance', () => {
            const ch = thread(
                make(),
                deposit(0, 10),
                deposit(1, 5))

            const ch0 = credit(0, 3, ch)
            expect(ch0).toMatchObject({
                deposits: [10, 5],
                credits: [3, -3],
                round: ch.round + 1,
            })

            const ch1 = credit(1, 4, ch)
            expect(ch1).toMatchObject({
                deposits: [10, 5],
                credits: [-4, 4],
                round: ch.round + 1,
            })
        })
    })

    test('.withdraw', function () {
        const ch = thread(
            make(),
            deposit(0, 10),
            deposit(1, 5))

        const ch0 = withdraw(0, 3, ch)
        expect(ch0).toHaveProperty('round', ch.round + 1)
        expect(ch0).toHaveProperty(['withdrawals', 0], 3)

        const ch1 = withdraw(1, 4, ch)
        expect(ch1).toHaveProperty('round', ch.round + 1)
        expect(ch1).toHaveProperty(['withdrawals', 1], 4)
    })

    test('.creditAndWithdraw', function () {
        const ch = thread(
            make(),
            deposit(0, 10),
            deposit(1, 9))

        const ch0 = creditAndWithdraw(0, 3, ch)
        expect(ch0).toMatchObject({
            credits: [3, -3],
            withdrawals: [10 + 3, 9 - 3],
            round: ch.round + 1,
        })

        const ch1 = creditAndWithdraw(1, 3, ch)
        expect(ch1).toMatchObject({
            credits: [-3, 3],
            withdrawals: [10 - 3, 9 + 3],
            round: ch.round + 1,
        })
    })

    describe('.balance', () => {
        it('returns deposits', () => {
            const ch = thread(
                make(),
                deposit(0, 10),
                deposit(1, 5))
            expect(balance(0, ch)).toEqual(10)
            expect(balance(1, ch)).toEqual(5)
        })

        it('sums credits with deposits', () => {
            const ch = thread(
                make(),
                deposit(0, 10),
                deposit(1, 5),
                credit(1, 3))
            expect(balance(0, ch)).toEqual(10 - 3)
            expect(balance(1, ch)).toEqual(5 + 3)
        })

        it('ignores (tentative) withdrawals', () => {
            const ch = thread(
                make(),
                deposit(0, 10),
                deposit(1, 5),
                credit(1, 3),
                withdraw(0, 1),
                withdraw(1, 2))
            expect(balance(0, ch)).toEqual(10 - 3)
            expect(balance(1, ch)).toEqual(5 + 3)
        })
    })
})
