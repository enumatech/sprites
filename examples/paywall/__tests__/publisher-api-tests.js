// ----------------------------------------------------------------------------
// publisher-api-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {makeFetch} = require('supertest-fetch')
const express = require('express')
const {Router} = express
const PublisherApi = require('../publisher-api.js')
const PublisherApiClient = require('../publisher-api-client.js')

jest.mock('../publisher.js')
const Publisher = require('../publisher.js')

describe('PublisherApi', () => {
    let api
    const publisher = {mock: "publisher"}

    beforeAll(async () => {
        const publisherApi = PublisherApi(publisher, Router())
        const apiServer = express().use('/', publisherApi)
        const apiFetch = makeFetch(apiServer)
        api = PublisherApiClient(apiFetch)
    })

    beforeEach(() => jest.clearAllMocks())

    const resolve = (x) => Promise.resolve(x)

    const mock = (method, result) =>
        method.mockImplementationOnce(() => result)

    describe('.http', () => {
        describe('on error', () => {
            const errorMsg = 'Boom'
            const errorServer = express()
                .use('/', PublisherApi('<publisher>', Router())
                    .get('/error', (req, res) =>
                        res.json({
                            message: errorMsg,
                            stack: '<stack-trace>'
                        })))
            const api = PublisherApiClient(makeFetch(errorServer))

            it('prefixes server error messages with "[SERVER]"', async () =>
                expect(api.http.get('/error')).rejects
                    .toMatchObject({message: `[SERVER] ${errorMsg}`}))
        })
    })

    describe('/config', () => {
        it('works', async () => {
            const config = {mock: "config"}
            mock(Publisher.config, config)

            await expect(api.config()).resolves.toMatchObject(config)
            expect(Publisher.config).toBeCalledWith(publisher)
        })
    })

    describe('/catalog', () => {
        it('works', async () => {
            const catalog = {mock: "catalog"}
            mock(Publisher.catalog, resolve(catalog))

            await expect(api.catalog()).resolves.toMatchObject(catalog)
            expect(Publisher.catalog).toBeCalledWith(publisher)
        })
    })

    describe('/invoice', () => {
        it('works', async () => {
            const order = {mock: "order"}
            const invoice = {mock: "invoice"}
            mock(Publisher.invoice, resolve({invoice}))

            await expect(api.invoice(order)).resolves.toMatchObject(invoice)
            expect(Publisher.invoice).toBeCalledWith(order, publisher)
        })
    })

    describe('/payment', () => {
        it('works', async () => {
            const payment = {mock: "payment"}
            const paymentReceipt = {mock: "paymentReceipt"}
            mock(Publisher.processPayment, resolve({paymentReceipt}))

            await expect(api.processPayment(payment))
                .resolves.toMatchObject(paymentReceipt)

            expect(Publisher.processPayment).toBeCalledWith(payment, publisher)
        })
    })

    describe('/article', () => {
        it('works', async () => {
            const receipt = {mock: "receipt"}
            const article = {mock: "article"}
            mock(Publisher.getArticle, resolve({article}))

            await expect(api.getArticle(receipt))
                .resolves.toMatchObject(article)

            expect(Publisher.getArticle).toBeCalledWith(receipt, publisher)
        })
    })

    describe('/reader-withdraw', () => {
        it('works', async () => {
            const withdrawalRequest = {mock: '<withdrawalRequest>'}
            const mockWithdrawal = {mock: '<mock withdrawal>'}
            mock(Publisher.readerWithdraw,
                resolve({withdrawal: mockWithdrawal}))

            await expect(api.readerWithdraw(withdrawalRequest))
                .resolves.toMatchObject(mockWithdrawal)

            expect(Publisher.readerWithdraw)
                .toBeCalledWith(withdrawalRequest, publisher)
        })
    })

    describe('/publisher-withdraw', () => {
        it('works', async () => {
            const chId = 123
            const withdrawn = {withdrawn: 456}
            mock(Publisher.publisherWithdraw, resolve(withdrawn))

            await expect(api.publisherWithdraw(chId))
                .resolves.toMatchObject(withdrawn)

            expect(Publisher.publisherWithdraw).toBeCalledWith(chId, publisher)
        })
    })
})
