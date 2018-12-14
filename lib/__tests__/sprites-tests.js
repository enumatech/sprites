// ----------------------------------------------------------------------------
// sprites-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {curry, prop, assoc, assocPath, pipeP} = require('ramda')
const {thread, threadP} = require('../fp.js')
const {inspect} = require('util')
const Web3Eth = require('web3-eth')
const {
    makeProvider, ZERO_ADDR, ZERO_BYTES32, waitForAccounts
} = require('../test-helpers.js')
const ChannelState = require('../channel-state.js')
const Sprites = require('../sprites.js')
const OffChainRegistry = require('../off-chain-registry.js')

async function mineDummyBlock(eth, account) {
    return eth.sendTransaction({from: account, to: account})
}

async function waitForDispute(sprites) {
    const {web3Provider} = sprites
    const eth = new Web3Eth(web3Provider)
    const [DEPLOYER] = await waitForAccounts(web3Provider)
    for (let i = 0; i < 5; i++) {
        // console.log(`Mining dummy block ${i}`)
        await mineDummyBlock(eth, DEPLOYER)
    }
    return sprites
}

async function nonce({web3Provider, ownAddress}) {
    const eth = new Web3Eth(web3Provider)
    return eth.getTransactionCount(ownAddress)
}

const confirmWith = curry(async (them, cmd, us) => {
    const us1 = await threadP(us,
        Sprites.channelState,
        cmd,
        Sprites.sign,
        Sprites.save)
    const {chId, channel} = us1

    // Have the counter-party blindly acknowledge our command
    const them1 = await threadP({...them, chId, channel},
        Sprites.sign,
        Sprites.save)

    return Sprites.save({...us1, channel: them1.channel})
})

describe('Sprites', () => {
    let Alice, Bob, Eve, web3Provider

    beforeAll(async () => {
        web3Provider = makeProvider()
        const {accounts: {ALICE, BOB, EVE}, ...spritesTemplate} =
            await Sprites.testDeploy({web3Provider})

        Alice = thread(spritesTemplate,
            assoc('ACTOR_NAME', 'Alice'),
            assoc('ownAddress', ALICE),
            assoc('offChainReg', new OffChainRegistry({ownAddress: ALICE})),
            Sprites.withWeb3Contracts,
            Sprites.withRemoteSigner)

        Bob = thread(spritesTemplate,
            assoc('ACTOR_NAME', 'Bob'),
            assoc('ownAddress', BOB),
            assoc('offChainReg', new OffChainRegistry({ownAddress: BOB})),
            Sprites.withWeb3Contracts,
            Sprites.withRemoteSigner)

        Eve = thread(spritesTemplate,
            assoc('ACTOR_NAME', 'Eve'),
            assoc('ownAddress', EVE),
            assoc('offChainReg', new OffChainRegistry({ownAddress: EVE})),
            Sprites.withWeb3Contracts,
            Sprites.withRemoteSigner)
    })

    afterAll(() => web3Provider.connection.destroy())

    describe('Prerequisites', () => {
        it('ALICE is funded', async () => {
            expect.assertions(1)
            await expect(Sprites.tokenBalance(Alice))
                .resolves.toHaveProperty('tokenBalance', 1e3)
        })
    })

    describe('.make', () => {
        it('works without params', () => {
            expect(Sprites.make()).toMatchObject({
                web3Provider: undefined,
                gas: 4e6,
                preimageManager: undefined,
                reg: undefined,
                token: undefined,
                ownAddress: undefined,
                offChainReg: undefined,

                chId: undefined,
                channel: undefined,
                tx: undefined,
                tokenBalance: undefined
            })
        })

        it('merges its options parameter into the result', () => {
            expect(Sprites.make({param: 1})).toMatchObject({param: 1})
        })
    })

    describe('.contract', () => {
        it('fails with invalid contract name', async () => {
            expect(() => Sprites.contract('<instance>', '<contract-type>'))
                .toThrowError(/<contract-type>.+SpritesRegistry/)
        })
    })

    describe('.withRemoteSigner', () => {
        describe('when inspected, the signer function in the output', () => {
            const ownAddress = '<address>'
            const inspectSignFn = (spritesOpts) =>
                thread({ownAddress, ...spritesOpts},
                    Sprites.make,
                    Sprites.withRemoteSigner,
                    prop('sign'),
                    inspect)

            it('contains the actor name instead of the address', async () => {
                const ACTOR_NAME = '<actor name>'
                let output = inspectSignFn({ACTOR_NAME})
                expect(output).toContain(ACTOR_NAME)
                expect(output).not.toContain(ownAddress)
            })

            it('contains the actor name', async () => {
                expect(inspectSignFn()).toContain(ownAddress)
            })
        })
    })

    describe('.ownIdx', () => {
        const ch = Sprites.make({ownAddress: 'own'})

        describe('when address is a participant in the channel', () => {
            it('returns either 0 or 1', async () => {
                const ch0 = assocPath(['channel', 'players'], ['own', 'other'], ch)
                expect(Sprites.ownIdx(ch0)).toEqual(0)

                const ch1 = assocPath(['channel', 'players'], ['other', 'own'], ch)
                expect(Sprites.ownIdx(ch1)).toEqual(1)
            })
        })

        describe('when address is not a participant in the channel', () => {
            it('throws', async () => {
                const ch0 = assocPath(['channel', 'players'], ['p1', 'p2'], ch)
                expect(() => Sprites.ownIdx(ch0))
                    .toThrowError(new RegExp(
                        `${ch0.ownAddress}.+not.+in channel[^]+p1[^]+p2`, 'm'))
            })
        })

        describe('when address is missing', () => {
            it('throws', async () => {
                const ch0 = assoc('ownAddress', null, ch)
                expect(() => Sprites.ownIdx(ch0))
                    .toThrowError(new RegExp('address.+missing'))
            })
        })

        describe('when players are missing', () => {
            it('throws', async () => {
                const ch0 = assocPath(['channel', 'players'], null, ch)
                expect(() => Sprites.ownIdx(ch0))
                    .toThrowError(new RegExp('actors.+missing'))
            })
        })
    })

    describe('.channelOnChain', () => {
        describe('with invalid channel ID', () => {
            it('fails', async () => {
                /* Non-existent channel ID, because we should never
                * create so many channels within the unit test suite */
                const chId = 1e10
                const unknownChErr = new RegExp(`Unknown channel ${chId}`)
                await expect(Sprites.channelOnChain({...Alice, chId})).rejects
                    .toThrowError(unknownChErr)
            })
        })
    })

    describe('.transition', () => {
        let transition
        beforeAll(() => transition = jest.spyOn(ChannelState, 'transition'))
        afterAll(() => transition.mockRestore())

        it('transitions the channel property', () => {
            const sprites = Sprites.make({channel: '<input channel>'})
            const xforms = '<xforms>'
            ChannelState.transition.mockImplementationOnce(
                curry((xforms, ch) => '<transformed channel>'))

            expect(Sprites.transition(xforms, sprites))
                .toMatchObject({channel: '<transformed channel>'})

            //// Can't verify the `sprites` argument, because of the currying
            // expect(transition).toBeCalledWith(xforms, sprites)
            expect(transition).toBeCalledWith(xforms)
        })
    })

    it('.create', async () => {
        const {chId, channel} = await threadP(Alice,
            Sprites.create(Bob.ownAddress),
            Sprites.channelOnChain)

        expect(channel).toMatchObject({
            chId,
            deposits: [0, 0],
            credits: [0, 0],
            withdrawals: [0, 0],
            withdrawn: [0, 0],
            round: -1,
            amount: 0,
            expiry: 0,
            preimageHash: ZERO_BYTES32,
            recipient: ZERO_ADDR,
            players: [Alice.ownAddress, Bob.ownAddress]
        })
    })

    it('.deposit', async () => {
        const amt = 10
        const {tokenBalance: balanceBeforeDeposit} = await Sprites.tokenBalance(Alice)

        const Alice1 = await threadP(Alice,
            Sprites.create(Bob.ownAddress),
            Sprites.approve(amt),
            Sprites.deposit(amt),
            Sprites.channelOnChain,
            Sprites.tokenBalance)

        expect(Alice1).toHaveProperty('channel.deposits', [amt, 0])
        expect(Alice1.tokenBalance).toEqual(balanceBeforeDeposit - amt)
    })

    describe('.update', () => {
        it('works', async function () {
            const amt = 10

            const Alice1 = await threadP(Alice,
                Sprites.approve(amt),
                Sprites.createWithDeposit(Bob.ownAddress, amt),
                Sprites.channelState,
                Sprites.cmd.withdraw(3),
                Sprites.sign)

            const {chId} = Alice1

            const Bob1 = await threadP(
                {...Bob, chId, channel: Alice1.channel},
                Sprites.sign)

            const Alice2 = {...Alice1, channel: Bob1.channel}

            expect(await Sprites.verifyUpdate(Alice2))
                .toEqual(true)

            expect(await Sprites.update(Alice2))
                .toHaveProperty("tx.status", true)

            expect(await Sprites.channelOnChain(Alice2))
                .toHaveProperty("channel.withdrawals", [3, 0])
        })

        it('withdrawal', async () => {
            const amt = 10
            const Alice1 = await threadP(Alice,
                Sprites.create(Bob.ownAddress),
                Sprites.approve(amt),
                Sprites.deposit(amt),
                confirmWith(Bob, Sprites.cmd.withdraw(amt)))

            expect.assertions(3)

            expect(await Sprites.verifyUpdate(Alice1))
                .toEqual(true)

            expect(await Sprites.update(Alice1))
                .toHaveProperty("tx.status", true)

            expect(await Sprites.channelOnChain(Alice1))
                .toHaveProperty("channel.withdrawals", [amt, 0])
        })
    })

    describe('.withdraw', () => {
        it('total amount cooperatively', async () => {
            const amt = 10
            const {tokenBalance: balanceBeforeDeposit} = await Sprites.tokenBalance(Alice)

            const Alice1 = await threadP(Alice,
                Sprites.create(Bob.ownAddress),
                Sprites.approve(amt),
                Sprites.deposit(amt),
                confirmWith(Bob, Sprites.cmd.withdraw(amt)),
                Sprites.update,
                Sprites.withdraw,
                Sprites.channelState,
                Sprites.tokenBalance)

            expect(Alice1.channel).toHaveProperty('withdrawn', [amt, 0])
            expect(Alice1.tokenBalance).toEqual(balanceBeforeDeposit)
        })

        describe('remaining amounts cooperatively after off-chain payment', () => {
            it('using primitive methods', async () => {
                const amt = 10
                const {tokenBalance: AlicesInitialBalance} = await Sprites.tokenBalance(Alice)
                const {tokenBalance: BobsInitialBalance} = await Sprites.tokenBalance(Bob)

                const Alice1 = await threadP(Alice,
                    Sprites.create(Bob.ownAddress),
                    Sprites.approve(amt),
                    Sprites.deposit(amt),
                    confirmWith(Bob, Sprites.cmd.pay(3)),
                    confirmWith(Bob, Sprites.cmd.withdraw(amt - 3)),
                    Sprites.update,
                    Sprites.withdraw,
                    Sprites.channelState,
                    Sprites.tokenBalance)
                const {chId} = Alice1

                expect(Alice1.tokenBalance).toEqual(AlicesInitialBalance - 3)
                expect(Alice1.channel).toHaveProperty('withdrawn', [amt - 3, 0])

                const Bob1 = await threadP({...Bob, chId},
                    confirmWith(Alice1, Sprites.cmd.withdraw(3)),
                    Sprites.update,
                    Sprites.withdraw,
                    Sprites.channelState,
                    Sprites.tokenBalance)

                expect(Bob1.tokenBalance).toEqual(BobsInitialBalance + 3)
                expect(Bob1.channel).toHaveProperty('withdrawn', [amt - 3, 3])
            })

            it('using combined methods', async () => {
                const amt = 10
                const startNonce = await nonce(Alice)
                const {tokenBalance: AlicesInitialBalance} = await Sprites.tokenBalance(Alice)
                const {tokenBalance: BobsInitialBalance} = await Sprites.tokenBalance(Bob)

                const Alice1 = await threadP(Alice,
                    Sprites.approve(amt),
                    Sprites.createWithDeposit(Bob.ownAddress, amt))
                const {chId} = Alice1

                const Bob1 = await threadP({...Bob, chId},
                    confirmWith(Alice1, Sprites.cmd.invoice(3)),
                    Sprites.updateAndWithdraw,
                    Sprites.channelState,
                    Sprites.tokenBalance)

                expect(Bob1.tokenBalance).toEqual(BobsInitialBalance + 3)
                expect(Bob1.channel).toHaveProperty('withdrawn', [0, 3])

                const Alice2 = await threadP(Alice1,
                    confirmWith(Bob1, Sprites.cmd.withdraw(amt - 3)),
                    Sprites.updateAndWithdraw,
                    Sprites.channelState,
                    Sprites.tokenBalance)

                expect(Alice2.tokenBalance).toEqual(AlicesInitialBalance - 3)
                expect(Alice2.channel).toHaveProperty('withdrawn', [amt - 3, 3])

                expect((await nonce(Alice2)) - startNonce)
                    .toBeLessThanOrEqual(3)
            })
        })

        it('non-cooperatively', async () => {
            const amt = 10
            const {tokenBalance: AlicesInitialBalance} = await Sprites.tokenBalance(Alice)

            const Alice1 = await threadP(Alice,
                Sprites.approve(amt),
                Sprites.createWithDeposit(Bob.ownAddress, amt),
                confirmWith(Bob, Sprites.cmd.pay(3)))
            // Alice has her payment accepted by Bob at this stage

            const Alice2 = await threadP(Alice1,
                Sprites.cmd.withdraw(7),
                Sprites.sign,
                // and she tries to get Bob sign a withdrawal,
                // but Bob is not available
                Sprites.save)

            // so Alice triggers a dispute with her previous confirmed state
            const Alice3 = await threadP(Alice1,
                Sprites.update,
                Sprites.trigger,
                waitForDispute,
                Sprites.finalize,
                Sprites.withdraw,
                Sprites.channelState,
                Sprites.tokenBalance)

            expect(Alice3.tokenBalance).toEqual(AlicesInitialBalance - 3)
            expect(Alice3.channel).toHaveProperty('withdrawn', [amt - 3, 0])
        })

        describe('by receiver, from multiple channels', () => {
            it('takes multiple transactions', async () => {
                jest.setTimeout(10000)
                const {tokenBalance: BobsInitialBalance} = await Sprites.tokenBalance(Bob)

                const channelWithBob = async (someone) =>
                    threadP(someone,
                        Sprites.approve(10),
                        Sprites.createWithDeposit(Bob.ownAddress, 10),
                        Sprites.channelState)

                const payToBob = async (someone) => {
                    const {chId} = someone
                    await threadP(someone,
                        confirmWith(Bob, Sprites.cmd.pay(3)),
                        confirmWith(Bob, Sprites.cmd.withdraw(7)))

                    await threadP({...Bob, chId},
                        confirmWith(someone, Sprites.cmd.withdraw(3)))

                    return Sprites.channelState(someone)
                }

                const withdrawByBob = async ({chId}) =>
                    threadP({...Bob, chId},
                        Sprites.channelState,
                        Sprites.updateAndWithdraw)

                // await Promise.all([Alice, Eve]
                //     .map(pipeP(channelWithBob, payToBob, withdrawByBob)))
                await threadP(Alice, channelWithBob, payToBob, withdrawByBob)
                await threadP(Eve, channelWithBob, payToBob, withdrawByBob)

                expect(await Sprites.tokenBalance(Bob))
                    .toHaveProperty('tokenBalance', BobsInitialBalance + 3 + 3)
            })
        })
    })
})
