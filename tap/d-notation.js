module.exports = function (BigNumber, inspect) {
    const inspectD = (value) => "D`" + value.toString() + "`"

    BigNumber.prototype[inspect.custom] = function () {
        return inspectD(this)
    }

    BigNumber.prototype[Symbol.toPrimitive] = function () {
        return inspectD(this)
    }

    // `D` stands for Decimal, just like in Python
    function D(value, ...params) {
        if (value instanceof Array) {
            // it was called as D`1.23` probably
            return new BigNumber(value[0])
        }
        if (typeof value === 'number') {
            throw new Error(`The Number "${value}" can't be accurately represented as a decimal. Provide it as a String.`)
        }
        return new BigNumber(value)
    }

    return D
}
