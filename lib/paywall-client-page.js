// ----------------------------------------------------------------------------
//
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

require('./globals.js')
const {isNil, map, omit, split} = require('ramda')
const {keys} = require('ramda')
const {thread, threadP} = require('./fp.js')
const {NAMED_ACCOUNTS, ZERO_ADDR} = require('./test-helpers.js')
const util = require('util')
const {inspect} = util
const Web3Eth = require('web3-eth')
const Web3EthContract = require('web3-eth-contract')
const {waitForAccounts} = require('./test-helpers.js')
const low = require('lowdb')
const LowMem = require('lowdb/adapters/Memory')
const LowStorage = require('lowdb/adapters/LocalStorage')
const OffChainRegistry = require('./off-chain-registry.js')
const Sign = require('./sign.js')
const Sprites = require('./sprites.js')
const PaywallClient = require('./paywall-client.js')
const PaywallApiClient = require('./paywall-api-client.js')
const dom = require('./dom.js')
const {
    $, frag, disabled, div, span, p, pre, a, h1, h2, h3, table, tr, th, td,
    button, img
} = dom

const serverPort = 3000
const paywallUrl = `http://localhost:${serverPort}`
const paywallFetch = async (url, opts) => fetch(paywallUrl + url, opts)
const paywall = PaywallApiClient(paywallFetch)

/**
 * App state
 * */
let route = {view: 'loading'}
let pwc, catalog, library, article

/**
 * Actions
 * */
async function openChannel() {
    const amount = 30
    pwc = await threadP(pwc,
        PaywallClient.approve(amount),
        PaywallClient.firstDeposit(amount))
    render()
}

async function buyArticle(id) {
    pwc = PaywallClient.order(id, pwc)
    const {order} = pwc
    // console.log('order', order)

    const invoice = await paywall.invoice(order)
    // console.log('invoice', invoice)

    pwc = await PaywallClient.pay(invoice, pwc)
    const {payment} = pwc
    // console.log('payment', payment)

    const paymentReceipt = await paywall.processPayment(payment)
    // console.log('paymentReceipt', paymentReceipt)

    pwc = await PaywallClient.processReceipt(paymentReceipt, pwc)
    const {receipt} = pwc
    // console.log('receipt', receipt)
    await PaywallClient.saveReceipt(receipt, pwc)
    // Just to update the debug panel
    library = await PaywallClient.library(pwc)

    await setRoute('article', {receipt})
    // console.log('article', article)

    return article
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
    const cannotBuy = isNil(pwc.sprites.channel)
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
    isNil(pwc.sprites.channel)
        ? button({onclick: () => openChannel()}, 'Open channel')
        : ''

const CatalogView = ({catalog, library}) => View(
    OpenChannel(),
    Catalog({catalog, library}))

const Debug = ({pwc, library, route = {}}) => {
    if (isNil(pwc)) return ''
    const {sprites: {channel = {}}} = pwc
    const boringChannelFields = ['preimageHash', 'recipient', 'expiry', 'sigs']

    return div({class: 'debug'},
        h3('IDs of purchased articles'),
        pre(inspect(keys(library))),
        h3('Off-chain Sprites payment channel'),
        pre(inspect(omit(boringChannelFields, channel)))
    )
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
            catalog = await paywall.catalog()
            library = await PaywallClient.library(pwc)
            break

        case 'article':
            article = await paywall.getArticle(params.receipt)
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
        Debug({pwc, library, route})))
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

    const paywallConfig = await paywall.config()

    pwc = await threadP({
            ...PaywallClient.new(),
            db: low(new LowStorage('library')),
            sprites: thread({
                ...Sprites.new(),
                web3Provider,
                ownAddress,
                ACTOR_NAME: 'Paywall Client',
                offChainReg: new OffChainRegistry({
                    ownAddress,
                    db: low(new LowStorage('sprites'))
                }),
                sign: Sign.personal(web3Provider, ownAddress)
            })
        },
        PaywallClient.withPaywall(paywallConfig))
    // await PaywallClient.validatePaywall(paywallConfig, pwc)
    console.info('Paywall client (pwc)', pwc)

    await setRoute('catalog')

    // Expose app state for the REPL
    Object.assign(window, {eth})
}

// Expose immutable application parts for the REPL,
// to aid interactive explorations
Object.assign(window, {
    ...NAMED_ACCOUNTS, // DEPLOYER, ALICE, BOB, EVE
    util, Web3Eth, Web3EthContract, Sprites, PaywallClient,
    paywall, setRoute, render
})

// Expose mutable app state dynamically
Object.defineProperties(window, {
    route: {get: () => route},
    pwc: {get: () => pwc},
    s: {get: () => pwc.sprites},
    catalog: {get: () => catalog},
    library: {get: () => library},
    article: {get: () => article}
})

window.addEventListener('load', () =>
    start().catch(console.error))
