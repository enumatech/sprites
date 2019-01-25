require('../../globals')
require('process').env.UNEXPECTED_DEPTH = 5
const {t, expect, I, ethers, testChain, inspect} = require('../helpers.js')
const {utils: {parseEther}} = ethers
const Sprites = require('../../sprites.js')

// t.runOnly = true

const transact = (contractMethodCall) =>
    contractMethodCall.then(tx => tx.wait())

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
                    sprites.ethersToken.address)),
            'to satisfy',
            {
                events: [{
                    event: 'EventInit',
                    args: {
                        chId: I`0`
                    }
                }]
            }
        ], `channel ID is 0`)
    })

    await t.test('#createWithDeposit', async t => {
        const deposit = I`10`

        await transact(
            Alice.ethersToken.approve(Alice.ethersRegistry.address, deposit))

        const balanceBefore =
            await Alice.ethersToken.balanceOf(Alice.wallet.address)

        t.expect([
            await transact(
                Alice.ethersRegistry.createWithDeposit(
                    Bob.wallet.address,
                    sprites.ethersToken.address,
                    deposit)),
            'to satisfy',
            {
                events: expect
                    .it('to have an item satisfying', {
                        event: 'EventInit'
                    })
                    .and('to have an item satisfying', {
                        event: 'Transfer',
                        args: {
                            _from: Alice.wallet.address,
                            _to: Alice.ethersRegistry.address,
                            _value: deposit
                        }
                    })
            }
        ], `emits EventInit and Transfer events`)

        await t.expect([
            Alice.ethersToken.balanceOf(Alice.ethersRegistry.address),
            'when fulfilled', 'to equal', deposit
        ], `adds deposit to registry balance`)

        await t.expect([
            Alice.ethersToken.balanceOf(Alice.wallet.address),
            'when fulfilled', 'to be less than or equal to',
            balanceBefore.sub(deposit)
        ], `deducts deposit from channel opener`)
    })
}

run().catch(t.threw)
