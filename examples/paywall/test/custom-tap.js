const tap = require('tap')
const unexpected = require('unexpected')

tap.Test.prototype.expect = async function (unexcpectedArgs, message, extra) {
    const t_resolves = e =>
        this.resolves(e, message, {...extra, found: '', wanted: e.message})

    try {
        return unexpected(...unexcpectedArgs).catch(t_resolves)
    } catch (e) { // Handle synchronous throw, when `.catch()` cannot run
        return t_resolves(e)
    }
}

tap.Test.prototype.expect.it = unexpected.it.bind(unexpected)

tap.reporter = reporterName =>
    tap.pipe(new (require('tap-mocha-reporter'))(reporterName))

module.exports = tap
