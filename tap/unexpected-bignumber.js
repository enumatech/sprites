const {inspect} = require('util')

module.exports = function(expect, BigNumber) {
    expect.addType({
        name: 'BigNumber',
        base: 'object',

        identify: function (value) {
            return BigNumber.isBigNumber(value)
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
        '<BigNumber> [not] to satisfy <BigNumber>',
        binaryOp('isEqualTo'))

    expect.addAssertion(
        '<BigNumber> [not] to be (greater than|above) <BigNumber>',
        binaryOp('isGreaterThan'))

    expect.addAssertion(
        '<BigNumber> [not] to be greater than or equal to <BigNumber>',
        binaryOp('isGreaterThanOrEqualTo'))

    expect.addAssertion(
        '<BigNumber> [not] to be (less than|below) <BigNumber>',
        binaryOp('isLessThan'))

    expect.addAssertion(
        '<BigNumber> [not] to be less than or equal to <BigNumber>',
        binaryOp('isLessThanOrEqualTo'))

    return expect
}
