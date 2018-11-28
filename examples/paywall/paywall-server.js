// ----------------------------------------------------------------------------
//
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {map, indexBy, prop, range} = require('ramda')
const {log, thread} = require('sprites/lib/fp.js')
const Path = require('path')
const express = require('express')
const cors = require('cors')
const errorhandler = require('errorhandler')
const Jayson = require('sprites/lib/jayson.js')
const Web3Eth = require('web3-eth')
const {waitForAccounts} = require('sprites/lib/test-helpers.js')
const low = require('lowdb')
const LowFile = require('lowdb/adapters/FileAsync')
const OffChainRegistry = require('sprites/lib/off-chain-registry.js')
const Sprites = require('sprites')
const Paywall = require('./paywall.js')
const PaywallApi = require('./paywall-api.js')
const LoremIpsum = require('lorem-ipsum')
const serverPort = 3000
const ethUrl = 'http://localhost:8545'
const web3Provider = new Web3Eth.providers.HttpProvider(ethUrl)
const {accounts, ...spritesConfig} =
    Jayson.load(Path.join(__dirname, 'sprites-config.json'))

const newArticle = (id) => {
    const content = LoremIpsum({count: 5, units: 'paragraphs'})
    return {
        id: `aId-${id}`,
        price: 10 + id,
        title: LoremIpsum({count: 5, units: 'words'}),
        content: content,
        blurb: content.split('\n')[0]
    }
}

const Articles = map(newArticle, range(0, 2 + 1))
const ArticleDB = indexBy(prop('id'), Articles)

const ownAddress = accounts.BOB

async function start() {
    const spritesDbPath = Path.join(__dirname, 'paywall-db.json')
    const spritesDb = await low(new LowFile(spritesDbPath))
    const paywall = {
        ...Paywall.new(),
        db: ArticleDB,
        sprites: thread({
                ...spritesConfig,
                web3Provider,
                ACTOR_NAME: 'Paywall Operator',
                ownAddress,
                offChainReg: new OffChainRegistry({
                    ownAddress,
                    db: spritesDb
                })
            },
            Sprites.withRemoteSigner,
            Sprites.withWeb3Contracts),
    }

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

    await waitForAccounts(web3Provider)
    await new Promise(resolve => server.listen(serverPort, resolve))
    log(`Paywall API server listening at http://localhost:${serverPort}`)
}

start()
    .catch(err => console.error(err))
