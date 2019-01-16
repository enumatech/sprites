require('../globals')
const {t, D, ethers, testChain} = require('./helpers.js')
const {utils: {parseEther}} = ethers
const Sprites = require('../sprites.js')

const run = async () => {
    const chain = testChain()
    const spritesContracts = await Sprites.testEthersDeploy(chain)
    const Alice = await Sprites.randomTestClient('Alice', spritesContracts)

    t.expect([
        await Sprites.balances(Alice),
        'to satisfy',
        {
            ETH: parseEther('10'),
            DAI: D`1000`
        }])
}

run().catch(t.threw)
