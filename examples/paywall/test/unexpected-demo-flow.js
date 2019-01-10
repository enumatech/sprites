const t = require('./custom-tap.js')
const {makeProvider} = require('sprites/lib/test-helpers.js')
const {__, indexBy, prop, assocPath} = require('ramda')
const {thread, threadP} = require('sprites/lib/fp.js')
const Sprites = require('sprites')
const OffChainRegistry = require('sprites/lib/off-chain-registry.js')
const Publisher = require('../publisher.js')
const Reader = require('../reader.js')

const balance = async ({sprites}) =>
    (await Sprites.tokenBalance(sprites)).tokenBalance

t.test('Paywall demo flow', {bail: true, timeout: 10 * 1000}, async t => {
    const Article1 = {
        id: "aId-1", price: 10, title: 'Article 1',
        content: `Article 1 content`, blurb: 'Article 1 blurb'
    }
    const Articles = [Article1]
    const ArticleDB = indexBy(prop('id'), Articles)
    const deployerWeb3Provider = makeProvider()
    const {accounts: {ALICE, BOB}, ...spritesTemplate} =
        await Sprites.testDeploy({web3Provider: deployerWeb3Provider})
    const web3Provider = makeProvider()
    const publisher = Publisher.make({
        db: ArticleDB,
        sprites: thread({
                ...spritesTemplate,
                web3Provider,
                ACTOR_NAME: 'Publisher',
                ownAddress: BOB,
                offChainReg: new OffChainRegistry({ownAddress: BOB})
            },
            Sprites.withRemoteSigner,
            Sprites.withWeb3Contracts),
    })
    const Alice = Reader.make({
        sprites: Sprites.withRemoteSigner(
            Sprites.make({
                web3Provider,
                ACTOR_NAME: 'Alice',
                ownAddress: ALICE,
                offChainReg: new OffChainRegistry({ownAddress: ALICE})
            }))
    })
    const visitor = await Reader.withPaywall(Publisher.config(publisher), Alice)

    const [publisherOpeningBalance, readerOpeningBalance] =
        await Promise.all([balance(publisher), balance(visitor)])
    t.pass(`Publisher opening balance: ${publisherOpeningBalance}`)
    t.pass(`Reader opening balance: ${readerOpeningBalance}`)

    const article = (await Publisher.catalog(publisher))[0]
    const content = ArticleDB[article.id].content
    const extraDeposit = 5
    const deposit = article.price + extraDeposit

    const reader = await threadP(visitor,
        assocPath(['sprites', 'ACTOR_NAME'], 'Reader'),
        Reader.approve(deposit),
        Reader.firstDeposit(deposit))
    const chId = reader.sprites.chId
    t.pass(`Reader has opened channel ${chId}`)

    const {order} = Reader.order(article.id, reader)
    t.pass(`Reader creates order`)
    const {invoice} = await Publisher.invoice(order, publisher)
    t.pass(`Publisher issues invoice`)
    const {payment} = await Reader.pay(invoice, reader)
    const {paymentReceipt} = await Publisher.processPayment(payment, publisher)
    const {receipt} = await Reader.processReceipt(paymentReceipt, reader)
    const {article: paidArticle} = await Publisher.getArticle(receipt, publisher)
    await t.expect([paidArticle, 'to satisfy', {content}],
        `Article content is readable`)
    await t.expect([
        Reader.library(reader), 'to be fulfilled with',
        {[article.id]: receipt}
    ], `Article is saved in the Reader's library`)

    const publisherWithdraw = async t => {
        await t.resolves(Publisher.publisherWithdraw(chId, publisher),
            `Publisher withdraws`)
        await t.expect([
            balance(publisher), 'to be fulfilled with',
            publisherOpeningBalance + article.price
        ], `Publisher receives article price`)
    }

    const readerWithdraw = async t => {
        const {withdrawalRequest} = await Reader.requestWithdraw(reader)
        const {withdrawal} =
            await Publisher.readerWithdraw(withdrawalRequest, publisher)
        await t.resolves(Reader.withdraw(withdrawal, reader),
            `Reader withdraws`)
        await t.expect([
            balance(reader), 'to be fulfilled with',
            readerOpeningBalance - article.price
        ], `Reader balance is reduced by article price`)
    }

    await t.test(`Withdraw without round increment`, async t => {
        await publisherWithdraw(t)
        await readerWithdraw(t)
    })
    await t.test(`Withdraw with round increment`, async t => {
        await readerWithdraw(t)
        await publisherWithdraw(t)
    })
}).catch(t.threw)
