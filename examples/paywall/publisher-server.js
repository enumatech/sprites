// ----------------------------------------------------------------------------
// publisher-server.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {log} = require('sprites-channels/fp.js')
const express = require('express')
const cors = require('cors')
const errorhandler = require('errorhandler')
const {waitForAccounts} = require('sprites-channels/test-helpers.js')
const PublisherApp = require('./publisher-app.js')
const PublisherApi = require('./publisher-api.js')
const serverPort = 3000

async function start() {
    const publisher = await PublisherApp.make()
    const publisherApi = PublisherApi(publisher, express.Router())
    const jsonError = function (error, req, res, next) {
        log(error)
        const {message, stack} = error
        res.send({message, stack})
    }

    const server = express()
        .use(cors())
        .use('/', publisherApi)
        // .use(errorhandler())
        .use(jsonError)

    await waitForAccounts(publisher.sprites.web3Provider)
    await new Promise(resolve => server.listen(serverPort, resolve))
    log(`Paywall API server listening at http://localhost:${serverPort}`)
}

start()
    .catch(err => console.error(err))
