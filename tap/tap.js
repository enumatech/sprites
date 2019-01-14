const tap = require('tap')
const unexpected = require('unexpected')
const BigNumber = require('bignumber.js')
const {inspect} = require('util')

require('./d-notation')(global, BigNumber, inspect)

const extendedExpect =
    require('./unexpected-bignumber.js')(unexpected.clone(), BigNumber)

const extendedTap =
    require('./tap-unexpected.js')(tap, extendedExpect)

module.exports = extendedTap
