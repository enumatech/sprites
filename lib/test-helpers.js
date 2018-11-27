// ----------------------------------------------------------------------------
// test-helpers.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {
    toLower, prop, reject, isNil, path, contains, keysIn, intersection,
    startsWith, isEmpty, pickBy
} = require('ramda')
const {sleep, renameKeysWith, address} = require('./fp.js')
const assert = require('assert')
const {inspect} = require('util')
const fs = require('fs')
const Path = require('path')
const Net = require('net')
const Jayson = require('./jayson.js')
const crypto = require('crypto')
const {
    privateToAddress,
    bufferToHex,
    toChecksumAddress
} = require('ethereumjs-util')
const Web3Eth = require('web3-eth')

const NAMED_ACCOUNTS = {
    DEPLOYER: '0xd124b979F746bE85706DaA1180227e716EafCc5c',
    ALICE: '0xa49AAd37c34e92236690b93E291Ae5f10DaF7CBE',
    BOB: '0xb357fc3DBD4CDb7cBD96AA0A0bD905dBE56CaB77',
    EVE: '0xcBE431FF3fdcd4d735df5706e755D0f8726549f0'
}

const H = {
    ZERO_ADDR: '0x0000000000000000000000000000000000000000',
    ZERO_BYTES32: "0x0000000000000000000000000000000000000000000000000000000000000000",

    NAMED_ACCOUNTS,

    PRIVATE_KEYS: renameKeysWith(k => toLower(prop(k, NAMED_ACCOUNTS)), {
        DEPLOYER: '0xe33292da27178504b848586dcee3011a7e21ee6ed96f9df17487fd6518a128c7',
        ALICE: '0xd8ae722d3a6876fd27907c434968e7373c6fbb985242e545a427531132ef3a71',
        BOB: '0x28e58f2f6a924d381e243ec1ca4a2239d2b35ebd9a44cec11aead6848a52630b',
        EVE /*aka CHARLIE*/: '0x8e1733c6774268aee3db54901086b1f642f51e60300674ae3b33f1e1217ec7f5'
    }),

    pk(addr) {
        const lowerCaseAddr = addr.toLowerCase()

        if (lowerCaseAddr in H.PRIVATE_KEYS) {
            return H.PRIVATE_KEYS[lowerCaseAddr]
        } else {
            throw Error(`No private key found for ${lowerCaseAddr}`)
        }
    },

    newIpcProvider() {
        const ipcPath = Path.join(__dirname, '../test-chain.ipc')
        return new Web3Eth.providers.IpcProvider(ipcPath, Net)
    },

    address,

    randomAddressBuffer: () => {
        return privateToAddress(crypto.randomBytes(32))
    },

    randomAddress: () => {
        return toChecksumAddress(bufferToHex(H.randomAddressBuffer()))
    },

    wrap64: (str) => str.toUpperCase().match(/.{64}/g),

    mask0: (str) => str.replace(/0/g, "."),

    col(maybeHexStr) {
        const str = maybeHexStr.startsWith('0x')
            ? maybeHexStr.slice(2)
            : maybeHexStr
        return H.wrap64(H.mask0(str))
    },

    loadContracts() {
        // This gives better errors if the JSON file is corrupt/empty:
        //   const contracts = Jayson.load(Path.join(__dirname, '../out/contracts.json')).contracts
        // This works both on Node.js and when Browserified:
        const contracts = require('../out/contracts.json').contracts
        return reject(isNil, {
            PreimageManager: contracts["contracts/PreimageManager.sol:PreimageManager"],
            SpritesRegistry: contracts["contracts/SpritesRegistry.sol:SpritesRegistry"],
            ERC20Token: contracts["contracts/ERC20Token.sol:ERC20Token"],
            ERC20Interface: contracts["contracts/ERC20Interface.sol:ERC20Interface"],
            TestContract: contracts["contracts/TestContract.sol:TestContract"]
        })
    },

    liftMethods(web3Contract) {
        const overlap = intersection(
            keysIn(web3Contract),
            keysIn(web3Contract.methods))
        if (!isEmpty(overlap))
            throw new Error(`"${overlap}" contract method(s) already exist in web3 contract`)

        const isMethodNameSimple = (_method, name) =>
            !(startsWith('0x', name) || contains('(', name))

        const {options, methods} = web3Contract
        // We can strip the outer layer, because the contract methods
        // are bound to the right object.
        // Also expose the `options` field which is used by .send()
        // for example.
        const flattenedContract = {
            options,
            ...pickBy(isMethodNameSimple, methods)
        }

        return flattenedContract
    },

    async deploy(web3Provider, {abi: abiStr, bin}, from, ...args) {
        const eth = new Web3Eth(web3Provider)
        const abi = JSON.parse(abiStr)
        const contract = new eth.Contract(abi, {from, gas: 4e6})
        return contract
            .deploy({data: '0x' + bin, arguments: args})
            .send()
            .then(H.liftMethods)
    },

    async waitForAccounts(web3Provider) {
        const eth = new Web3Eth(web3Provider)
        while (true) {
            try {
                return await eth.getAccounts()
            } catch (err) {
                // console.error('Waiting for Ethereum accounts...\n', err)
                if (err.message.startsWith('Invalid JSON RPC response: ""')) {
                    await sleep(100)
                } else {
                    throw err
                }
            }
        }
    }
}

module.exports = H
