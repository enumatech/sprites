const tap = require('tap')
const unexpected = require('unexpected')
const {inspect} = require('util')

/* Returns a function which accepts a BigNumber constructor,
* which allows using ethers.js' own BigNumber implementation,
* which is actually a non-decimal, BN variant. */
module.exports = function ({BigNumber} = {}) {
    BigNumber = BigNumber || require('bignumber.js')
    const D = require('./d-notation.js')(BigNumber, inspect)

    const extendedExpect =
        require('./unexpected-bignumber.js')(unexpected.clone(), BigNumber)

    const extendedTap =
        require('./tap-unexpected.js')(tap, extendedExpect)

    return {
        tap,
        unexpected,
        BigNumber,
        D,
        inspect,
        expect: extendedExpect,
        t: extendedTap
    }
}

