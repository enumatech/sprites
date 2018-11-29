// ----------------------------------------------------------------------------
// paywall-demo-tests.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {newIpcProvider} = require('sprites/lib/test-helpers.js')
const {__, indexBy, prop, assocPath, dissoc} = require('ramda')
const {thread, threadP} = require('sprites/lib/fp.js')
const Web3Eth = require('web3-eth')
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
        // web3Provider = newIpcProvider()
        web3Provider =
            new Web3Eth.providers.HttpProvider('http://localhost:9545')
        const spritesDeployment = await Sprites.testDeploy({web3Provider})
        ;({ALICE, BOB} = spritesDeployment.accounts)
        const spritesTemplate = dissoc('accounts', spritesDeployment)

        Publisher = {
            ...Paywall.new(),
            db: ArticleDB,
            sprites: thread({
                    ...spritesTemplate,
                    ACTOR_NAME: 'Publisher',
                    ownAddress: BOB,
                    offChainReg: new OffChainRegistry({ownAddress: BOB})
                },
                Sprites.withRemoteSigner,
                Sprites.withWeb3Contracts),
        }

        Visitor = await threadP(
            {
                ...PaywallClient.new(),
                sprites: thread({
                        ...Sprites.new(),
                        web3Provider,
                        ACTOR_NAME: 'Visitor',
                        ownAddress: ALICE,
                        offChainReg: new OffChainRegistry({ownAddress: ALICE})
                    },
                    Sprites.withRemoteSigner)
            },
            PaywallClient.withPaywall(Paywall.config(Publisher)))
    })

    afterAll(() => web3Provider.connection.destroy())

    describe('Getting the 1st article', function () {
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
                expect(paidArticle).toMatchObject(article)
            })

            it('is saved in our library', async () => {
                const library = await PaywallClient.library(Reader)
                expect(library).toMatchObject({[article.id]: receipt})
            })
        })
    })
})
