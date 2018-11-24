// ----------------------------------------------------------------------------
// sc-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {thread} = require('../fp.js')
const {toBuffer} = require('ethereumjs-util')
const H = require('../test-helpers.js')
const SC = require('../sc.js')
const Sign = require('../sign.js')

describe('State Channel', function () {
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
        expect(SC.vector(EXAMPLE_CHANNEL)).toEqual([
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

        const serializedState = SC.serialize(EXAMPLE_CHANNEL)

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
        const ch = SC.between(ALICE, BOB)
        const ch$ = SC.serialize(ch)
        const sigA = sign(ALICE_PK, ch$)
        const sigB = sign(BOB_PK, ch$)

        expect(SC.checkAvailSigs({...ch})).toBe(true)

        expect(SC.checkAvailSigs({...ch, sigs: [sigA, null]})).toBe(true)
        expect(SC.checkAvailSigs({...ch, sigs: [null, sigB]})).toBe(true)
        expect(SC.checkAvailSigs({...ch, sigs: [sigA, sigB]})).toBe(true)

        expect(SC.checkAvailSigs({...ch, sigs: [null, sigA]})).toBe(false)
        expect(SC.checkAvailSigs({...ch, sigs: [sigB, null]})).toBe(false)
        expect(SC.checkAvailSigs({...ch, sigs: [sigB, sigA]})).toBe(false)
    })

    test('.deposit', function () {
        const ch = SC.new()
        const amt = 10
        const round = ch.round

        const ch0 = SC.deposit(0, amt, ch)
        expect(ch0).toHaveProperty('round', round + 1)
        expect(ch0).toHaveProperty('deposits.0', amt)

        const ch1 = SC.deposit(1, amt, ch)
        expect(ch1).toHaveProperty('round', round + 1)
        expect(ch1).toHaveProperty('deposits.1', amt)
    })

    describe('.credit', () => {
        it('unless insufficient balance', () => {
            const deposit0 = 10
            const deposit1 = 5
            const ch = thread(
                SC.new(),
                SC.deposit(0, deposit0),
                SC.deposit(1, deposit1))

            expect(() => SC.credit(1, deposit0, ch)).not.toThrowError()
            expect(() => SC.credit(1, deposit0 + 1, ch))
                .toThrowError(/insufficient balance/i)

            expect(() => SC.credit(0, deposit1, ch)).not.toThrowError()
            expect(() => SC.credit(0, deposit1 + 1, ch))
                .toThrowError(/insufficient balance/i)
        })

        it('when there is sufficient balance', () => {
            const ch = thread(
                SC.new(),
                SC.deposit(0, 10),
                SC.deposit(1, 5))

            const ch0 = SC.credit(0, 3, ch)
            expect(ch0).toMatchObject({
                deposits: [10, 5],
                credits: [3, -3],
                round: ch.round + 1,
            })

            const ch1 = SC.credit(1, 4, ch)
            expect(ch1).toMatchObject({
                deposits: [10, 5],
                credits: [-4, 4],
                round: ch.round + 1,
            })
        })
    })

    test('.withdraw', function () {
        const ch = thread(
            SC.new(),
            SC.deposit(0, 10),
            SC.deposit(1, 5))

        const ch0 = SC.withdraw(0, 3, ch)
        expect(ch0).toHaveProperty('round', ch.round + 1)
        expect(ch0).toHaveProperty(['withdrawals', 0], 3)

        const ch1 = SC.withdraw(1, 4, ch)
        expect(ch1).toHaveProperty('round', ch.round + 1)
        expect(ch1).toHaveProperty(['withdrawals', 1], 4)
    })

    test('.balance', () => {
        const ch = thread(
            SC.new(),
            SC.deposit(0, 10),
            SC.deposit(1, 5))
        expect(SC.balance(0, ch)).toEqual(10)
        expect(SC.balance(1, ch)).toEqual(5)
    })
})
