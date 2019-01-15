const tap = require('tap')
const unexpected = require('unexpected')
const BigNumber = require('bignumber.js')
const {inspect} = require('util')

const D = require('./d-notation')(BigNumber, inspect)

const extendedExpect =
    require('./unexpected-bignumber.js')(unexpected.clone(), BigNumber)

const extendedTap =
    require('./tap-unexpected.js')(tap, extendedExpect)

global.D = D

module.exports = {
    tap,
    unexpected,
    BigNumber,
    D,
    inspect,
    expect: extendedExpect,
    t: extendedTap
}
