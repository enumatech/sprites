// ----------------------------------------------------------------------------
//
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {curry, isNil, isEmpty} = require('ramda')
const fs = require('fs')

const Jayson = module.exports = {
    parse: curry((errorMessage, jsonStr) => {
        if (isNil(jsonStr))
            throw Error(`"${errorMessage}" in "undefined", can not decode as JSON.`)
        if (isEmpty(jsonStr))
            throw Error(`"${errorMessage}" is an empty string, can not decode as JSON.`)
        try {
            return JSON.parse(jsonStr)
        } catch (e) {
            if (e instanceof SyntaxError) {
                throw SyntaxError([
                    e.message,
                    `Can not parse "${errorMessage}" as JSON:`,
                    `${jsonStr.slice(0, 30)}...`
                ].join('\n'))
            } else throw e
        }
    }),

    /*
     * Load a JSON file without caching and
     * preview the file if it's not a valid JSON
     */
    load(jsonFilePath) {
        const json = fs.readFileSync(jsonFilePath, 'utf-8')
        return Jayson.parse(jsonFilePath, json)
    }
}
