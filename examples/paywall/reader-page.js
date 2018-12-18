// ----------------------------------------------------------------------------
// reader-page.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {isNil, map, omit, split} = require('ramda')
const {keys, assocPath} = require('ramda')
const {log, thread, threadP} = require('sprites/lib/fp.js')
const {NAMED_ACCOUNTS, ZERO_ADDR} = require('sprites/lib/test-helpers.js')
const util = require('util')
const {inspect} = util
const Web3Eth = require('web3-eth')
const Web3EthContract = require('web3-eth-contract')
const {waitForAccounts} = require('sprites/lib/test-helpers.js')
const low = require('lowdb')
const LowMem = require('lowdb/adapters/Memory')
const LowStorage = require('lowdb/adapters/LocalStorage')
const OffChainRegistry = require('sprites/lib/off-chain-registry.js')
const Sign = require('sprites/lib/sign.js')
const Sprites = require('sprites')
const Paywall = require('./paywall.js')
const Reader = require('./reader.js')
const PublisherApiClient = require('./publisher-api-client.js')
const dom = require('./dom.js')
const {
    $, frag, disabled, div, span, p, pre, a, h1, h2, h3, table, tr, th, td,
    form, input, label, button, img
} = dom

const serverPort = 3000
const publisherUrl = `http://localhost:${serverPort}`
const publisherFetch = async (url, opts) => fetch(publisherUrl + url, opts)
const publisher = PublisherApiClient(publisherFetch)

/**
 * App state
 * */
let route = {view: 'loading'}
let reader, catalog, library, article

/**
 * Actions
 * */
async function openChannel() {
    const amount = 30
    reader = await threadP(reader,
        Reader.approve(amount),
        Reader.firstDeposit(amount))
    render()
}

async function deposit(amount) {
    reader = await threadP(reader,
        Reader.approve(amount),
        Reader.deposit(amount))
    render()
}

async function buyArticle(id) {
    reader = Reader.order(id, reader)
    const {order} = reader
    // console.log('order', order)

    const invoice = await publisher.invoice(order)
    // console.log('invoice', invoice)

    reader = await Reader.pay(invoice, reader)
    const {payment} = reader
    // console.log('payment', payment)

    const paymentReceipt = await publisher.processPayment(payment)
    // console.log('paymentReceipt', paymentReceipt)

    reader = await Reader.processReceipt(paymentReceipt, reader)
    const {receipt} = reader
    // console.log('receipt', receipt)
    await Reader.saveReceipt(receipt, reader)
    // Just to update the debug panel
    library = await Reader.library(reader)

    await setRoute('article', {receipt})
    // console.log('article', article)

    return article
}

async function publisherWithdraw() {
    const chId = reader.sprites.chId
    const {withdrawn} = await publisher.publisherWithdraw(chId)
    console.log('withdrawn', withdrawn)
    reader = await Paywall.channel(chId, reader)
    render()
}

async function readerWithdraw() {
    const chId = reader.sprites.chId
    const {withdrawalRequest} = await Reader.requestWithdraw(reader)
    const withdrawal = await publisher.readerWithdraw(withdrawalRequest)
    reader = await threadP(reader,
        Reader.withdraw(withdrawal),
        Paywall.channel(chId))
    render()
}

/**
 * Components
 * */
const View = (...kids) => div({class: 'view'}, ...kids)

const UnknownRouteView = (route) => View(
    h1('Unknown route'),
    pre(inspect({view, ...params})))

const LoadingView = () => View(
    h3('Loading...'))

const MetaMaskWebsite = 'https://metamask.io'

const MetaMaskMissingView = () => View(
    h1('Metamask not found'),
    h2('Please install from ',
        a({href: MetaMaskWebsite}, MetaMaskWebsite)))

const ArticleView = ({title, content}) => View(
    button({onclick: () => setRoute('catalog')}, '<<< Back to catalog'),
    h1(title),
    div(...thread(content, split('\n'), map(p))))

const ArticleEntry = ({id, price, title, blurb}) => {
    const img$ = img({src: `${id}.jpg`})
    const price$ = span({class: 'dai'}, `USD ${price}`)

    const receipt = library[id]
    const cannotBuy = isNil(reader.sprites.channel)
    const haveReceipt = !isNil(receipt)
    const readOrBuy$ =
        (haveReceipt
            ? a({onclick: () => setRoute('article', {receipt}), href: "#"},
                'Read more...')
            : button({onclick: () => buyArticle(id), ...disabled(cannotBuy)},
                "Buy"))

    return table(
        tr(th(img$)),
        tr(th(title)),
        tr(td(blurb)),
        tr(td(readOrBuy$, price$)))
}

const Catalog = ({catalog, library}) =>
    div(...map(article => ArticleEntry(article), catalog))

const OpenChannel = () =>
    isNil(reader.sprites.channel)
        ? button({onclick: () => openChannel()}, 'Open channel')
        : ''

const CatalogView = ({catalog, library}) => View(
    OpenChannel(),
    Catalog({catalog, library}))

const Debug = ({reader, library, route = {}}) => {
    if (isNil(reader)) return ''
    const {sprites: {channel = {}}} = reader
    const boringChannelFields = ['preimageHash', 'recipient', 'expiry', 'sigs']
    const depositField = input({type: "number", id: 'deposit', style: 'width: 6em'})
    const depositLabel = label({for: 'deposit'}, ' tokens ')
    const onDeposit = () => deposit(parseInt(depositField.value))

    return div({class: 'debug'},
        h3('IDs of purchased articles'),
        pre(inspect(keys(library))),
        h3('Off-chain Sprites payment channel'),
        pre(inspect(omit(boringChannelFields, channel))),
        button({onclick: () => publisherWithdraw()}, 'Publisher withdraw'),
        button({onclick: () => readerWithdraw()}, 'Reader withdraw'),
        form(
            button({onclick: onDeposit}, 'Deposit'),
            depositField, depositLabel))
}

const Views = (route) => {
    const {view, ...params} = route
    switch (view) {
        case 'loading':
            return LoadingView()

        case 'metamask-missing':
            return MetaMaskMissingView()

        case 'catalog':
            return CatalogView({catalog, library})

        case 'article':
            return ArticleView(article)

        default:
            return UnknownRouteView(route)
    }
}

/**
 * Selects a new route. Executes the related side-effects.
 * Re-renders the page.
 * Returns the route itself.
 *
 * If the route was not recognized, it prints and error
 * and returns the current route.
 * */
async function setRoute(view, params) {
    const newRoute = {...params, view}
    route = newRoute
    switch (view) {
        case 'loading':
        case 'metamask-missing':
            break

        case 'catalog':
            catalog = await publisher.catalog()
            library = await Reader.library(reader)
            break

        case 'article':
            article = await publisher.getArticle(params.receipt)
            break

        default:
            console.error(`Unknown route:\n${inspect(newRoute)}`)
    }
    render()
    return route
}

function render() {
    dom.mount($('#app'), frag(
        Views(route),
        Debug({reader, library, route})))
}

/**
 * Entry point
 * */
async function start() {
    render()
    let web3Provider, ownAddress
    if ('ethereum' in window) {
        web3Provider = window.ethereum
        ;[ownAddress] = await window.ethereum.enable()
        console.info(`Connected to Ethereum node via MetaMask`)
    } else {
        await setRoute('metamask-missing')
        return
    }
    console.info(`Using Ethereum address: ${ownAddress}`)
    const eth = new Web3Eth(web3Provider)

    const publisherConfig = await publisher.config()

    reader = await Reader.withPaywall(
        publisherConfig,
        Reader.make({
            db: low(new LowStorage(`library-${publisherConfig.reg}`)),
            sprites: Sprites.make({
                web3Provider,
                ownAddress,
                ACTOR_NAME: 'Paywall Client',
                offChainReg: new OffChainRegistry({
                    ownAddress,
                    db: low(new LowStorage(`sprites-${publisherConfig.reg}`))
                }),
                sign: Sign.personal(web3Provider, ownAddress)
            })
        })
    )
    // await Reader.validatePaywall(publisherConfig, reader)
    console.info('Paywall client (reader)', reader)

    await setRoute('catalog')

    // Expose app state for the REPL
    Object.assign(window, {eth})
}

// Expose immutable application parts for the REPL,
// to aid interactive explorations
Object.assign(window, {
    ...NAMED_ACCOUNTS, // DEPLOYER, ALICE, BOB, EVE
    util, Web3Eth, Web3EthContract, Sprites, Reader,
    publisher, setRoute, render
})

// Expose mutable app state dynamically
Object.defineProperties(window, {
    route: {get: () => route},
    reader: {get: () => reader},
    s: {get: () => reader.sprites},
    catalog: {get: () => catalog},
    library: {get: () => library},
    article: {get: () => article}
})

window.addEventListener('load', () =>
    start().catch(console.error))
