// ----------------------------------------------------------------------------
// paywall-withdraw-all.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {identity} = require('ramda')
const {log} = require('sprites/lib/fp.js')
const {waitForAccounts} = require('sprites/lib/test-helpers.js')
const Paywall = require('./paywall.js')
const PaywallApp = require('./paywall-app.js')

async function start() {
    const paywall = await PaywallApp.make()
    await waitForAccounts(paywall.sprites.web3Provider)

    const chIds =
        paywall.sprites.offChainReg.db
            .get('channels').map(identity).value()

    for (const {chId} of chIds) {
        log(`Withdrawing from channel ${chId}`)
        const ch = await Paywall.withdraw(chId, paywall)
        log(ch.sprites.channel)
    }
}

start()
    .catch(err => console.error(err))
