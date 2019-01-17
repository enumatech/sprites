module.exports = function (BN, inspect) {
    function inspectI() {
        return "I`" + this.toString() + "`"
    }

    BN.prototype[inspect.custom] = inspectI
    BN.prototype[Symbol.toPrimitive] = inspectI

    // `I` stands for Integer
    function I(value, ...params) {
        if (value instanceof Array) {
            // it was called as I`1.23` probably
            return new BN(value[0])
        }
        if (typeof value === 'number') {
            throw new Error(`The Number "${value}" can't be accurately represented as a decimal. Provide it as a String.`)
        }
        return new BN(value)
    }

    return I
}
