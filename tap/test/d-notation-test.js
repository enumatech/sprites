const t = require('tap')
const BigNumber = require('bignumber.js')
const {inspect} = require('util')
const D = require('../d-notation.js')(BigNumber, inspect)

t.same(D`1.23`, BigNumber('1.23'),
    `from template literal`)

t.same(D('1.23'), BigNumber('1.23'),
    `from String`)

t.throws(() => D(1.23), /number.*accurate.*string/i,
    `rejects Number`)
