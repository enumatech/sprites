// ----------------------------------------------------------------------------
// reader-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {indexBy, prop, assoc, dissoc, keys, identity} = require('ramda')
const {thread, threadP} = require('sprites-channels/fp.js')
const {ZERO_ADDR, makeProvider} = require('sprites-channels/test-helpers.js')
const OffChainRegistry = require('sprites-channels/off-chain-registry.js')
const Paywall = require('../paywall.js')
const Reader = require('../reader.js')
const Publisher = require('../publisher.js')
const Sprites = require('sprites-channels')
const ChannelState = require('sprites-channels/channel-state.js')

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
                    ACTOR_NAME: 'Reader',
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
            const publisherConfig = Publisher.config(publisher)
            const validate = (transform) =>
                Reader.validatePaywall(transform(publisherConfig), reader0)

            await expect(validate(identity))
                .resolves.toHaveLength(3)

            await expect(validate(dissoc('reg')))
                .rejects.toThrowError(/No address .+"reg"/i)

            await expect(validate(assoc('reg', ZERO_ADDR)))
                .rejects.toThrowError(/No code .+"reg"/i)

            await expect(validate(dissoc('preimageManager')))
                .rejects.toThrowError(/No address .+"preimageManager"/i)

            await expect(validate(assoc('preimageManager', ZERO_ADDR)))
                .rejects.toThrowError(/No code .+"preimageManager"/i)

            await expect(validate(dissoc('token')))
                .rejects.toThrowError(/No address .+"token"/i)

            await expect(validate(assoc('token', ZERO_ADDR)))
                .rejects.toThrowError(/No code .+"token"/i)
        })
    })

    describe('when connected to a Publisher', () => {
        let publisherConfig, connectedClient

        beforeAll(async () => {
            publisherConfig = Publisher.config(publisher)
            connectedClient =
                await Reader.withPaywall(publisherConfig, reader0)
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
                        await Reader.withPaywall(publisherConfig, reader0)

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

            describe('.deposit', () => {
                let reader1, initialBalance
                const amt = 2

                beforeAll(async () =>
                    initialBalance = await Paywall.balance(chId, reader))

                beforeAll(async () =>
                    reader1 = await threadP(reader,
                        Reader.approve(amt),
                        Reader.deposit(amt)))

                it('increases channel balance', () =>
                    expect(Paywall.balance(chId, reader1)).resolves
                        .toEqual(initialBalance + amt))
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

                it('looks like the invoice without our signature', () =>
                    expect(payment).toMatchObject(dissoc('sigs', invoice)))

                it('is signed by us too', () => {
                    const {channel} = readerPmt.sprites
                    expect(channel.sigs[0]).toBeDefined()
                    expect(channel.sigs[1]).toEqual(invoice.sigs[1])
                    expect(ChannelState.checkAvailSigs(channel)).toBe(true)
                    expect(payment.sigs).toEqual(channel.sigs)
                })
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
                        await Paywall.channel(chId, reader)
                    expect(channel.round).toEqual(paymentReceipt.payment.round)
                })

                it('keeps the receipt part', async () => {
                    const {articleId, chId, sig} = paymentReceipt
                    expect(receipt).toMatchObject({articleId, chId, sig})
                })

                it('strips the verified payment', () =>
                    expect(receipt).not.toHaveProperty('payment'))

                it('saves the receipt into the library', () =>
                    expect(Reader.library(reader)).resolves
                        .toMatchObject({[article.id]: receipt}))
            })

            describe('.requestWithdraw', () => {
                let reader, chId, withdrawalRequest
                const deposit = 12

                beforeAll(async () => {
                    reader = await threadP(connectedClient,
                        Reader.approve(deposit),
                        Reader.firstDeposit(deposit),
                        Reader.requestWithdraw)
                    ;({withdrawalRequest, sprites: {chId}} = reader)
                })

                it('describes the channel-state transition operation', () =>
                    expect(withdrawalRequest).toMatchObject({
                        xforms: [
                            ['withdraw', Sprites.ownIdx(reader.sprites), deposit]
                        ]
                    }))

                it('identifies the new desired channel-state', () =>
                    expect(withdrawalRequest).toMatchObject({
                        chId,
                        round: 0
                    }))

                it('signs the target channel-state', () => {
                    const {sprites} = reader
                    const {channel} = sprites

                    expect(channel.sigs[Sprites.ownIdx(sprites)])
                        .toBeDefined()

                    expect(channel.sigs[Sprites.otherIdx(sprites)])
                        .not.toBeDefined()

                    expect(ChannelState.checkAvailSigs(channel)).toBe(true)
                    expect(withdrawalRequest.sigs).toEqual(channel.sigs)
                })

                describe('.withdraw', () => {
                    let reader1, initialTokenBalance, initialChannelBalance

                    beforeAll(async () => {
                        const {sprites} = reader
                        initialTokenBalance =
                            (await Sprites.tokenBalance(sprites)).tokenBalance
                        initialChannelBalance =
                            await Paywall.balance(chId, reader)
                        const {withdrawal} =
                            await Publisher.readerWithdraw(
                                withdrawalRequest, publisher)
                        reader1 = await Reader.withdraw(withdrawal, reader)
                    })

                    it('increases the reader\'s token balance', () =>
                        expect(Sprites.tokenBalance(reader1.sprites)).resolves
                            .toMatchObject({
                                tokenBalance:
                                    initialTokenBalance + initialChannelBalance
                            }))

                    it('updates the chain successfully', () =>
                        expect(reader1.sprites.tx)
                            .toMatchObject({status: true}))

                    it('is reflected in the channel-state', () =>
                        expect(Sprites.channelState(reader1.sprites)).resolves
                            .toMatchObject({
                                channel: {
                                    withdrawn: [initialChannelBalance, 0]
                                }
                            }))
                })
            })
        })
    })
})
