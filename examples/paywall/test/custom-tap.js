const tap = require('tap')
const unexpected = require('unexpected')
const BigNumber = require('bignumber.js')
const {inspect} = require('util')

const inspectD = (value) => "D`" + value.toString() + "`"
BigNumber.prototype[inspect.custom] = function () {
    return inspectD(this)
}

// `D` stands for Decimal, just like in Python
function D(value, ...params) {
    if (value instanceof Array) {
        // it was called as D`1.23` probably
        return BigNumber(value[0])
    }
    if (typeof value === 'number') {
        throw new Error(`The Number "${value}" can't be accurately represented as a decimal. Provide it as a String.`)
    }
    return BigNumber(value)
}

global.D = D

const expect = unexpected.clone()

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
        output.text(inspectD(value));
    }
})

expect.addAssertion(
    '<BigNumber> [not] to be (less than|below) <BigNumber>',
    (expect, subject, value) => {
        expect(subject.isLessThan(value), '[not] to be truthy')
    })

tap.Test.prototype.addAssert('expect', 1,
    async function (expectation, maybeMessage, extra) {
        const extraWithFailMsg = e => ({...extra, found: '', wanted: e.message})
        const maybeDont = extra.expectFail ? "don't" : ''
        const message = maybeMessage ||
            maybeDont + ' expect ' + expectation.join(' ')

        let assertion
        try {
            assertion = expect(...expectation)
        } catch (e) {
            return this.fail(message, extraWithFailMsg(e))
        }

        return assertion.isPending()
            // ? this.resolves(assertion, message, extra)
            ? assertion.then(
                () => this.pass(message, extra),
                e => this.fail(message, extraWithFailMsg(e)))
            : this.pass(message, extra)
    })

tap.Test.prototype.expect.it = expect.it.bind(expect)

tap.reporter = reporterName =>
    tap.pipe(new (require('tap-mocha-reporter'))(reporterName))

module.exports = tap
