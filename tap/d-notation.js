module.exports = function (BigNumber, inspect) {
    function inspectD() {
        return "D`" + this.toString() + "`"
    }

    BigNumber.prototype[inspect.custom] = inspectD
    BigNumber.prototype[Symbol.toPrimitive] = inspectD

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
