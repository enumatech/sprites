require('../../globals')
const {t, expect, I, ethers, testChain} = require('../helpers.js')
const {utils: {parseEther}} = ethers
const Sprites = require('../../sprites.js')

const run = async () => {
    const chain = testChain()
    const sprites = await Sprites.testEthersDeploy(chain)
    const Alice = await Sprites.randomTestClient('Alice', sprites)
    const Bob = await Sprites.randomTestClient('Bob', sprites)

    await t.expect([
        Sprites.balances(Alice),
        'to be fulfilled with',
        {ETH: parseEther('10'), DAI: I`1000`}
    ])

    await t.test('#create', async t => {
        const tx = await Alice.ethersRegistry.create(
            Bob.wallet.address,
            sprites.ethersToken.address)
        const txr = await tx.wait()
        t.expect([txr, 'to satisfy', {
                events: [{
                    args: {
                        chId:
                            expect.it('to be greater than', I`0`)
                    }
                }]
            }],
            `channel ID is 0`)
    })

}

run().catch(t.threw)
