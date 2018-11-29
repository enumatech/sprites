// ----------------------------------------------------------------------------
// paywall-api.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const bodyParser = require('body-parser')
const {decorateApp} = require('@awaitjs/express')
const Paywall = require('./paywall.js')

/**
 * Returns the `router` object with API routes defined on it,
 * which will use the `paywall` parameter to do their job.
 * */
function PaywallApi(paywall, router) {
    router = decorateApp(router)
    router.use(bodyParser.json())

    router.getAsync('/config', async (req, res) => {
        res.json(Paywall.config(paywall))
    })

    router.getAsync('/catalog', async (req, res) => {
        res.json(await Paywall.catalog(paywall))
    })

    router.postAsync('/invoice', async ({body: order}, res) => {
        const {invoice} = await Paywall.invoice(order, paywall)
        res.json(invoice)
    })

    router.postAsync('/payment', async ({body: payment}, res) => {
        const {paymentReceipt} = await Paywall.processPayment(payment, paywall)
        res.json(paymentReceipt)
    })

    router.postAsync('/article', async ({body: receipt}, res) => {
        const {article} = await Paywall.getArticle(receipt, paywall)
        res.json(article)
    })

    return router
}

module.exports = PaywallApi
