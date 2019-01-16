/**
 * Run with:
 *     tap -Rtap test/ethers.js test/ethers.js test/ethers.js test/ethers.js -J
 * */

require('../globals')
const {t, D, ethers, testChain} = require('./helpers.js')

return t.pass('ok') // Labs are disabled by default

const {utils: {parseEther}} = ethers
const Sprites = require('../sprites.js')

t.jobs = 4

const run = async () => {
    const chain = testChain()
    const spritesContracts = await Sprites.testEthersDeploy(chain)

    const testScenario = async t => {
        const mkActor = name => Sprites.randomTestClient(name, spritesContracts)
        const actors = await Promise.all(map(mkActor, ['Alice', 'Bob', 'Eve']))
        t.expect([
            await Promise.all(map(Sprites.balances, actors)),
            'to have items satisfying',
            {
                ETH: parseEther('10'),
                DAI: D`1000`
            }])
        await Promise.all(map(Sprites.balances, actors))
        await Promise.all(map(Sprites.balances, actors))
        await Promise.all(map(Sprites.balances, actors))
        await Promise.all(map(Sprites.balances, actors))
        await Promise.all(map(Sprites.balances, actors))
        await Promise.all(map(Sprites.balances, actors))
        await Promise.all(map(Sprites.balances, actors))
        await Promise.all(map(Sprites.balances, actors))
        await Promise.all(map(Sprites.balances, actors))
    }

    t.test('Scenario 0', testScenario)
    t.test('Scenario 1', testScenario)
    t.test('Scenario 2', testScenario)
    t.test('Scenario 3', testScenario)
    t.test('Scenario 4', testScenario)
    t.test('Scenario 5', testScenario)
    t.test('Scenario 6', testScenario)
    t.test('Scenario 7', testScenario)
    t.test('Scenario 8', testScenario)
    t.test('Scenario 9', testScenario)
}

run().catch(t.threw)
