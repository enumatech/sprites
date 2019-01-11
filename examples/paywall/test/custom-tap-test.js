const t = require('./custom-tap.js')
const expect = require('unexpected')
const BigNumber = require('bignumber.js')

// t.runOnly = true

async function run() {
    const nop = () => 0
    const err = (msg = '<boom>') => Error(msg)
    // @formatter:off
    const exn = () => { throw err() }
    // @formatter:on
    const resolved = (x = 123) => Promise.resolve(x)
    const rejected = (x = err()) => Promise.reject(x)

    await t.test('expect', async t => {
        await t.test('sync', async t => {
            t.ok(expect(123, 'to be', 123).isFulfilled())
            t.throws(() => expect(123, 'to be', 999))
            t.ok(expect(exn, 'to throw').isFulfilled())
            t.throws(() => expect(exn, 'not to throw'))
        })

        await t.test('async', async t => {
            t.ok(expect(resolved, 'to be fulfilled').isPending())
            await t.resolves(expect(resolved, 'to be fulfilled'))

            t.ok(expect(resolved, 'to be rejected').catch(nop).isPending())
            await t.rejects(expect(resolved, 'to be rejected'))

            t.ok(expect(rejected, 'to be rejected').isPending())
            await t.resolves(expect(rejected, 'to be rejected'))

            t.ok(expect(rejected, 'to be fulfilled').catch(nop).isPending())
            await t.rejects(expect(rejected, 'to be fulfilled'))
        })
    })

    await t.only('t.expect (unexpected integration)', async t => {
        // t.runOnly = true

        await t.test('sync', async t => {
            t.expect([123, 'to be', 123])
            t.expect([123, 'to be', 999], {expectFail: true})
            t.expect([exn, 'to throw'])
            t.expect([exn, 'not to throw'], {expectFail: true})
            t.expect([nop, 'to throw'], {expectFail: true})
            t.expect([nop, 'not to throw'])
        })

        await t.only('async', async t => {
            await t.expect([resolved, 'to be fulfilled'])
            await t.expect([resolved, 'not to be fulfilled'], {expectFail: true})
            await t.expect([rejected, 'to be rejected'])
            await t.expect([rejected, 'not to be rejected'], {expectFail: true})
        })
    })

    await t.test('D', async t => {
        t.same(D`1.23`, BigNumber('1.23'),
            `from template literal`)

        t.same(D('1.23'), BigNumber('1.23'),
            `from String`)

        t.throws(() => D(1.23), /number.*accurate.*string/i,
            `rejects Number`)
    })

    await t.test('BigNumber assertion type', async t => {
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
}

run().catch(t.threw)
