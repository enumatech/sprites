// ----------------------------------------------------------------------------
// publisher-api.js
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
 * which will use the `publisher` parameter to do their job.
 * */
function PublisherApi(publisher, router) {
    router = decorateApp(router)
    JSON.parse = Jayson.parse('Smart JSON parser')
    router.use(bodyParser.json())

    router.getAsync('/config', async (req, res) => {
        res.json(Publisher.config(publisher))
    })

    router.getAsync('/catalog', async (req, res) => {
        res.json(await Publisher.catalog(publisher))
    })

    router.postAsync('/invoice', async ({body: order}, res) => {
        const {invoice} = await Publisher.invoice(order, publisher)
        res.json(invoice)
    })

    router.postAsync('/payment', async ({body: payment}, res) => {
        const {paymentReceipt} =
            await Publisher.processPayment(payment, publisher)
        res.json(paymentReceipt)
    })

    router.postAsync('/article', async ({body: receipt}, res) => {
        const {article} = await Publisher.getArticle(receipt, publisher)
        res.json(article)
    })

    // Demo endpoints.
    // They shouldn't exist in a real deployment without authorization!
    router.postAsync('/publisher-withdraw', async ({body: {chId}}, res) => {
        // chId is wrapped into an object because `bodyParser.json()`  throws
        // when it encounters a naked number.
        const {withdrawn} = await Publisher.publisherWithdraw(chId, publisher)
        res.json({withdrawn})
    })

    return router
}

module.exports = PublisherApi
