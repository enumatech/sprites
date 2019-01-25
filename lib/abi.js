const R = require('ramda')
const {thread} = require('./fp.js')

// This gives better errors if the JSON file is corrupt/empty:
//   const contracts = Jayson.load(Path.join(__dirname, '../out/contracts.json')).contracts
// This works both on Node.js and when Browserified:
const {contracts} = require('../out/contracts.json')

const ABIs = {
    PreimageManager: contracts["contracts/PreimageManager.sol:PreimageManager"],
    SpritesRegistry: contracts["contracts/SpritesRegistry.sol:SpritesRegistry"],
    ERC20Token: contracts["contracts/ERC20Token.sol:ERC20Token"],
    ERC20Interface: contracts["contracts/ERC20Interface.sol:ERC20Interface"],
    TestContract: contracts["contracts/TestContract.sol:TestContract"]
}

const withName = (contract, key) => ({...contract, NAME: key})

module.exports = thread(ABIs, R.reject(isNil), R.mapObjIndexed(withName))
