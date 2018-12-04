// ----------------------------------------------------------------------------
// test-helpers-test.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {path} = require('ramda')
const {thread} = require('../fp.js')
const {isValidChecksumAddress} = require('ethereumjs-util')
const Web3EthContract = require('web3-eth-contract')
const H = require('../test-helpers.js')

describe('.pk', () => {
    it('throws if address is unknown', async () => {
        expect(()=>H.pk('<unknown addr>')).toThrowError(/<unknown addr>/)
    })
})

describe('.makeProvider', () => {
    it('ipc path defaults to ../test-chain.ipc', async () => {
        let provider
        expect(() => provider = H.makeProvider('ipc:')).not.toThrow()
        expect(provider)
            .toMatchObject({path: expect.stringMatching(/test-chain.ipc$/)})
    })

    it('understands the ipc protocol', async () => {
        let provider
        const ipcPath = '/abs/path/socket.ipc'
        expect(() => provider = H.makeProvider('ipc:' + ipcPath)).not.toThrow()
        expect(provider).toMatchObject({path: ipcPath})
    })

    it('understands the http protocol', async () => {
        let provider
        const httpUrl = 'http://host:1234'
        expect(() => provider = H.makeProvider(httpUrl)).not.toThrow()
        expect(provider).toMatchObject({host: httpUrl})
    })

    it('throws if protocol is unsupported', async () => {
        expect(() => H.makeProvider('unsupported://xxx'))
            .toThrowError(/Unsupported/)
    })
})

describe('.randomAddress', () => {
    it('returns a checksum address', async () => {
        expect(isValidChecksumAddress(H.randomAddress())).toBe(true)
    })
})

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
