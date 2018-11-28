// ----------------------------------------------------------------------------
//
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {map, assoc, is, toUpper, equals, keys} = require('ramda')
const {thread} = require('./fp.js')
const {inspect} = require('util')
const assert = require('assert')
const low = require('lowdb')
const LowMem = require('lowdb/adapters/Memory')
const ChannelState = require('./channel-state.js')

/**
 * An off-chain Sprites registry stores the latest states of  on-chain channels
 * of a specific player in a specific on-chain Sprites registry on a specific
 * Ethereum network.
 *
 * It can return the latest state for a channel ID or it can return all
 * channel IDs with an other player, so we can pick one.
 * */
class OffChainRegistry {
    constructor({netId, reg, ownAddress, db = new low(new LowMem())} = {}) {
        db.defaults({
            channels: {},
            channelsWith: {}
        }).write()

        Object.assign(this, {netId, reg, ownAddress, db})
    }

    async ch(chId) {
        return this.db.get('channels').get(chId.toString()).value()
    }

    async update(channel) {
        const {chId, players: [p1, p2]} = channel
        const chIdStr = chId.toString()
        const {ownAddress, db} = this
        const channels = db.get('channels')
        const channelsWith = db.get('channelsWith')

        assert(is(Number, chId),
            `chId is not a number: ${chId} in\n${inspect(channel)}`)
        const otherPlayer = equals(toUpper(ownAddress), toUpper(p1)) ? p2 : p1
        // Since the `Set` data type is not preserved when using the
        // `LocalStorage` lowdb adapter, we simulate it with `{elem: true}`
        // objects and the set elements are simply the keys of that objects.
        channelsWith.update(otherPlayer, assoc(chIdStr, true)).write()
        channels.set(chIdStr, channel).write()
        return channel
    }

    async with(player) {
        return thread(
            this.db
                .get('channelsWith')
                .get(player)
                .value(),
            keys,
            map(parseInt))
    }

    // [inspect.custom](depth) {
    //     return map(assoc(inspect.custom, ChannelState.inspector), this.channels)
    // }
}

module.exports = OffChainRegistry
