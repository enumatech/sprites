// ----------------------------------------------------------------------------
// paywall-client-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {indexBy, prop, assoc, dissoc, keys} = require('ramda')
const {thread, threadP} = require('sprites/lib/fp.js')
const {ZERO_ADDR, makeProvider} = require('sprites/lib/test-helpers.js')
const OffChainRegistry = require('sprites/lib/off-chain-registry.js')
const PaywallClient = require('../paywall-client.js')
const Paywall = require('../paywall.js')
const Sprites = require('sprites')
const ChannelState = require('sprites/lib/channel-state.js')

describe('PaywallClient', () => {
    let PW, PWC0, web3Provider
    const Articles = [
        {
            id: "aId-1",
            price: 10,
            title: 'Article 1',
            content: `Article 1 content`
        }
    ]
    const ArticleDB = indexBy(prop('id'), Articles)

    beforeAll(async () => {
        web3Provider = makeProvider()
        const spritesDeployment = await Sprites.testDeploy({web3Provider})
        ;({ALICE, BOB} = spritesDeployment.accounts)
        const spritesTemplate = dissoc('accounts', spritesDeployment)

        PW = {
            ...Paywall.new(),
            db: ArticleDB,
            sprites: thread({
                    ...spritesTemplate,
                    ACTOR_NAME: 'Paywall Operator',
                    ownAddress: BOB,
                    offChainReg: new OffChainRegistry({ownAddress: BOB})
                },
                Sprites.withRemoteSigner,
                Sprites.withWeb3Contracts),
        }

        PWC0 = PaywallClient.make({
            sprites: thread({
                    ...Sprites.new(),
                    web3Provider,
                    ACTOR_NAME: 'Paywall Client',
                    ownAddress: ALICE,
                    offChainReg: new OffChainRegistry({ownAddress: ALICE})
                },
                Sprites.withRemoteSigner)
        })
    })

    afterAll(() => web3Provider.connection.destroy())

    describe('.make', () => {
        it('works without params', () => {
            expect(() => PaywallClient.make()).not.toThrow()
        })

        it('defaults to in-memory library db', () => {
            expect(PaywallClient.make().db).toMatchObject({
                read: expect.any(Function),
                write: expect.any(Function)
            })
        })

        it('has a default sprites client', () => {
            expect(PaywallClient.make()).toMatchObject({
                sprites: expect.objectContaining(Sprites.new())
            })
        })

        it('merges its options parameter into the returned client', () => {
            expect(PaywallClient.make({param: 1})).toMatchObject({param: 1})
        })
    })

    describe('.withPaywall', () => {
        it('works', async () => {
            const paywallConfig = Paywall.config(PW)
            const client = await PaywallClient.withPaywall(paywallConfig, PWC0)
            const {publisher, sprites: {preimageManager, reg, token}} = client

            /**
             * Expect a web3.Contract object at the given address with
             * at least the method specified.
             * */
            function expectContract(contract, addr, methodName) {
                expect(contract.options.address).toEqual(addr)
                expect(Object.keys(contract)).toContain(methodName)
                expect(contract[methodName]).toBeInstanceOf(Function)
            }

            expect(publisher).toEqual(paywallConfig.publisher)
            expectContract(preimageManager,
                paywallConfig.preimageManager, 'submitPreimage')
            expectContract(reg, paywallConfig.reg, 'create')
            expectContract(token, paywallConfig.token, 'transfer')
        })
    })

    describe('.validatePaywall', () => {
        it('works', async () => {
            const paywallConfig = Paywall.config(PW)

            await expect(PaywallClient.validatePaywall(paywallConfig, PWC0))
                .resolves.toHaveLength(3)

            await expect(PaywallClient.validatePaywall(dissoc('reg', paywallConfig), PWC0))
                .rejects.toThrowError(/No address .+"reg"/i)

            await expect(PaywallClient.validatePaywall(assoc('reg', ZERO_ADDR, paywallConfig), PWC0))
                .rejects.toThrowError(/No code .+"reg"/i)

            await expect(PaywallClient.validatePaywall(dissoc('preimageManager', paywallConfig), PWC0))
                .rejects.toThrowError(/No address .+"preimageManager"/i)

            await expect(PaywallClient.validatePaywall(assoc('preimageManager', ZERO_ADDR, paywallConfig), PWC0))
                .rejects.toThrowError(/No code .+"preimageManager"/i)

            await expect(PaywallClient.validatePaywall(dissoc('token', paywallConfig), PWC0))
                .rejects.toThrowError(/No address .+"token"/i)

            await expect(PaywallClient.validatePaywall(assoc('token', ZERO_ADDR, paywallConfig), PWC0))
                .rejects.toThrowError(/No code .+"token"/i)
        })
    })

    describe('when connected to a Paywall', () => {
        let paywallConfig, connectedClient

        beforeAll(async () => {
            paywallConfig = Paywall.config(PW)
            connectedClient = await PaywallClient.withPaywall(paywallConfig, PWC0)
        })

        describe('to buy an article from a publisher', () => {
            let PWC, chId, article, articleId

            beforeAll(async () => {
                const catalog = await Paywall.catalog(PW)
                article = catalog[0]
                articleId = article.id
                PWC = await threadP(connectedClient,
                    PaywallClient.approve(article.price),
                    PaywallClient.firstDeposit(article.price))
                ;({sprites: {chId}} = PWC)
            })

            describe('.withPaywall', () => {
                it('restores the open channel', async () => {
                    const reconnectedClient =
                        await PaywallClient.withPaywall(paywallConfig, PWC0)

                    expect(reconnectedClient.sprites.chId)
                        .toEqual(PWC.sprites.chId)
                })
            })

            describe('.library', () => {
                it('is empty', async () => {
                    const library = await PaywallClient.library(PWC)
                    expect(keys(library)).toHaveLength(0)
                })
            })

            describe('.saveReceipt', () => {
                it('works', async () => {
                    const receipt = {
                        articleId: "<articleId>",
                        chId: "<chId>",
                        sig: ["v", "r", "s"]
                    }
                    const lib = async () => PaywallClient.library(PWC)
                    expect(keys(await lib())).not.toContain(receipt.id)

                    await PaywallClient.saveReceipt(receipt, PWC)

                    expect(await lib())
                        .toMatchObject({[receipt.articleId]: receipt})
                })
            })

            describe('.order', () => {
                it('contains channel ID as means to pay', async () => {
                    const {order} = PaywallClient.order(articleId, PWC)
                    expect(order).toMatchObject({articleId, chId})
                })
            })

            describe('.pay', () => {
                let PWCpmt // PWC with payment
                let invoice, payment

                beforeAll(async () => {
                    const {order} = PaywallClient.order(articleId, PWC)
                    ;({invoice} = await Paywall.invoice(order, PW))
                    PWCpmt = await PaywallClient.pay(invoice, PWC)
                    ;({payment} = PWCpmt)
                })

                it('looks like the invoice without our signature', () => {
                    expect(payment).toMatchObject(dissoc('sigs', invoice))
                })

                it('is signed by us too', () => {
                    const {channel} = PWCpmt.sprites
                    expect(channel.sigs[0]).toBeDefined()
                    expect(channel.sigs[1]).toEqual(invoice.sigs[1])
                    expect(ChannelState.checkAvailSigs(channel)).toBe(true)
                    expect(payment.sigs).toEqual(channel.sigs)
                })

                it.skip('is idempotent', async () => {
                })
            })

            describe('.channel', () => {
                // FIXME Can be the same as Paywall.channel
            })

            describe('.processReceipt', () => {
                let paymentReceipt, receipt

                beforeAll(async () => {
                    const {order} = PaywallClient.order(articleId, PWC)
                    const {invoice} = await Paywall.invoice(order, PW)
                    const {payment} = await PaywallClient.pay(invoice, PWC)
                    ;({paymentReceipt} = await Paywall.processPayment(payment, PW))
                    ;({receipt} = await PaywallClient.processReceipt(paymentReceipt, PWC))
                })

                it('saves the channel state', async () => {
                    const {sprites: {channel}} = await PaywallClient.channel(chId, PWC)
                    expect(channel.round).toEqual(paymentReceipt.payment.round)
                })

                it('keeps the receipt part', async () => {
                    const {articleId, chId, sig} = paymentReceipt
                    expect(receipt).toMatchObject({articleId, chId, sig})
                })

                it('strips the verified payment', async () => {
                    expect(receipt).not.toHaveProperty('payment')
                })

                it('saves the receipt into the library', async () => {
                    await expect(PaywallClient.library(PWC))
                        .resolves.toMatchObject({[article.id]: receipt})
                })
            })
        })
    })
})
