require('../../globals')
const {t, expect, I, ethers, testChain} = require('../helpers.js')
const {utils: {parseEther}} = ethers
const Sprites = require('../../sprites.js')

const transact = (contractMethodCall) =>
    contractMethodCall.then(receipt => receipt.wait())

const run = async () => {
    const chain = testChain()
    const sprites = await Sprites.testEthersDeploy(chain)
    const Alice = await Sprites.randomTestClient('Alice', sprites)
    const Bob = await Sprites.randomTestClient('Bob', sprites)

    await t.test('#create', async t => {
        t.expect([
                await transact(
                    Alice.ethersRegistry.create(
                        Bob.wallet.address,
                        sprites.ethersToken.address))
                , 'to satisfy',
                {
                    events: [{
                        event: 'EventInit',
                        args: {
                            chId: I`0`
                        }
                    }]
                }],
            `channel ID is 0`)
    })

    await t.test('#createWithDeposit', async t => {
        const deposit = I`10`
        await transact(
            Alice.ethersToken.approve(Alice.ethersRegistry.address, deposit))

        t.expect([
            await transact(
                Alice.ethersRegistry.createWithDeposit(
                    Bob.wallet.address,
                    sprites.ethersToken.address,
                    deposit))
            , 'to satisfy',
            {events: expect.it('to have an item satisfying', {event: 'EventInit'})}])
    })
}

run().catch(t.threw)
