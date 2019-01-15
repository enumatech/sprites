const t = require('tap')
const BigNumber = require('bignumber.js')
const {inspect} = require('util')
const D = require('../d-notation.js')(BigNumber, inspect)

t.same(D`1.23`, BigNumber('1.23'),
    `create as tagged template string literal`)

t.same(D('1.23'), BigNumber('1.23'),
    `create from String parameter`)

t.equal(inspect(D('1.23')), 'D`1.23`',
    `render with inspect()`)

t.equal(`${D('1.23')}`, 'D`1.23`',
    `render with template string`)

t.throws(() => D(1.23), /number.*accurate.*string/i,
    `rejects JavaScript Number type`)
