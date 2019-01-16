const ethers = require('ethers')
const {utils: {BigNumber}} = ethers
const ethersTap = require('@enumatech/tap')({BigNumber})
const {t, inspect} = ethersTap
const Path = require('path')

const ipcPath = Path.join(__dirname, '..', '..', 'test-chain.ipc')
const rpcPath = 'http://localhost:9545'

/* Define inspectors for ethers classes */
const inspectWallet = function () {
    return `${this.NAME || 'wallet'}(${this.address})`
}
ethers.Wallet.prototype[inspect.custom] = inspectWallet
ethers.Wallet.prototype[Symbol.toPrimitive] = inspectWallet

const inspectContract = function () {
    return `${this.NAME || 'contract'}(${this.address})`
}
ethers.Contract.prototype[inspect.custom] = inspectContract
ethers.Contract.prototype[Symbol.toPrimitive] = inspectContract

const Helpers = {
    ...ethersTap, ethers, BigNumber, ipcPath, rpcPath,

    testChain() {
        // return new ethers.providers.JsonRpcProvider(Helpers.rpcPath)
        return new ethers.providers.IpcProvider(Helpers.ipcPath)
    }
}

module.exports = Helpers

// Show up nicely in test output when the external test runner
// runs it accidentally.
if (module === require.main) {
    t.pass('ok')
    return
}
