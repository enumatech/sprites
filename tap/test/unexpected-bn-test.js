const t = require('tap')
const unexpected = require('unexpected')
const BN = require('bn.js')
const {inspect} = require('util')
const I = require('../i-notation.js')(BN, inspect)

const expect =
    require('../unexpected-bn.js')(unexpected.clone(), BN)

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

ok([I`1`, 'to satisfy', I`1`])
ok([I`1`, 'not to satisfy', I`2`])

ok([I`1`, 'to equal', I`1`])
ok([I`1`, 'not to equal', I`2`])

ok([I`2`, 'to be greater than', I`1`])
notOk([I`1`, 'to be greater than', I`2`])
ok([I`2`, 'to be greater than or equal to', I`1`])
ok([I`2`, 'to be greater than or equal to', I`2`])

ok([I`1`, 'to be less than', I`2`])
ok([I`1`, 'to be less than or equal to', I`2`])
ok([I`2`, 'to be less than or equal to', I`2`])
