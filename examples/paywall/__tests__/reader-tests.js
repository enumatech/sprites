// ----------------------------------------------------------------------------
// reader-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {indexBy, prop, assoc, dissoc, keys} = require('ramda')
const {thread, threadP} = require('sprites/lib/fp.js')
const {ZERO_ADDR, makeProvider} = require('sprites/lib/test-helpers.js')
const OffChainRegistry = require('sprites/lib/off-chain-registry.js')
const Reader = require('../reader.js')
const Publisher = require('../publisher.js')
const Sprites = require('sprites')
const ChannelState = require('sprites/lib/channel-state.js')

describe('Reader', () => {
    let publisher, reader0, web3Provider
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

        publisher = Publisher.make({
            db: ArticleDB,
            sprites: thread({
                    ...spritesTemplate,
                    ACTOR_NAME: 'Publisher',
                    ownAddress: BOB,
                    offChainReg: new OffChainRegistry({ownAddress: BOB})
                },
                Sprites.withRemoteSigner,
                Sprites.withWeb3Contracts),
        })

        reader0 = Reader.make({
            sprites: Sprites.withRemoteSigner(
                Sprites.make({
                    web3Provider,
                    ACTOR_NAME: 'Paywall Client',
                    ownAddress: ALICE,
                    offChainReg: new OffChainRegistry({ownAddress: ALICE})
                })
            )
        })
    })

    afterAll(() => web3Provider.connection.destroy())

    describe('.make', () => {
        it('works without params', () => {
            expect(() => Reader.make()).not.toThrow()
        })

        it('defaults to in-memory library db', () => {
            expect(Reader.make().db).toMatchObject({
                read: expect.any(Function),
                write: expect.any(Function)
            })
        })

        it('has a default sprites client', () => {
            expect(Reader.make()).toMatchObject({
                sprites: expect.objectContaining(Sprites.make())
            })
        })

        it('merges its options parameter into the returned client', () => {
            expect(Reader.make({param: 1})).toMatchObject({param: 1})
        })
    })

    describe('.withPaywall', () => {
        it('works', async () => {
            const publisherConfig = Publisher.config(publisher)
            const {
                publisher: publisherAddr,
                sprites: {preimageManager, reg, token}
            } = await Reader.withPaywall(publisherConfig, reader0)

            /**
             * Expect a web3.Contract object at the given address with
             * at least the method specified.
             * */
            function expectContract(contract, addr, methodName) {
                expect(contract.options.address).toEqual(addr)
                expect(Object.keys(contract)).toContain(methodName)
                expect(contract[methodName]).toBeInstanceOf(Function)
            }

            expect(publisherAddr).toEqual(publisherConfig.publisher)
            expectContract(preimageManager,
                publisherConfig.preimageManager, 'submitPreimage')
            expectContract(reg, publisherConfig.reg, 'create')
            expectContract(token, publisherConfig.token, 'transfer')
        })
    })

    describe('.validatePaywall', () => {
        it('works', async () => {
            const paywallConfig = Publisher.config(publisher)

            await expect(Reader.validatePaywall(paywallConfig, reader0))
                .resolves.toHaveLength(3)

            await expect(Reader.validatePaywall(dissoc('reg', paywallConfig), reader0))
                .rejects.toThrowError(/No address .+"reg"/i)

            await expect(Reader.validatePaywall(assoc('reg', ZERO_ADDR, paywallConfig), reader0))
                .rejects.toThrowError(/No code .+"reg"/i)

            await expect(Reader.validatePaywall(dissoc('preimageManager', paywallConfig), reader0))
                .rejects.toThrowError(/No address .+"preimageManager"/i)

            await expect(Reader.validatePaywall(assoc('preimageManager', ZERO_ADDR, paywallConfig), reader0))
                .rejects.toThrowError(/No code .+"preimageManager"/i)

            await expect(Reader.validatePaywall(dissoc('token', paywallConfig), reader0))
                .rejects.toThrowError(/No address .+"token"/i)

            await expect(Reader.validatePaywall(assoc('token', ZERO_ADDR, paywallConfig), reader0))
                .rejects.toThrowError(/No code .+"token"/i)
        })
    })

    describe('when connected to a Paywall', () => {
        let paywallConfig, connectedClient

        beforeAll(async () => {
            paywallConfig = Publisher.config(publisher)
            connectedClient = await Reader.withPaywall(paywallConfig, reader0)
        })

        describe('to buy an article from a publisher', () => {
            let reader, chId, article, articleId

            beforeAll(async () => {
                const catalog = await Publisher.catalog(publisher)
                article = catalog[0]
                articleId = article.id
                reader = await threadP(connectedClient,
                    Reader.approve(article.price),
                    Reader.firstDeposit(article.price))
                ;({sprites: {chId}} = reader)
            })

            describe('.withPaywall', () => {
                it('restores the open channel', async () => {
                    const reconnectedClient =
                        await Reader.withPaywall(paywallConfig, reader0)

                    expect(reconnectedClient.sprites.chId)
                        .toEqual(reader.sprites.chId)
                })
            })

            describe('.library', () => {
                it('is empty', async () => {
                    const library = await Reader.library(reader)
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
                    const lib = async () => Reader.library(reader)
                    expect(keys(await lib())).not.toContain(receipt.id)

                    await Reader.saveReceipt(receipt, reader)

                    expect(await lib())
                        .toMatchObject({[receipt.articleId]: receipt})
                })
            })

            describe('.order', () => {
                it('contains channel ID as means to pay', async () => {
                    const {order} = Reader.order(articleId, reader)
                    expect(order).toMatchObject({articleId, chId})
                })
            })

            describe('.pay', () => {
                let readerPmt // reader with payment
                let invoice, payment

                beforeAll(async () => {
                    const {order} = Reader.order(articleId, reader)
                    ;({invoice} = await Publisher.invoice(order, publisher))
                    readerPmt = await Reader.pay(invoice, reader)
                    ;({payment} = readerPmt)
                })

                it('looks like the invoice without our signature', () => {
                    expect(payment).toMatchObject(dissoc('sigs', invoice))
                })

                it('is signed by us too', () => {
                    const {channel} = readerPmt.sprites
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
                    const {order} = Reader.order(articleId, reader)
                    const {invoice} = await Publisher.invoice(order, publisher)
                    const {payment} = await Reader.pay(invoice, reader)
                    ;({paymentReceipt} =
                        await Publisher.processPayment(payment, publisher))
                    ;({receipt} =
                        await Reader.processReceipt(paymentReceipt, reader))
                })

                it('saves the channel state', async () => {
                    const {sprites: {channel}} =
                        await Reader.channel(chId, reader)
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
                    await expect(Reader.library(reader))
                        .resolves.toMatchObject({[article.id]: receipt})
                })
            })
        })
    })
})
