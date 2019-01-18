require('../globals')
const {inspect} = require('util')
const ethers = require('ethers')
const {utils: {BigNumber: BN, parseEther}} = ethers
const I = require('@enumatech/tap/i-notation.js')(BN, inspect)
const expect = require('unexpected').clone()
require('@enumatech/tap/unexpected-bn.js')(expect, BN)

const transact = (contractMethodCall) =>
    contractMethodCall.then(receipt => receipt.wait())

const deploy = async ({abi: abiStr, bin}, args, Deployer) => {
    const abi = JSON.parse(abiStr)
    const contractFactory = new ethers.ContractFactory(abi, bin, Deployer)
    return (await contractFactory.deploy(...args)).deployed()
}

const sendEth = async (from, to, value) =>
    transact(from.sendTransaction({to: await to.getAddress(), value}))

const sendToken = async (fromToken, to, amt) =>
    transact(fromToken.transfer(await to.getAddress(), amt))

const expectEth = async (from, to, ethAmt = parseEther(`10`)) => {
    await sendEth(from, to, ethAmt)
    await expect(to.getBalance(), 'to be fulfilled with', ethAmt)
}

const expectToken = async (from, to, tokenAmt = I`20`) => {
    await sendToken(from, to, tokenAmt)
    await expect(from.balanceOf(to.address), 'to be fulfilled with', tokenAmt)
}

const run = async () => {
    const rpcPath = 'http://localhost:9545'
    const chain = new ethers.providers.JsonRpcProvider(rpcPath)
    const Deployer = await chain.getSigner(0)
    const mkActor = () => ethers.Wallet.createRandom().connect(chain)
    const Alice = mkActor()

    const {contracts} = require('../../out/contracts.json')
    const ERC20Token = contracts['contracts/ERC20Token.sol:ERC20Token']
    const decimals = 0
    const totalSupply = I`10`.pow(6)
    const initialHolder = await Deployer.getAddress()
    const token = await deploy(ERC20Token,
        ["Test DAI", "DAI", decimals, totalSupply, initialHolder],
        Deployer)

    await expectEth(Deployer, Alice)
    await expectToken(token, Alice)

    const expectFundsParallel = async () => {
        const Alice = mkActor()
        await Promise.all([
            expectEth(Deployer, Alice),
            expectToken(token, Alice)])
    }

    const expectFundsSequentially = async () => {
        const Alice = mkActor()
        await expectEth(Deployer, Alice)
        await expectToken(token, Alice)
    }

    await expectFundsParallel()
    await expectFundsSequentially()
}

run().catch(err => {
    // Cleanup assertion error, to make it concise
    err.parent = err.expect = undefined
    console.error(err)
})
