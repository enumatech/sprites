// ----------------------------------------------------------------------------
// paywall-api-client.js
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
                throw new Error(result.message)
            else
                return result
        } else {
            const error = JSON.stringify(result, null, 4)
            throw new Error(result.message)
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
    const api = makeApiFetch(fetch)

    return {
        config: async () => api.get('/config'),
        catalog: async () => api.get('/catalog'),
        invoice: async (order) => api.post('/invoice', order),
        processPayment: async (payment) => api.post('/payment', payment),
        getArticle: async (receipt) => api.post('/article', receipt)
    }
}
