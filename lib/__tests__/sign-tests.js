// ----------------------------------------------------------------------------
// sign-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {makeProvider} = require('../test-helpers.js')
const {toBuffer, hashPersonalMessage} = require('ethereumjs-util')
const H = require('../test-helpers.js')
const Sign = require('../sign.js')

describe('Sign', () => {
    let web3Provider
    const msg = '0123456789ABCDEF'
    const hash = hashPersonalMessage(toBuffer(msg))
    const {ALICE, BOB} = H.NAMED_ACCOUNTS
    const expectedSig = [
        "0x1b",
        "0x696b2036ec190e2995af3cdae66e381ad6ac7dff7bf2a506f08ef8879d505e95",
        "0x4f6f50ccf5b0b86117ba2533075ee05756e9f4d80741721068b9d5be0607385f",
    ]

    beforeAll(async () => {
        web3Provider = makeProvider()
    })

    afterAll(() => web3Provider.connection.destroy())

    describe('locally', () => {
        test('with and without web3 results the same', async () => {
            const ALICE_PK = H.pk(ALICE)

            const withWeb3 = Sign.locally(web3Provider, ALICE_PK, msg)
            const withoutWeb3 = Sign.locallyWithoutWeb3(ALICE_PK, msg)

            expect(withoutWeb3).toEqual(withWeb3)
        })
    })

    describe('.remotely', () => {
        it('works', async () => {
            await expect(Sign.remotely(web3Provider, ALICE, msg))
                .resolves.toEqual(expectedSig)
        })
    })

    describe('.personal', () => {
        it('works', async () => {
            await expect(Sign.personal(web3Provider, ALICE, msg))
                .resolves.toEqual(expectedSig)
        })
    })

    describe('.by', () => {
        it('returns true if address is correct', async () => {
            expect(Sign.by(ALICE, hash, expectedSig)).toBe(true)
        })

        it('returns false if address is incorrect', async () => {
            expect(Sign.by(BOB, hash, expectedSig)).toBe(false)
        })
    })
})
