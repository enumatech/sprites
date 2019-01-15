const ethers = require('ethers')
const {utils: {BigNumber}} = ethers
const ethersTap = require('@enumatech/tap')({BigNumber})

module.exports = ethersTap

// Show up nicely in test output when the external test runner
// runs it accidentally.
if (module === require.main) {
    t.pass('ok')
    return
}
