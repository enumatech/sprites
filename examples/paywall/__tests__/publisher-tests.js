// ----------------------------------------------------------------------------
// publisher-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {makeProvider} = require('sprites/lib/test-helpers.js')
const {
    map, assoc, assocPath, range, indexBy, prop, pluck, inc, sum
} = require('ramda')
const {thread, threadP, update, updatePath} = require('sprites/lib/fp.js')
const ChannelState = require('sprites/lib/channel-state.js')
const Sprites = require('sprites')
const OffChainRegistry = require('sprites/lib/off-chain-registry.js')
const Publisher = require('../publisher.js')
const Reader = require('../reader.js')

describe('Publisher.make', () => {
    it('works without params', async () => {
        expect(() => Publisher.make()).not.toThrow()
    })

    it('has a default sprites client', () => {
        expect(Publisher.make()).toMatchObject({
            sprites: expect.objectContaining(Sprites.make())
        })
    })

    it('merges its options parameter into the returned client', () => {
        expect(Publisher.make({param: 1})).toMatchObject({param: 1})
    })
})

describe('Publisher', () => {
    let publisher, reader0, web3Provider
    const newArticle = (id) => new Object({
        id: `aId-${id}`,
        price: 10 + id,
        title: `Article ${id}`,
        content: `Article ${id} content`
    })

    const Articles = map(newArticle, range(0, 2 + 1))
    const ArticleDB = indexBy(prop('id'), Articles)

    beforeAll(() => web3Provider = makeProvider())

    beforeAll(async () => {
        const {accounts: {ALICE, BOB}, ...spritesTemplate} =
            await Sprites.testDeploy({web3Provider})

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
                }))
        })
    })

    afterAll(() => web3Provider.connection.destroy())

    describe('.config', () => {
        it('works', async () => {
            const addr = (contract) =>
                publisher.sprites[contract].options.address

            expect(Publisher.config(publisher)).toMatchObject({
                publisher: publisher.sprites.ownAddress,
                preimageManager: addr('preimageManager'),
                reg: addr('reg'),
                token: addr('token')
            })
        })
    })

    describe('.catalog', () => {
        let catalog

        beforeAll(async () => {
            catalog = await Publisher.catalog(publisher)
        })

        it('does not contain the article contents', async () => {
            const contents = pluck('content', Articles)
            const catalogContent = JSON.stringify(catalog, null, 4)
            map(c => expect(catalogContent).not.toContain(c), contents)
        })
    })

    describe('with a connected client, buying an article', () => {
        let reader, order, chId
        const article = Articles[0]
        const articleId = article.id

        beforeAll(async () => {
            const priceOfAllArticles = thread(Articles, pluck('price'), sum)
            reader = await threadP(reader0,
                Reader.withPaywall(Publisher.config(publisher)),
                Reader.approve(priceOfAllArticles),
                Reader.firstDeposit(priceOfAllArticles),
                Reader.order(articleId))
            ;({order, sprites: {chId}} = reader)
        })

        describe('.invoice', () => {
            let PWinv // PW with invoice
            let invoice // the invoice itself for convenience

            beforeAll(async () => {
                PWinv = await Publisher.invoice(order, publisher)
                ;({invoice} = PWinv)
            })

            it('refers to the ordered article', () => {
                expect(invoice).toMatchObject({articleId})
            })

            it('describes the channel-state transition operation', () => {
                expect(invoice).toMatchObject({
                    cmd: {
                        name: 'creditAndWithdraw',
                        params: [Sprites.ownIdx(PWinv.sprites), article.price]
                    }
                })
            })

            it('identifies the new desired channel-state', () => {
                expect(invoice).toMatchObject({
                    chId,
                    round: reader.sprites.channel.round + 1
                })
            })

            it('signs the target channel-state', () => {
                const {channel} = PWinv.sprites
                expect(channel.sigs[0]).not.toBeDefined()
                expect(channel.sigs[1]).toBeDefined()
                expect(ChannelState.checkAvailSigs(channel)).toBe(true)
                // If the invoice signatures match the channel state sigs,
                // we can make assertions about the channel state, which
                // state should be reconstructible by the paywall client.
                expect(invoice.sigs).toEqual(channel.sigs)
            })

            it('transfers the aritcle price to the paywall', () => {
                expect(PWinv.sprites.channel.credits)
                    .toEqual([-article.price, article.price])
            })
        })

        describe('.processPayment', () => {
            let invoice, balanceBeforePayment

            beforeAll(async () => {
                balanceBeforePayment = await Publisher.balance(chId, publisher)
                ;({invoice} = await Publisher.invoice(order, publisher))
            })

            describe('without a signature', () => {
                let payment

                beforeAll(async () => {
                    ;({payment} = await threadP(reader,
                        Reader.pay(invoice),
                        assocPath(['payment', 'sigs', 0], null)))
                })

                it('is rejected', async () => {
                    await expect(Publisher.processPayment(payment, publisher))
                        .rejects.toThrowError(/missing/i)
                })

                it('retains the channel balance', async () => {
                    await expect(Publisher.balance(chId, publisher))
                        .resolves.toEqual(balanceBeforePayment)
                })
            })

            describe('with invalid signature', () => {
                let payment

                beforeAll(async () => {
                    ;({payment} = await threadP(reader,
                        Reader.pay(invoice),
                        updatePath(['payment', 'sigs'],
                            ([_reader, publisher]) => [publisher, publisher])))
                })

                it('is rejected', async () => {
                    await expect(Publisher.processPayment(payment, publisher))
                        .rejects.toThrowError(/invalid/i)
                })

                it('retains the channel balance', async () => {
                    await expect(Publisher.balance(chId, publisher))
                        .resolves.toEqual(balanceBeforePayment)
                })
            })

            // FIXME This test should come after the failing ones
            // to make sure it doesn't modify the channel balance.
            // Ideally the tests should be more independent, but
            // that would require more articles and invoices...
            describe('with correct buyer signature', () => {
                let startRound, receipt, payment

                beforeAll(async () => {
                    const pw0 = await Publisher.channel(chId, publisher)
                    startRound = pw0.sprites.channel.round
                    ;({payment} = await Reader.pay(invoice, reader))
                    ;({paymentReceipt: receipt} =
                        await Publisher.processPayment(payment, publisher))
                    await Reader.processReceipt(receipt, reader)
                })

                it('attaches the payment as reference', async () => {
                    expect(receipt).toHaveProperty('payment', payment)
                })

                it('acknowledged with a receipt', async () => {
                    // The receipt:
                    //    references the article
                    //    references the buyer/payment, so it can be rejected if necessary
                    //    doesn't require looking up old channel state (for simplicity)
                    //    can only be calculated by the paywall
                    //    it's a plus if its authenticity can be verified without db lookup
                    expect(receipt).toMatchObject({articleId, chId})
                    expect(receipt).toHaveProperty('sig')
                })

                it('increases the channel balance', async () => {
                    await expect(Publisher.balance(chId, publisher))
                        .resolves.toEqual(balanceBeforePayment + article.price)
                })

                it('saves the channel state', async () => {
                    const {sprites} = await Publisher.channel(chId, publisher)

                    expect(sprites.channel)
                        .toHaveProperty('round', startRound + 1)

                    expect(await sprites.offChainReg.ch(chId))
                        .toHaveProperty('round', sprites.channel.round)
                })
            })
        })

        describe('.getArticle', () => {
            // FIXME article index should be automatically incremented
            const article1 = Articles[1]
            const article2 = Articles[2]
            let receipt

            async function buy(articleId) {
                const {order} = await Reader.order(articleId, reader)
                const {invoice} = await Publisher.invoice(order, publisher)
                const {payment} = await Reader.pay(invoice, reader)
                const {paymentReceipt} = await Publisher.processPayment(payment, publisher)
                return await Reader.processReceipt(paymentReceipt, reader)
            }

            beforeAll(async () => {
                ;({receipt} = await buy(article1.id))
            })

            it('requires a valid signature', async () => {
                const otherReceipt = update('chId', inc, receipt)
                const otherSig =
                    await Publisher.receiptSig(otherReceipt, publisher)
                const invalidReceipt = assoc('sig', otherSig, receipt)

                await expect(Publisher.getArticle(invalidReceipt, publisher))
                    .rejects.toThrowError(/Invalid signture/i)
            })

            it('returns the article', async () => {
                await expect(Publisher.getArticle(receipt, publisher))
                    .resolves.toMatchObject({article: article1})
            })

            describe('after buying another article', () => {
                beforeAll(async () => {
                    await buy(article2.id)
                })

                it('still returns the first article', async () => {
                    await expect(Publisher.getArticle(receipt, publisher))
                        .resolves.toMatchObject({article: article1})
                })

                describe('.publisherWithdraw', () => {
                    it('withdraws all payments', async () => {
                        const {sprites} = await Publisher.channel(chId, publisher)
                        const ownIdx = Sprites.ownIdx(sprites)
                        const {channel: {withdrawals, withdrawn}} = sprites
                        const expectToWithdraw =
                            withdrawals[ownIdx] - withdrawn[ownIdx]
                        // Ensure we have something to withdraw
                        expect(expectToWithdraw).toBeGreaterThan(0)
                        const {tokenBalance: balanceBefore} =
                            await Sprites.tokenBalance(sprites)

                        await expect(Publisher.publisherWithdraw(chId, publisher))
                            .resolves.toMatchObject({
                                withdrawn: expectToWithdraw
                            })

                        const {tokenBalance: balanceAfter} =
                            await Sprites.tokenBalance(sprites)

                        expect(balanceAfter - balanceBefore)
                            .toEqual(expectToWithdraw)
                    })
                })
            })
        })

        describe.skip('.channel', () => {
            it('works', async () => {
                const {sprites} = await Publisher.channel(chId, publisher)
                const {channel} = sprites

                expect(ChannelState.balance(Sprites.ownIdx(sprites), channel))
                    .toEqual(article.price)

                expect(ChannelState.balance(Sprites.otherIdx(sprites), channel))
                    .toEqual(0)
            })
        })
    })
})
