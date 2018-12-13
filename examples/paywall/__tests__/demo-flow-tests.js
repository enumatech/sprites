// ----------------------------------------------------------------------------
// demo-flow-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {makeProvider} = require('sprites/lib/test-helpers.js')
const {__, indexBy, prop, assocPath} = require('ramda')
const {thread, threadP} = require('sprites/lib/fp.js')
const Sprites = require('sprites')
const OffChainRegistry = require('sprites/lib/off-chain-registry.js')
const Publisher = require('../publisher.js')
const Reader = require('../reader.js')

const balance = async ({sprites}) =>
    (await Sprites.tokenBalance(sprites)).tokenBalance

describe('Sprites paywall demo flow using APIs directly', () => {
    let visitor, publisher, web3Provider
    const Articles = [
        {
            id: "aId-1",
            price: 10,
            title: 'Article 1',
            content: `Article 1 content`,
            blurb: 'Article 1 blurb'
        }
    ]
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

        visitor = await Reader.withPaywall(
            Publisher.config(publisher),
            Reader.make({
                sprites: Sprites.withRemoteSigner(
                    Sprites.make({
                        web3Provider,
                        ACTOR_NAME: 'Visitor',
                        ownAddress: ALICE,
                        offChainReg: new OffChainRegistry({ownAddress: ALICE})
                    }))
            }))
    })

    afterAll(() => web3Provider.connection.destroy())

    describe('1st article', () => {
        let reader, chId, article, content,
            publisherOpeningBalance,
            readerOpeningBalance
        const extraDeposit = 5

        beforeAll(async () => {
            publisherOpeningBalance = await balance(publisher)
            readerOpeningBalance = await balance(visitor)
            article = (await Publisher.catalog(publisher))[0]
            content = ArticleDB[article.id].content
            const deposit = article.price + extraDeposit
            reader = await threadP(visitor,
                Reader.approve(deposit),
                Reader.firstDeposit(deposit),
                Reader.order(article.id),
                assocPath(['sprites', 'ACTOR_NAME'], 'Reader'))
            chId = reader.sprites.chId
        })

        describe('after payment', function () {
            let receipt, paidArticle

            beforeAll(async () => {
                // const propLog = p => o =>
                //     (log(p + ':\n', prop(p, o)), prop(p, o))

                receipt = await threadP(
                    reader,
                    prop('order'), Publisher.invoice(__, publisher),
                    prop('invoice'), Reader.pay(__, reader),
                    prop('payment'), Publisher.processPayment(__, publisher),
                    prop('paymentReceipt'), Reader.processReceipt(__, reader),
                    prop('receipt'))

                paidArticle =
                    (await Publisher.getArticle(receipt, publisher)).article
            })

            it('is readable', () =>
                expect(paidArticle).toMatchObject({content}))

            it('is saved in the Reader\'s library', () =>
                expect(Reader.library(reader)).resolves
                    .toMatchObject({[article.id]: receipt}))

            describe('when the Publisher withdraws', () => {
                beforeAll(() => Publisher.publisherWithdraw(chId, publisher))

                it('their on-chain balance reflects the payment', () =>
                    expect(balance(publisher)).resolves
                        .toEqual(publisherOpeningBalance + article.price))

                describe('and the Reader withdraws too', () => {
                    beforeAll(async () => {
                        const {withdrawalRequest} =
                            await Reader.requestWithdraw(reader)
                        const {withdrawal} =
                            await Publisher.readerWithdraw(withdrawalRequest, publisher)
                        // await Reader.withdraw(withdrawal, reader)
                    })

                    it.skip('their on-chain balance reflects the payment', () =>
                        expect(balance(reader)).resolves
                            .toEqual(readerOpeningBalance - article.price))
                })
            })
        })
    })
})
