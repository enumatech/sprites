// ----------------------------------------------------------------------------
// dom.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {curry}=require('ramda')
const $ = document.querySelector.bind(document)
const element = document.createElement.bind(document)
const text = document.createTextNode.bind(document)

const fragment = (kids) => {
    const f = document.createDocumentFragment()
    kids.forEach(append(f))
    return f
}

const frag = (...kids) => fragment(kids)

const append = curry((node, kid) => {
    try {
        node.appendChild((typeof kid === 'string') ? text(kid) : kid)
    } catch (e) {
        e.message = `Can't append kid:\n${kid}\n${e.message}`
        console.error(e)
    }
    return node
})

const clear = (node) => {
    node.innerHTML = ""
    return node
}

const mount = (node, ...kids) => {
    clear(node)
    append(node, fragment(kids))
    return node
}

const setAttr = curry((node, attr, val) => {
    try {
        if (attr.startsWith('on'))
            node[attr] = val
        else
            node.setAttribute(attr, val)
    } catch (e) {
        const err = `Failed setting "${attr}" to "${val}"\n` + e.message
        console.error(err)
    }
    return node
})

const setAttrs = curry((node, attrs) => {
    Object.entries(attrs).forEach(([a, v]) => setAttr(node, a, v))
    return node
})

const disabled = (condition) => condition ? {disabled: ''} : ''

const elem = (tagName, attrs, kids) => {
    // console.log('tag', tagName)
    // console.log('attrs', attrs)
    // console.log('kids', kids)
    const el = element(tagName)
    setAttrs(el, attrs)
    kids.forEach(append(el))
    return el
}

// TODO Need more robust attribute detection
// because it's not scalable to detect children,
// especially if we accept different types and
// render them in a custom way.
const isElem = (x) => {
    return (x instanceof Element) ||
        (x instanceof DocumentFragment) ||
        (typeof x === 'string')
}

const H = tagName => (...attrsKids) => {
    const [maybeAttrs, ...maybeKids] = attrsKids
    const isAttr = !isElem(maybeAttrs)
    const attrs = isAttr ? maybeAttrs : {}
    const kids = isAttr ? maybeKids : attrsKids
    return elem(tagName, attrs, kids)
}

const div = H('div')
const span = H('span')
const p = H('p')
const pre = H('pre')
const a = H('a')
const h1 = H('h1')
const h2 = H('h2')
const h3 = H('h3')
const table = H('table')
const tr = H('tr')
const th = H('th')
const td = H('td')
const form = H('form')
const input = H('input')
const button = H('button')
const img = H('img')

module.exports = {
    element, fragment, append, clear, mount, setAttr, setAttrs, disabled,
    $, text, frag, elem, H, div, span, p, pre, a, h1, h2, h3, table, tr, th, td,
    form, input, button, img
}
