// ----------------------------------------------------------------------------
// demo-catalog.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {map, indexBy, prop, range} = require('ramda')
const LoremIpsum = require('lorem-ipsum')

const newArticle = (id) => {
    const content = LoremIpsum({count: 5, units: 'paragraphs'})
    return {
        id: `aId-${id}`,
        price: 10 + id,
        title: LoremIpsum({count: 5, units: 'words'}),
        content: content,
        blurb: content.split('\n')[0]
    }
}

const Articles = map(newArticle, range(0, 2 + 1))
const demoCatalog = indexBy(prop('id'), Articles)

module.exports = demoCatalog
