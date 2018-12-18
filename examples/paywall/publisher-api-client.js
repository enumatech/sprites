// ----------------------------------------------------------------------------
// publisher-api-client.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {has} = require('ramda')
const URLSearchParams = require('@ungap/url-search-params')

/**
 * Fetch-option defaults for API endpoints.
 *
 * It encodes post params as JSON, URI encodes GET params,
 * decodes JSON responses and API errors are turned into
 * Promise rejections.
 *
 * While `encodeURIComponents` works across environments,
 * it doesn't handle the encoding of nested objects, like
 * `URLSearchParams` does.
 * */
function makeJsonFetch(fetch) {
    return async (url, {qs = {}, headers = {}, body, ...opts} = {}) => {
        const urlWithQueryString =
            [url, new URLSearchParams(Object.entries(qs)).toString()]
                .filter(s => s !== '')
                .join('?')

        const jsonOpts = {
            ...opts,
            headers: {'Content-Type': 'application/json', ...headers},
            body: JSON.stringify(body)
        }

        const response = await fetch(urlWithQueryString, jsonOpts)
        const result = await response.json()

        if (response.ok) {
            if (has('message', result) && has('stack', result))
                throw new Error('[SERVER] ' + result.message)
            else
                return result
        } else {
            throw new Error(JSON.stringify(result, null, 4))
        }
    }
}

function makeApiFetch(fetch) {
    const jsonFetch = makeJsonFetch(fetch)

    return {
        get: async (url, qs = {}) => jsonFetch(url, {qs}),
        post: async (url, data) => jsonFetch(url, {method: 'POST', body: data})
    }
}

module.exports = (fetch) => {
    const http = makeApiFetch(fetch)

    return {
        config: async () => http.get('/config'),
        catalog: async () => http.get('/catalog'),
        invoice: async (order) => http.post('/invoice', order),
        processPayment: async (payment) => http.post('/payment', payment),
        getArticle: async (receipt) => http.post('/article', receipt),
        readerWithdraw: async (withdrawalRequest) =>
            http.post('/reader-withdraw', withdrawalRequest),
        // Demo endpoints.
        // They shouldn't exist in a real deployment without authorization!
        publisherWithdraw: async (chId) => http.post('/publisher-withdraw', {chId})
    }
}
