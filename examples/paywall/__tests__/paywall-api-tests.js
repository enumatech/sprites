// ----------------------------------------------------------------------------
// paywall-api-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {makeFetch} = require('supertest-fetch')
const express = require('express')
const {Router} = express
const PaywallApi = require('../paywall-api.js')
const PaywallApiClient = require('../paywall-api-client.js')

jest.mock('../paywall.js')
const Paywall = require('../paywall.js')

describe('PaywallApi', () => {
    let api
    const paywall = {mock: "paywall"}

    beforeAll(async () => {
        const paywallApi = PaywallApi(paywall, Router())
        const apiServer = express().use('/', paywallApi)
        const apiFetch = makeFetch(apiServer)
        api = PaywallApiClient(apiFetch)
    })

    beforeEach(async () => {
        jest.clearAllMocks()
    })

    const resolve = (x) => Promise.resolve(x)

    const mock = (method, result) =>
        method.mockImplementationOnce(() => result)

    describe('/config', () => {
        it('works', async () => {
            const config = {mock: "config"}
            mock(Paywall.config, config)

            await expect(api.config()).resolves.toMatchObject(config)
            expect(Paywall.config).toBeCalledWith(paywall)
        })
    })

    describe('/catalog', () => {
        it('works', async () => {
            const catalog = {mock: "catalog"}
            mock(Paywall.catalog, resolve(catalog))

            await expect(api.catalog()).resolves.toMatchObject(catalog)
            expect(Paywall.catalog).toBeCalledWith(paywall)
        })
    })

    describe('/invoice', () => {
        it('works', async () => {
            const order = {mock: "order"}
            const invoice = {mock: "invoice"}
            mock(Paywall.invoice, resolve({invoice}))

            await expect(api.invoice(order)).resolves.toMatchObject(invoice)
            expect(Paywall.invoice).toBeCalledWith(order, paywall)
        })
    })

    describe('/payment', () => {
        it('works', async () => {
            const payment = {mock: "payment"}
            const paymentReceipt = {mock: "paymentReceipt"}
            mock(Paywall.processPayment, resolve({paymentReceipt}))

            await expect(api.processPayment(payment))
                .resolves.toMatchObject(paymentReceipt)

            expect(Paywall.processPayment).toBeCalledWith(payment, paywall)
        })
    })

    describe('/article', () => {
        it('works', async () => {
            const receipt = {mock: "receipt"}
            const article = {mock: "article"}
            mock(Paywall.getArticle, resolve({article}))

            await expect(api.getArticle(receipt))
                .resolves.toMatchObject(article)

            expect(Paywall.getArticle).toBeCalledWith(receipt, paywall)
        })
    })

    describe('/publisher-withdraw', () => {
        it('works', async () => {
            const chId = 123
            const ch = {mock: 'channel'}
            mock(Paywall.publisherWithdraw, resolve(ch))

            await expect(api.publisherWithdraw(chId))
                .resolves.toMatchObject(ch)

            expect(Paywall.publisherWithdraw).toBeCalledWith(chId, paywall)
        })
    })
})
