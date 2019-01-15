const {t} = require('@enumatech/tap')()

return t.pass('ok') // Labs are disabled by default

const {Wallet} = require('ethers')

let walletIdx = 0
const Deployer = Wallet.createRandom()

// TODO convert to generator to make it more self-contained
function nextWallet(wallet = Deployer) {
    const {signingKey: {mnemonic}} = wallet
    // The standard "m/44'/60'/0'/0/0"  wallet.path becomes
    // "m/2147483692'/2147483708'/2147483648'/0"
    // which throws "invalid path index - 2147483692"
    // when used with Wallet.fromMnemonic, so we can just hard-wire it
    const pathPrefix = "m/44'/60'/0'/0/0/"
    walletIdx += 1
    const nextPath = pathPrefix + walletIdx.toString()
    return Wallet.fromMnemonic(mnemonic, nextPath)
}

const sleep = ms => (new Promise(res => setTimeout(res, ms)))
const now = () => (new Date()).getTime().toString().slice(-4)

t.jobs = 2

// t.runOnly = true

const testPathIdxAfter = (delay, idx1, idx2) => async t => {
    t.comment('START ' + t.name + ' - ' + now())
    await sleep(delay)
    const Alice = nextWallet()
    const Bob = nextWallet()
    const paths = [Alice.signingKey.path, Bob.signingKey.path]
    t.comment(paths)
    t.equals(paths[0].slice(-1), idx1.toString())
    t.equals(paths[1].slice(-1), idx2.toString())
    t.end()
    t.comment('END ' + t.name + ' - ' + now())
}

t.test('Scenario 1', testPathIdxAfter(4000, 3, 4)) // Start 1st Done 2nd
t.only('Scenario 2', testPathIdxAfter(1000, 1, 2)) // Start 2nd Done 1st
t.test('Scenario 3', testPathIdxAfter(4000, 5, 6)) // Start 3rd Done 3rd
t.test('Scenario 4', testPathIdxAfter(2000, 7, 8)) // Start 4th Done 4th
