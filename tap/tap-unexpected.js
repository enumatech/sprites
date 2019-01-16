module.exports = function (tap, expect) {
    tap.Test.prototype.addAssert('expect', 1,
        async function (expectation, maybeMessage, extra) {
            const extraWithFailMsg = e => ({...extra, found: '', wanted: e.message})
            const maybeDont = extra.expectFail ? "don't" : ''
            const [_subject, assertionStr] = expectation
            const message = maybeMessage ||
                maybeDont + ' expect ... ' + assertionStr + ' ...'
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

    return tap
}
