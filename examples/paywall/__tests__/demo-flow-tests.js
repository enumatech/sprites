// ----------------------------------------------------------------------------
// demo-flow-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {makeProvider} = require('sprites/lib/test-helpers.js')
const {__, indexBy, prop, assocPath, dissoc, identity} = require('ramda')
const {thread, threadP} = require('sprites/lib/fp.js')
const Sprites = require('sprites')
const OffChainRegistry = require('sprites/lib/off-chain-registry.js')
const Paywall = require('../paywall.js')
const PaywallClient = require('../paywall-client.js')

describe('Sprites paywall demo', () => {
    let Visitor, Publisher, web3Provider
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

    beforeAll(async () => {
        web3Provider = makeProvider()
        const spritesDeployment = await Sprites.testDeploy({web3Provider})
        ;({ALICE, BOB} = spritesDeployment.accounts)
        const spritesTemplate = dissoc('accounts', spritesDeployment)

        Publisher = Paywall.make({
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

        Visitor = await PaywallClient.withPaywall(
            Paywall.config(Publisher),
            PaywallClient.make({
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

    describe('1st article', function () {
        let Reader, article

        beforeAll(async () => {
            const catalog = await Paywall.catalog(Publisher)
            article = catalog[0]
            Reader = await threadP(Visitor,
                PaywallClient.approve(article.price),
                PaywallClient.firstDeposit(article.price),
                PaywallClient.order(article.id),
                assocPath(['sprites', 'ACTOR_NAME'], 'Reader'))
        })

        describe('after payment', function () {
            let receipt, paidArticle

            beforeAll(async () => {
                const propLog = p => o =>
                    (log(p + ':\n', prop(p, o)), prop(p, o))

                receipt = await threadP(
                    Reader,
                    prop('order'), Paywall.invoice(__, Publisher),
                    prop('invoice'), PaywallClient.pay(__, Reader),
                    prop('payment'), Paywall.processPayment(__, Publisher),
                    prop('paymentReceipt'), PaywallClient.processReceipt(__, Reader),
                    prop('receipt'))
                ;({article: paidArticle} =
                    await Paywall.getArticle(receipt, Publisher))
            })

            it('is readable', async () => {
                expect(paidArticle)
                    .toMatchObject({content: ArticleDB[article.id].content})
            })

            it('is saved in the Reader\'s library', async () => {
                const library = await PaywallClient.library(Reader)
                expect(library).toMatchObject({[article.id]: receipt})
            })

            describe('when withdrawn by the Publisher', () => {
                let initialBalance

                beforeAll(async () => {
                    ;({tokenBalance: initialBalance} =
                        await Sprites.tokenBalance(Publisher.sprites))

                    const chIds =
                        Publisher.sprites.offChainReg.db
                            .get('channels').map(identity).value()

                    for (const {chId} of chIds) {
                        await Paywall.withdraw(chId, Publisher)
                    }
                })

                it('the payment is reflected on their on-chain balance',
                    async () => {
                        const {tokenBalance} =
                            await Sprites.tokenBalance(Publisher.sprites)

                        expect(tokenBalance)
                            .toEqual(initialBalance + article.price)
                    })
            })
        })
    })
})
