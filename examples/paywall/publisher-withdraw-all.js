// ----------------------------------------------------------------------------
// publisher-withdraw-all.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {identity} = require('ramda')
const {log} = require('sprites-channels/fp.js')
const {waitForAccounts} = require('sprites-channels/test-helpers.js')
const Publisher = require('./publisher.js')
const PublisherApp = require('./publisher-app.js')

async function start() {
    const publisher = await PublisherApp.make()
    await waitForAccounts(publisher.sprites.web3Provider)

    const chIds =
        publisher.sprites.offChainReg.db
            .get('channels').map(identity).value()

    for (const {chId} of chIds) {
        log(`Withdrawing from channel ${chId}`)
        const {withdrawn, sprites: {channel}} =
            await Publisher.publisherWithdraw(chId, publisher)
        log(`Withdrawn ${withdrawn} tokens. New channel state:\n`, channel)
    }
}

start()
    .catch(err => console.error(err))
