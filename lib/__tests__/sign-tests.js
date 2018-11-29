// ----------------------------------------------------------------------------
// sign-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {makeProvider} = require('../test-helpers.js')
const H = require('../test-helpers.js')
const Sign = require('../sign.js')

describe('Sign', () => {
    describe('locally', () => {
        let web3Provider

        beforeAll(async () => {web3Provider = makeProvider()})

        afterAll(() => web3Provider.connection.destroy())

        test('with and without web3 results the same', async () => {
            const {ALICE} = H.NAMED_ACCOUNTS
            const ALICE_PK =H.pk(ALICE)
            const msg = '0123456789ABCDEF'

            const withWeb3 = Sign.locally(web3Provider, ALICE_PK, msg)
            const withoutWeb3 = Sign.locallyWithoutWeb3(ALICE_PK, msg)

            expect(withoutWeb3).toEqual(withWeb3)
        })
    })
})
