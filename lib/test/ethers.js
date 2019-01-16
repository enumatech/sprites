require('../globals')
const {t, D, ethers, testChain, inspect} = require('./helpers.js')
const Sprites = require('../sprites.js')

t.test('ethers', async t => {
    const chain = testChain()
    const spritesContracts = await Sprites.testEthersDeploy(chain)
    const Alice = await Sprites.randomTestClient('Alice', spritesContracts)
    const Bob = await Sprites.randomTestClient('Bob', spritesContracts)
    const Eve = await Sprites.randomTestClient('Eve', spritesContracts)
    t.comment(await Promise.all(map(Sprites.balances, [Alice, Bob, Eve])))

    // await Promise.all(times(()=>Sprites.randomTestClient('x', spritesContracts), 100))

    // return Sprites.make({
    //     web3Provider,
    //     accounts: {DEPLOYER, Alice, BOB, EVE},
    //     ...map(prop('address'), {preimageManager, reg, token}),
    //     [inspect.custom]: Sprites.inspector
    // })
})
