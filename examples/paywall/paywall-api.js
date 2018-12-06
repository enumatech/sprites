// ----------------------------------------------------------------------------
// paywall-api.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const bodyParser = require('body-parser')
const {decorateApp} = require('@awaitjs/express')
const Publisher = require('./publisher.js')
const Jayson = require('sprites/lib/jayson')

/**
 * Returns the `router` object with API routes defined on it,
 * which will use the `paywall` parameter to do their job.
 * */
function PaywallApi(paywall, router) {
    router = decorateApp(router)
    JSON.parse = Jayson.parse('Smart JSON parser')
    router.use(bodyParser.json())

    router.getAsync('/config', async (req, res) => {
        res.json(Publisher.config(paywall))
    })

    router.getAsync('/catalog', async (req, res) => {
        res.json(await Publisher.catalog(paywall))
    })

    router.postAsync('/invoice', async ({body: order}, res) => {
        const {invoice} = await Publisher.invoice(order, paywall)
        res.json(invoice)
    })

    router.postAsync('/payment', async ({body: payment}, res) => {
        const {paymentReceipt} =
            await Publisher.processPayment(payment, paywall)
        res.json(paymentReceipt)
    })

    router.postAsync('/article', async ({body: receipt}, res) => {
        const {article} = await Publisher.getArticle(receipt, paywall)
        res.json(article)
    })

    // Demo endpoints.
    // They shouldn't exist in a real deployment without authorization!
    router.postAsync('/publisher-withdraw', async ({body: {chId}}, res) => {
        // chId is wrapped into an object because `bodyParser.json()`  throws
        // when it encounters a naked number.
        const {withdrawn} = await Publisher.publisherWithdraw(chId, paywall)
        res.json({withdrawn})
    })

    return router
}

module.exports = PaywallApi
