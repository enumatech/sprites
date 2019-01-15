const t = require('tap')
const unexpected = require('unexpected')
const BigNumber = require('bignumber.js')

const expect =
    require('../unexpected-bignumber.js')(unexpected.clone(), BigNumber)

t.pass(() => expect(1, 'to equal', 1),
    'Number "to equal" still works')

t.pass(() => expect(1, 'not to equal', 2),
    'Number "not to equal" still works')

t.pass(() => expect(D`1`, 'to equal', D`1`))
t.pass(() => expect(D`1`, 'not to equal', D`2`))

t.pass(() => expect(D`1`, 'to satisfy', D`1`))
t.pass(() => expect(D`1`, 'not to satisfy', D`2`))

t.pass(() => expect(D`1`, 'to be less than', D`2`))
t.pass(() => expect(D`10`, 'not to be less than', D`5`))
