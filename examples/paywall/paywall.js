// ----------------------------------------------------------------------------
// paywall.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {curry} = require('ramda')
const ChannelState = require('sprites/lib/channel-state.js')
const Sprites = require('sprites')

const Paywall = {
    /**
     * Returns the paywall actor with sprites channel identified by `chId`.
     * */
    channel: curry(async (chId, actor) => ({
        ...actor,
        sprites: await Sprites.channelState({...actor.sprites, chId})
    })),

    /**
     * Returns the off-chain balance of current actor of the channel,
     * regardless of its player index.
     *
     * It's meant to be a testing convenience, hence not chainable.
     * */
    balance: curry(async (chId, actor) => {
        const {sprites} = await Paywall.channel(chId, actor)
        return ChannelState.balance(Sprites.ownIdx(sprites), sprites.channel)
    })
}

module.exports = Paywall
