// ----------------------------------------------------------------------------
//
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {inspect} = require('util')
const fp = require('./fp.js')

/*
`inspect.defaultOptions` is not supported in a browserified environment.
*/
// inspect.defaultOptions.depth = 20

// The `twice` function allows destructuring and naming a value at once:
//
//     const [itself, {prop1, prop2}] = someOperation()
//
// or in the other order it's possible too:
//
//     const [{prop1, prop2}, itself] = someOperation()
//
global.twice = (x) => [x, x]

const R = require('ramda')
global.R = R

const expectedRamdaOverlap = ['test', 'toString']
const desiredRamdaKeys = R.difference(R.keys(R), expectedRamdaOverlap)
const actualRamdaOverlap = R.intersection(R.keys(global), desiredRamdaKeys)

if (!R.isEmpty(actualRamdaOverlap))
    console.warn(`The following unexpected Ramda functions already exist in the global scope:\n    ${actualRamdaOverlap}`)

Object.assign(global, R.pick(R.difference(desiredRamdaKeys, actualRamdaOverlap), R))

Object.assign(global, fp)

global.timeP = async (timerName, promise) => {
    console.time(timerName)
    const result = await promise
    console.timeEnd(timerName)
    return result
}

// Debug version of `update`
global.updateIfExists = curry((property, transform, coll) => {
    if (is(Object, coll) && !has(property, coll))
        throw Error(`Property "${property}" doesn't exist in Object[${keys(coll)}]`)
    return fp.update(property, transform, coll)
})

const Buffer = require('buffer')
if (typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer
}

// console.log Buffer instances
// as <Buffer "0x11223344">
// instead of <Buffer 11 22 33 44>,
// for conciseness and copy-paste-ability

function compactInspectBuffer() {
    let str = ''
    const max = Buffer.INSPECT_MAX_BYTES // 50 by default
    str = this.toString('hex', 0, max)
    if (this.length > max)
        str += ' ... '
    return `<${this.constructor.name} "0x${str}">`;
}

// Buffer.prototype[inspect.custom] = compactInspectBuffer

/**
 * Convenient `Buffer` constructor from an optionally 0x prefixed string
 *
 * Usage:
 *     B`abcdef`
 *     B``
 *     B`0x12`
 *     B('34')
 *     B('0x5678')
 *     B('1') => throws: Length should be even: "1"
 *     B(B`90`)
 * */
global.B = function B(maybeArray, ...params) {
    // value is an array if called as B`ff`
    const input = (Array.isArray(maybeArray)) ? maybeArray[0] : maybeArray

    if (Buffer.isBuffer(input))
        return input

    const nonPrefixedHex = input.startsWith('0x') ? input.slice(2) : input

    if (1 === nonPrefixedHex.length % 2)
        throw Error(`Length should be even: "${nonPrefixedHex}"`)

    return Buffer.from(nonPrefixedHex, 'hex')
}
