const t = require('../tap.js')
const expect = require('unexpected')

// t.runOnly = true
// t.reporter('classic')

async function run() {
    // @formatter:off
    // `bomb` is extracted to simplify automatic assertion message
    const bomb = () => { throw Error() }
    // @formatter:on
    const exn = () => bomb()
    const nop = () => 0
    const resolved = () => Promise.resolve(123)
    const rejected = () => Promise.reject(Error())

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

    await t.test('t.expect (unexpected integration)', async t => {
        const toFail = {expectFail: true}

        await t.test('sync', async t => {
            t.expect([123, 'to be', 123])
            t.expect([123, 'to be', 999], toFail)
            t.expect([exn, 'to throw'])
            t.expect([exn, 'not to throw'], toFail)
            t.expect([nop, 'not to throw'])
            t.expect([nop, 'to throw'], toFail)
        })

        await t.test('async', async t => {
            await t.expect([resolved, 'to be fulfilled'])
            await t.expect([resolved, 'to be rejected'], toFail)
            await t.expect([rejected, 'to be rejected'])
            await t.expect([rejected, 'to be fulfilled'], toFail)
        })
    })
}

run().catch(t.threw)
