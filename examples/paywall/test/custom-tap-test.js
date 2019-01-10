const t = require('./custom-tap.js')

t.test('Unexpected integration', async t => {
    await t.test('passing assertions', async t=> {
        t.ok(await t.expect([1, 'to be', 1]),
            'sync')

        await t.resolves(
            t.expect([Promise.resolve(1), 'to be fulfilled with', 1]),
            'async')
    })

    await t.skip('failing assertions', async t=> {
        await t.resolves(
            t.expect([1, 'to be', 2]),
            'synchronous assertions fail')

        await t.expect([Promise.resolve(1), 'to be fulfilled with', 2])
        'async assertions fail'
    })
}).catch(t.threw)
