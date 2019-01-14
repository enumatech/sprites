// ----------------------------------------------------------------------------
// publisher-app.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {thread} = require('sprites-channels/fp.js')
const Path = require('path')
const Fs = require('fs')
const Jayson = require('sprites-channels/jayson.js')
const {makeProvider} = require('sprites-channels/test-helpers.js')
const low = require('lowdb')
const LowFile = require('lowdb/adapters/FileAsync')
const OffChainRegistry = require('sprites-channels/off-chain-registry.js')
const Sprites = require('sprites-channels')
const Publisher = require('./publisher.js')
const demoCatalog = require('./demo-catalog.js')

const ethUrl = 'http://localhost:8545'
const web3Provider = makeProvider(ethUrl)
const spritesConfigFile = Path.join(__dirname, 'sprites-config.json')
const {accounts, ...spritesConfig} = Jayson.load(spritesConfigFile)
const ownAddress = accounts.BOB

const ErrorFileExists = (path) =>
    new Error(`mkdir: cannot create directory '${path}': File exists`)

const ensureDirExists = (dir) => {
    if (Fs.existsSync(dir)) {
        if (!Fs.statSync(dir).isDirectory())
            throw ErrorFileExists(dir)
    } else {
        Fs.mkdirSync(dir)
    }
}

const offChainRegInit = (dbDir, onChainRegAddr) => {
    // Off-chain registry DB is named after the on-chain registry's address
    const dir = Path.join(__dirname, dbDir)
    const file = onChainRegAddr + '.json'
    // Convenience `latest.json` symlink to the latest db to aid debugging
    const latest = Path.join(dir, 'latest.json')

    ensureDirExists(dir)
    if (Fs.existsSync(latest)) Fs.unlinkSync(latest)
    Fs.symlinkSync(file, latest)
    return Path.join(dir, file)
}

const offChainRegPath = offChainRegInit('off-chain-reg', spritesConfig.reg)

const PublisherApp = {
    async make() {
        const spritesDb = await low(new LowFile(offChainRegPath))
        return Publisher.make({
            db: demoCatalog,
            sprites: thread(
                Sprites.make({
                    ...spritesConfig,
                    web3Provider,
                    ownAddress,
                    offChainReg: new OffChainRegistry({
                        ownAddress,
                        db: spritesDb
                    })
                }),
                Sprites.withRemoteSigner,
                Sprites.withWeb3Contracts),
        })
    }
}

module.exports = PublisherApp
