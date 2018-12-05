// ----------------------------------------------------------------------------
// jayson.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {curry, isNil, isEmpty} = require('ramda')
const fs = require('fs')

// Allow monkey patching JSON.parse and avoid stack overflow by
// using the - presumably - original implementation
const JSONparse = JSON.parse.bind(JSON)
// A monkey patch would look like:
//     JSON.parse = Jayson.parse('Smart JSON parser')

const Jayson = {
    /**
     * Parse a string as JSON.
     * If parsing fails, include the specified error message into the
     * exception message, along with the first few characters of the
     * input string, to help debugging.
     * */
    parse: curry((errorMessage, jsonStr) => {
        if (isNil(jsonStr))
            throw Error(`"${errorMessage}" in "null"/"undefined", can not decode as JSON.`)
        if (isEmpty(jsonStr))
            throw Error(`"${errorMessage}" is an empty string, can not decode as JSON.`)
        try {
            return JSONparse(jsonStr)
        } catch (e) {
            /* istanbul ignore else: Not sure how to trigger */
            if (e instanceof SyntaxError) {
                throw SyntaxError([
                    e.message,
                    `Can not parse "${errorMessage}" as JSON:`,
                    `${jsonStr.slice(0, 30)}...`
                ].join('\n'))
            } else throw e
        }
    }),

    /**
     * Load a JSON file without caching.
     *
     * If the file contents can't be decoded as JSON, it throws and exception.
     * The exception message contains both the filename and the first few
     * characters for the file (because the error most likely to be there).
     */
    load(jsonFilePath) {
        const json = fs.readFileSync(jsonFilePath, 'utf-8')
        return Jayson.parse(jsonFilePath, json)
    }
}

module.exports = Jayson
