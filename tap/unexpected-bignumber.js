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

    expect.addAssertion(
        '<BigNumber> [not] to be (less than|below) <BigNumber>',
        (expect, subject, value) => {
            expect(subject.isLessThan(value), '[not] to be truthy')
        })

    expect.addAssertion(
        '<BigNumber> [not] to satisfy <BigNumber>',
        (expect, subject, value) => {
            expect(subject.eq(value), '[not] to be truthy')
        })

    return expect
}
