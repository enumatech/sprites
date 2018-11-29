// ----------------------------------------------------------------------------
// paywall-server.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {log} = require('sprites/lib/fp.js')
const express = require('express')
const cors = require('cors')
const errorhandler = require('errorhandler')
const {waitForAccounts} = require('sprites/lib/test-helpers.js')
const PaywallApp = require('./paywall-app.js')
const PaywallApi = require('./paywall-api.js')
const serverPort = 3000

async function start() {
    const paywall = await PaywallApp.make()
    const paywallApi = PaywallApi(paywall, express.Router())
    const jsonError = function (error, req, res, next) {
        log(error)
        const {message, stack} = error
        res.send({message, stack})
    }

    const server = express()
        .use(cors())
        .use('/', paywallApi)
        // .use(errorhandler())
        .use(jsonError)

    await waitForAccounts(paywall.sprites.web3Provider)
    await new Promise(resolve => server.listen(serverPort, resolve))
    log(`Paywall API server listening at http://localhost:${serverPort}`)
}

start()
    .catch(err => console.error(err))
