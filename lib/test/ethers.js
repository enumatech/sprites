require('../globals')
const {t, D, ethers, testChain, inspect} = require('./helpers.js')
const {utils: {parseEther}} = ethers
const {times} = require('ramda')
const Sprites = require('../sprites.js')

t.test('ethers', async t => {
    // const url = 'http://localhost:9545'
    // const chain = new ethers.providers.JsonRpcProvider(url)
    const chain = testChain()
    const Deployer = await chain.getSigner(0)

    const {
        PreimageManager,
        SpritesRegistry,
        ERC20Token
    } = Sprites.ABIs()

    const deploy = async ({abi: abiStr, bin}, ...args) => {
        const abi = JSON.parse(abiStr)
        const contractFactory = new ethers.ContractFactory(abi, bin, Deployer)
        return (await contractFactory.deploy(...args)).deployed()
    }

    const preimageManager = await deploy(PreimageManager)
    const token = await deploy(ERC20Token,
        "DAI stable coin", "DAI", 0, D`10`.pow(6), await Deployer.getAddress())
    const reg = await deploy(SpritesRegistry, preimageManager.address)

    const actors = times(_ => ethers.Wallet.createRandom().connect(chain), 3)
    const [Alice, Bob, Eve] = actors

    const sendEther = async (who) =>
        Deployer.sendTransaction({
            to: who.address,
            value: parseEther(`10`)
        })

    const sendToken = async (who) =>
        token.transfer(who.address, D`1000`)

    // await Promise.all(ap([sendEther, sendToken], actors))
    await sendEther(Alice)
    await sendEther(Bob)
    await sendEther(Eve)
    await sendToken(Alice)
    await sendToken(Bob)
    await sendToken(Eve)

    const balances = async (who) =>
        [await who.getBalance(), await token.balanceOf(who.address)]

    t.comment(await Promise.all(map(balances, actors)))

    // return Sprites.make({
    //     web3Provider,
    //     accounts: {DEPLOYER, Alice, BOB, EVE},
    //     ...map(prop('address'), {preimageManager, reg, token}),
    //     [inspect.custom]: Sprites.inspector
    // })
})
