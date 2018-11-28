// ----------------------------------------------------------------------------
// fp.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {
    tap, curry, prop, assoc, path, assocPath, map, reduce, init, applyTo,
    fromPairs, toPairs, adjust, pipeP
} = require('ramda')
const {inspect} = require('util')
const assert = require('assert')

const FP = {
    log: console.log.bind(console),

    probe: x => tap(FP.log, x),

    sleep: async (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

    update: curry((property, transform, coll) =>
        assoc(property, transform(prop(property, coll)), coll)),

    updatePath: curry((aPath, transform, coll) =>
        assocPath(aPath, transform(path(aPath, coll)), coll)),

    thread: (init, ...fns) => reduce(applyTo, init, fns),

    // This implementation:
    //
    //     global.threadP = (init, ...fns) => applyTo(init)(pipeP(...fns))
    //
    // throws
    //
    //     TypeError: f.apply(...).then is not a function
    //
    // when 1st function is not async, eg:
    //
    //     await threadP(123, identity)
    //
    // so we must force the 1st function into an async one,
    // so it can compose with the rest.
    //
    threadP: (init, fn1, ...fns) =>
        applyTo(init)(pipeP(async function () {
            return fn1(...arguments)
        }, ...fns)),

    // https://github.com/ramda/ramda/wiki/Cookbook#map-keys-of-an-object-rename-keys-by-a-function
    renameKeysWith: curry((fn, obj) =>
        fromPairs(map(adjust(0, fn), toPairs(obj)))),

    address(contract) {
        const addr = path(['options', 'address'], contract)
        assert(addr, `Address missing from contract:\n` + inspect(contract))
        return addr
    }
}

module.exports = FP
