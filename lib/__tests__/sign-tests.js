// ----------------------------------------------------------------------------
// sign-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const Web3Eth = require('web3-eth')
const H = require('../test-helpers.js')
const Sign = require('../sign.js')

describe('Sign', () => {
    describe('locally', () => {
        test('with and without web3 results the same', async () => {
            const web3Provider = new Web3Eth.providers.HttpProvider('http://localhost:8545')
            const {ALICE} = H.NAMED_ACCOUNTS
            const ALICE_PK =H.pk(ALICE)
            const msg = '0123456789ABCDEF'

            const withWeb3 = Sign.locally(web3Provider, ALICE_PK, msg)
            const withoutWeb3 = Sign.locallyWithoutWeb3(ALICE_PK, msg)

            expect(withoutWeb3).toEqual(withWeb3)
        })
    })
})
