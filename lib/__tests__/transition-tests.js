// ----------------------------------------------------------------------------
// transition-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {curry, prop, assoc, dissoc, assocPath, dissocPath} = require('ramda')
const {log, probe, thread, threadP} = require('../fp.js')
const {inspect} = require('util')
const {makeProvider} = require('../test-helpers.js')
const Sprites = require('../sprites.js')
const OffChainRegistry = require('../off-chain-registry.js')

describe.skip('Sprites channel state transition', () => {
    let Alice, Bob, web3Provider

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
    })

    afterAll(() => web3Provider.connection.destroy())

    describe('proposal', () => {
        let proposal, chBefore, chAfter

        const amt = 10
        const cmds = [{name: 'credit', params: [1, 2]}]

        const propose = (channel) =>
            Sprites.propose(cmds, {...Alice, chId: channel.chId, channel})

        beforeAll(async () =>
            ({channel: chBefore} = await threadP(Alice,
                Sprites.approve(amt),
                Sprites.createWithDeposit(Bob.ownAddress, amt),
                Sprites.channelState)))

        beforeAll(async () =>
            ({proposal, channel: chAfter} = await propose(chBefore)))

        it('is rejected without a round number', () =>
            expect(propose(dissoc('round', chBefore)))
                .rejects.toThrowError(/round/i))

        it('is rejected without a channel ID', () =>
            expect(propose(dissoc('chId', chBefore)))
                .rejects.toThrowError(/chId/i))

        it('is only signed by the proposer', async () => {
        })
    })
})


/*

propose(chId, cmds, sigs, sprite1):
    sprites = channelState(chId, {chain, offChainReg, ownAddr}=sprite1)
    idx = ownIdx(sprites)
    nextChannel = apply(cmds, sprites.channel)
    sig = sign(nextChannel)
    sigs[idx] = sig
    proposal = {chId, round, cmds, sigs}

agree(proposal, sprites):
    agreement = {chId, round, cmds, sigs}

execute(agreement, sprites):
    channel = {chId, round, sigs, ...channelState}
* */
