// ----------------------------------------------------------------------------
// test-helpers-test.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {path} = require('ramda')
const {thread} = require('../fp.js')
const Web3EthContract = require('web3-eth-contract')
const H = require('../test-helpers.js')

describe('#liftMethods', () => {
    test('lifts', async () => {
        const abi = thread(H.loadContracts(),
            path(['PreimageManager', 'abi']),
            JSON.parse)
        const contract = new Web3EthContract(abi)
        expect(H.liftMethods(contract))
            .toHaveProperty('revealedBefore', contract.methods.revealedBefore)
    })

    test('throws on method name conflict', async () => {
        const contract = {
            conflictingMethod: () => nil,
            methods: {
                conflictingMethod: () => nil
            }
        }
        expect(() => H.liftMethods(contract)).toThrow('conflictingMethod')
    })
})
