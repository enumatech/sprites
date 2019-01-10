const tap = require('tap')
const unexpected = require('unexpected')

tap.Test.prototype.expect = async function (unexcpectedArgs, message, extra) {
    const extraWithFailMsg = e => ({...extra, found: '', wanted: e.message})

    let expectation
    try {
        // `await` unifies sync and async throw
        expectation = Promise.resolve(unexpected(...unexcpectedArgs))
    } catch (e) {
        return this.resolves(e, message, extraWithFailMsg(e))
    }

    return this.resolves(expectation, message, extra)
}

tap.Test.prototype.expect.it = unexpected.it.bind(unexpected)

tap.reporter = reporterName =>
    tap.pipe(new (require('tap-mocha-reporter'))(reporterName))

module.exports = tap
