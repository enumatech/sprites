const tap = require('tap')
const expect = require('unexpected')

tap.Test.prototype.addAssert('expect', 1,
    function ([subject, assertionName, ...rest], message, extra) {
        try {
            expect(subject, assertionName, ...rest)
        } catch (e) {
            return this.fail(message, {...extra, found: '', wanted: e.message})
        }
        return this.pass(message, extra)
    })

tap.reporter = reporterName =>
    tap.pipe(new (require('tap-mocha-reporter'))(reporterName))

module.exports = tap
