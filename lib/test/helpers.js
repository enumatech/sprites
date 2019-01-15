const ethers = require('ethers')
const {utils: {BigNumber}} = ethers
const ethersTap = require('@enumatech/tap')({BigNumber})
const {t, D} = ethersTap
const Path = require('path')

const ipcPath = Path.join(__dirname, '..', '..', 'test-chain.ipc')

const Helpers = {
    ...ethersTap, ethers, ipcPath,

    testChain() {
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
