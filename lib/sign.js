// ----------------------------------------------------------------------------
// sign.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {map, curry, equals} = require('ramda')
const {
    toBuffer,
    bufferToHex,
    pubToAddress,
    hashPersonalMessage,
    fromRpcSig,
    ecsign,
    ecrecover
} = require('ethereumjs-util')
const Web3Eth = require('web3-eth')

function time(msg) {
    if (Sign.PROFILED) console.time(msg)
}

function timeEnd(msg) {
    if (Sign.PROFILED) console.timeEnd(msg)
}

const Sign = {
    PROFILED: false,

    locally: curry((web3Provider, privateKey, data) => {
        const eth = new Web3Eth(web3Provider)
        time('Local signing')
        const {v, r, s} = eth.accounts.sign(data, privateKey)
        timeEnd('Local signing')
        return [v, r, s]
    }),

    locallyWithoutWeb3: curry((privateKey, data) => {
        time('Local signing')
        const {v, r, s} =
            ecsign(hashPersonalMessage(toBuffer(data)), toBuffer(privateKey))
        timeEnd('Local signing')
        return [v, r, s].map(bufferToHex)
    }),

    remotely: curry(async (web3Provider, address, data) => {
        const eth = new Web3Eth(web3Provider)
        time('Remote signing')
        const sig = await eth.sign(data, address)
        const r = sig.substring(0, 66)
        const s = '0x' + sig.substring(66, 130)
        const v = '0x' + sig.substring(130)
        timeEnd('Remote signing')
        return [v, r, s]
    }),

    /**
     * Returns an array of buffers suitable for ecrecover.
     * */
    fromWeb3Sig(web3vrs) {
        const [v_, r_, s_] = map(toBuffer, web3vrs)
        const {v, r, s} = fromRpcSig(Buffer.concat([r_, s_, v_]))
        return [v, r, s]
    },

    /**
     * Recovers the address (as Buffer) from a personalHash
     * */
    recoverFromHash(hash, web3vrs) {
        return pubToAddress(ecrecover(hash, ...Sign.fromWeb3Sig(web3vrs)))
    },

    recover(data, web3vrs) {
        const hash = hashPersonalMessage(toBuffer(data))
        return Sign.recoverFromHash(hash, web3vrs)
    },

    /**
     * Returns whether a signature of a hash is
     * signed by the specified address.
     * */
    by: curry((address, hash, web3vrs) => {
        return equals(toBuffer(address), Sign.recoverFromHash(hash, web3vrs))
    }),

    personal: curry(async (web3Provider, address, data) => {
        const eth = new Web3Eth(web3Provider)
        time('Remote signing')
        const sig = await eth.personal.sign(data, address)
        const r = sig.substring(0, 66)
        const s = '0x' + sig.substring(66, 130)
        const v = '0x' + sig.substring(130)
        timeEnd('Remote signing')
        return [v, r, s]
    })
}

module.exports = Sign
