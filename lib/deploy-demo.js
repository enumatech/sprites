// ----------------------------------------------------------------------------
//
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

require('./globals.js')
const Web3Eth = require('web3-eth')
const Sprites = require('./sprites.js')

const ethUrl = 'http://localhost:8545'

async function deploy() {
    const web3Provider = new Web3Eth.providers.HttpProvider(ethUrl)

    console.error(`Deploying Sprites demo to ${ethUrl}...`)
    const deployment = await Sprites.testDeploy({web3Provider})
    const {preimageManager, reg, token, gas, accounts} = deployment

    const config = {preimageManager, reg, token, gas, accounts}
    console.log(JSON.stringify(config, null, 4))
}

deploy()
    .catch(err => console.error(err))
