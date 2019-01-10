const t = require('./custom-tap.js')
const BigNumber = require('bignumber.js')

// t.runOnly = true

t.test('D', async t => {
    t.same(D`1.23`, BigNumber('1.23'),
        `from template literal`)

    t.same(D('1.23'), BigNumber('1.234'),
        `from String`)

    t.throws(() => D(1.23), /number.*accurate.*string/i,
        `rejects Number`)
})

t.test('BigNumber assertion type', async t => {
    await t.expect([1, 'to equal', 1],
        'Number "to equal" still works')

    await t.expect([1, 'not to equal', 2],
        'Number "not to equal" still works')

    await t.expect([D`1`, 'to equal', D`1`])
    await t.expect([D`1`, 'not to equal', D`2`])

    await t.expect([D`1`, 'to satisfy', D`1`])
    await t.expect([D`1`, 'not to satisfy', D`2`])

    await t.expect([D`1`, 'to be less than', D`2`])
    await t.expect([D`10`, 'not to be less than', D`5`])
})

t.test('Unexpected integration', async t => {
    await t.test('passing assertions', async t => {
        t.ok(await t.expect([1, 'to be', 1]),
            'sync')

        await t.resolves(
            t.expect([Promise.resolve(1), 'to be fulfilled with', 1]),
            'async')
    })

    await t.skip('failing assertions', async t => {
        await t.resolves(
            t.expect([1, 'to be', 2]),
            'synchronous assertions fail')

        await t.expect([Promise.resolve(1), 'to be fulfilled with', 2])
        'async assertions fail'
    })
}).catch(t.threw)
