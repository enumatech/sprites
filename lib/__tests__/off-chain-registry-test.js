// ----------------------------------------------------------------------------
// off-chain-registry-test.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {keys, assoc, dissoc, inc, concat, reverse} = require('ramda')
const {update, updatePath, thread} = require('../fp.js')
const OffChainRegistry = require('../off-chain-registry.js')
const ChannelState = require('../channel-state.js')

describe('OffChainRegistry', () => {
    let reg
    const Player1 = 'Player 1'
    const Player2 = 'Player 2'
    const ch1 = {...ChannelState.make(), chId: 1, players: [Player1, Player2]}

    beforeEach(async () => {
        reg = new OffChainRegistry({ownAddress: Player1})
    })

    describe('constructor', () => {
        it('initializes the db', async () => {
            expect(reg.db.getState())
                .toMatchObject({
                    channels: {},
                    channelsWith: {}
                })
        })
    })

    describe('.ch', () => {
        it('works', async () => {
            await reg.update(ch1)
            expect(keys(reg.db.get('channelsWith').get(ch1.players[1]).value()))
                .toContainEqual(ch1.chId.toString())
            await expect(reg.ch(ch1.chId))
                .resolves.toMatchObject(ch1)
        })
    })

    describe('.with', () => {
        it('returns empty array when no channels found', async () => {
            await expect(reg.with(Player2)).resolves.toEqual([])
        })

        it('return all existing channel IDs', async () => {
            const ch2 = update('chId', inc, ch1)
            await reg.update(ch1)
            await reg.update(ch2)
            await expect(reg.with(Player2))
                .resolves.toEqual([ch1.chId, ch2.chId])
        })

        it('channel IDs are unique', async () => {
            await reg.update(ch1)
            await reg.update(ch1)
            await expect(reg.with(Player2)).resolves.toEqual([ch1.chId])
        })

        it('player order independent', async () => {
            const ch2 = thread(ch1,
                update('chId', inc),
                update('players', reverse))

            await reg.update(ch1)
            await expect(reg.with(Player2))
                .resolves.toEqual([ch1.chId])

            await reg.update(ch2)
            await expect(reg.with(Player2))
                .resolves.toEqual([ch1.chId, ch2.chId])
        })
    })
})

// describe('OffChainRegistry', () => {
//     let reg, chBase
//
//     const Player1= 'player1'
//
//     const ch1 = {
//         ...ChannelState.make(),
//         chId: 1,
//         players: [Player1, "player2"]
//     }
//
//     const expectUnchangedState = async () =>
//         expect(reg.get()).resolves.toEqual(chBase)
//
//     beforeEach(async () => {
//         reg = new OffChainRegistry({ownAddress: Player1})
//         chBase = await reg.get()
//     })
//
//     describe('for the 1st time', () => {
//         it('.get() returns null', async () => {
//             await expect(reg.get()).resolves.toEqual(null)
//         })
//
//         it('.update() expects chId', async () => {
//             await expect(reg.update(dissoc('chId', ch1)))
//                 .rejects.toThrowError(/chId/)
//             await expectUnchangedState()
//         })
//
//         it('chId must be a number', async () => {
//             await expect(reg.update(assoc('chId', 'invalid channel ID', ch1)))
//                 .rejects.toThrowError(/number/)
//             await expectUnchangedState()
//         })
//
//         it('.update() expects players', async () => {
//             await expect(reg.update(dissoc('players', ch1)))
//                 .rejects.toThrowError(/players/)
//             await expectUnchangedState()
//         })
//
//         it('.update(ch) returns ch', async () => {
//             await expect(reg.update(ch1)).resolves.toEqual(ch1)
//         })
//
//         it('after .update(ch), .get() returns ch', async () => {
//             await reg.update(ch1)
//             await expect(reg.get()).resolves.toEqual(ch1)
//         })
//     })
//
//     describe('subsequent .update()', () => {
//         const ch2 = {...ch1, credits: [0, 1]}
//
//         beforeEach(async () => {
//             await reg.update(ch1)
//             chBase = await reg.get()
//         })
//
//         it('overwrites previous value', async () => {
//             await reg.update(ch2)
//             await expect(reg.get()).resolves.toEqual(ch2)
//         })
//
//         it('expects chId to match', async () => {
//             const ch2$ = update('chId', inc, ch2)
//             await expect(reg.update(ch2$)).rejects.toThrowError(/chId/)
//             await expectUnchangedState()
//         })
//
//         it('expects players to match', async () => {
//             const ch2$ = updatePath(['players', 0], concat('other-'), ch2)
//             await expect(reg.update(ch2$)).rejects.toThrowError(/player/)
//             await expectUnchangedState()
//         })
//     })
// })
