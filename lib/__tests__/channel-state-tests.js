// ----------------------------------------------------------------------------
// channel-state-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const R = require('ramda')
const {assocPath, inc, path} = R
const {thread, updatePath} = require('../fp.js')
const {toBuffer} = require('ethereumjs-util')
const H = require('../test-helpers.js')
const ChannelState = require('../channel-state.js')
const {
    make, between, vector, serialize, balance, checkAvailSigs, validateIdx,
    credit, deposit, withdraw, withdrawOnChain, creditAndWithdraw,
    xform, transition
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

    describe('.withdrawOnChain', () => {
        let ch, idx

        beforeAll(() => {
            idx = 1
            ch = thread(
                make(),
                deposit(0, 10),
                creditAndWithdraw(idx, 3))
        })

        it('keeps the round intact', () => {
            expect(withdrawOnChain(idx, ch)).toMatchObject({round: ch.round})
        })

        it('withdrawals is less than withdrawn', () => {
            const withdrawals = path(['withdrawals', idx], ch)
            const underdrawnCh =
                assocPath(['withdrawn', idx], inc(withdrawals), ch)
            const withdrawn = path(['withdrawn', idx], underdrawnCh)

            expect(() => withdrawOnChain(idx, underdrawnCh))
                .toThrowError(new RegExp(
                    `Withdrawals.+${withdrawals}.+withdrawn.+${withdrawn}`))
        })

        it('unless insufficient balance', () => {
            let lowBalanceCh = updatePath(['withdrawals', idx], inc, ch)
            expect(() => withdrawOnChain(idx, lowBalanceCh))
                .toThrowError(/insufficient balance/i)
        })
    })

    describe('.credit', () => {
        it('fails with insufficient balance', () => {
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

        it('works with sufficient balance', () => {
            const ch = thread(
                make(),
                deposit(0, 10),
                deposit(1, 5))

            const ch0 = credit(0, 3, ch)
            expect(ch0).toMatchObject({
                deposits: [10, 5],
                credits: [3, -3],
            })

            const ch1 = credit(1, 4, ch)
            expect(ch1).toMatchObject({
                deposits: [10, 5],
                credits: [-4, 4],
            })
        })
    })

    test('.withdraw', function () {
        const ch = thread(
            make(),
            deposit(0, 10),
            deposit(1, 5))

        const ch0 = withdraw(0, 3, ch)
        expect(ch0).toHaveProperty(['withdrawals', 0], 3)

        const ch1 = withdraw(1, 4, ch)
        expect(ch1).toHaveProperty(['withdrawals', 1], 4)
    })

    describe('.creditAndWithdraw', () => {
        let ch

        beforeEach(async () => {
            ch = thread(
                make(),
                deposit(0, 10),
                deposit(1, 9))
        })

        it('credits destination and prepares withdrawal by destination', () => {
            const ch0 = creditAndWithdraw(0, 3, ch)
            expect(ch0).toMatchObject({
                credits: [3, -3],
                withdrawals: [10 + 3, 0],
            })

            const ch1 = creditAndWithdraw(1, 3, ch)
            expect(ch1).toMatchObject({
                credits: [-3, 3],
                withdrawals: [0, 9 + 3],
            })
        })

        test.each([
            // from, to
            [0, 1],
            [1, 0]
        ])('works after credit from idx%i is withdraw by idx%i on chain',
            (from, to) => {
                const [amt1, amt2] = [3, 1]
                const total = amt1 + amt2
                expect(
                    thread(
                        make(),
                        deposit(from, amt1 + amt2),
                        creditAndWithdraw(to, amt1),
                        withdrawOnChain(to),
                        creditAndWithdraw(to, amt2))
                ).toMatchObject({
                    credits: thread([NaN, NaN],
                        R.update(from, -total),
                        R.update(to, total)),

                    withdrawals: thread([NaN, NaN],
                        R.update(from, 0),
                        R.update(to, total)),

                    withdrawn: thread([NaN, NaN],
                        R.update(from, 0),
                        R.update(to, amt1)),
                })
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

    describe('.xform', () => {
        const ch0 = thread(make(), deposit(0, 10))

        it('rejects invalid commands', () =>
            expect(() => xform(ch0, ['invalidCmd']))
                .toThrowError(/invalidCmd/))

        it('executes valid commands', () =>
            expect(xform(ch0, ['credit', 1, 1]))
                .toHaveProperty('credits.1', 1))
    })

    describe('.transition', () => {
        let ch1
        const ch0 = thread(make(), deposit(0, 10))

        beforeAll(() =>
            ch1 = transition([
                ['credit', 1, 3],
                ['withdraw', 1, 2]
            ], ch0))

        it('applies all xforms', () => {
            expect(ch1).toHaveProperty('credits.1', 3)
            expect(ch1).toHaveProperty('withdrawals.1', 2)
        })

        it('increments the round number', () =>
            expect(ch1).toHaveProperty('round', ch0.round + 1))
    })
})
