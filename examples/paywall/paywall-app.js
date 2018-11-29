// ----------------------------------------------------------------------------
// paywall-app.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {thread} = require('sprites/lib/fp.js')
const Path = require('path')
const Jayson = require('sprites/lib/jayson.js')
const {makeProvider} = require('sprites/lib/test-helpers.js')
const low = require('lowdb')
const LowFile = require('lowdb/adapters/FileAsync')
const OffChainRegistry = require('sprites/lib/off-chain-registry.js')
const Sprites = require('sprites')
const Paywall = require('./paywall.js')
const demoCatalog = require('./demo-catalog.js')

const ethUrl = 'http://localhost:8545'
const web3Provider = makeProvider(ethUrl)
let spritesConfigFile = Path.join(__dirname, 'sprites-config.json')
const {accounts, ...spritesConfig} = Jayson.load(spritesConfigFile)
const ownAddress = accounts.BOB

const PaywallApp = {
    async make() {
        const spritesDbPath = Path.join(__dirname, 'paywall-db.json')
        const spritesDb = await low(new LowFile(spritesDbPath))
        return {
            ...Paywall.new(),
            db: demoCatalog,
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
    }
}

module.exports = PaywallApp
