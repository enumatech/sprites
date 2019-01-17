const {inspect} = require('util')
const assert = require('assert')

module.exports = function (expect, BN) {
    assert(BN, 'BN constructor/class is required')

    expect.addType({
        name: 'BN',
        base: 'object',

        identify: function (value) {
            return (BN.isBN && BN.isBN(value))
                // Support ethers.util.BigNumber too
                //     https://docs.ethers.io/ethers.js/html/api-utils.html#big-numbers
                // which is almost the same as BN.js
                //     https://github.com/indutny/bn.js/
                //
                // Unfortunately the author doesn't want to just follow BN.js:
                //     https://github.com/ethers-io/ethers.js/issues/228
                || (BN.isBigNumber && BN.isBigNumber(value))
        },

        equals: function (a, b, equal) {
            return a.isEqualTo(b)
        },

        inspect: function (value, depth, output) {
            output.text(inspect(value));
        },

        diff: function (actual, expected, output, diff, inspect) {
            return null
        }
    })

    const binaryOp = op => (expect, subject, value) => {
        expect(subject[op](value), '[not] to be truthy')
    }

    expect.addAssertion(
        '<BN> [not] to satisfy <BN>',
        binaryOp('eq'))

    expect.addAssertion(
        '<BN> [not] to be (greater than|above) <BN>',
        binaryOp('gt'))

    expect.addAssertion(
        '<BN> [not] to be greater than or equal to <BN>',
        binaryOp('gte'))

    expect.addAssertion(
        '<BN> [not] to be (less than|below) <BN>',
        binaryOp('lt'))

    expect.addAssertion(
        '<BN> [not] to be less than or equal to <BN>',
        binaryOp('lte'))

    return expect
}
