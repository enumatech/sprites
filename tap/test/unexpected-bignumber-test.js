const t = require('tap')
const unexpected = require('unexpected')
const BigNumber = require('bignumber.js')
const {inspect} = require('util')
const D = require('../d-notation.js')(BigNumber, inspect)

const expect =
    require('../unexpected-bignumber.js')(unexpected.clone(), BigNumber)

const ok = (expectation, message) =>
    t.doesNotThrow(
        () => expect(...expectation),
        message || `expect ${inspect(expectation)}`)

const notOk = (expectation, message) =>
    t.throws(
        () => expect(...expectation),
        message || `don't expect ${inspect(expectation)}`)

ok([1, 'to equal', 1], 'Number "to equal" still works')
ok([1, 'not to equal', 2], 'Number "not to equal" still works')

ok([D`1`, 'to satisfy', D`1`])
ok([D`1`, 'not to satisfy', D`2`])

ok([D`1`, 'to equal', D`1`])
ok([D`1`, 'not to equal', D`2`])

ok([D`2`, 'to be greater than', D`1`])
notOk([D`1`, 'to be greater than', D`2`])
ok([D`2`, 'to be greater than or equal to', D`1`])
ok([D`2`, 'to be greater than or equal to', D`2`])

ok([D`1`, 'to be less than', D`2`])
ok([D`1`, 'to be less than or equal to', D`2`])
ok([D`2`, 'to be less than or equal to', D`2`])
