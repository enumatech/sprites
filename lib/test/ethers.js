require('../globals')
const {t, D, ethers, testChain, inspect} = require('./helpers.js')
const Sprites = require('../sprites.js')

t.test('ethers', async t => {
    // const url = 'http://localhost:9545'
    // const chain = new ethers.providers.JsonRpcProvider(url)
    const chain = testChain()
    const Deployer = await chain.getSigner(0)
    const Alice = ethers.Wallet.createRandom().connect(chain)
    // const Bob = ethers.Wallet.createRandom().connect(chain)
    // const Eve = ethers.Wallet.createRandom().connect(chain)

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

    const sendEther = async (who) =>
        Deployer.sendTransaction({
            to: await who.getAddress(),
            value: D`10`.pow(18)
        })

    const sendToken = async (who) =>
        token.transfer(who.address, D`10`.pow(3))
    // .send({from: Deployer.address})

    // await Promise.all(ap([sendEther, sendToken], [ALICE, BOB, EVE]))
    await sendEther(Alice)
    await sendToken(Alice)
    t.comment(await Alice.getBalance())
    // await sendEther(BOB)
    // await sendToken(BOB)
    // await sendEther(EVE)
    // await sendToken(EVE)
    //
    // return Sprites.make({
    //     web3Provider,
    //     accounts: {DEPLOYER, Alice, BOB, EVE},
    //     ...map(address, {preimageManager, reg, token}),
    //     [inspect.custom]: Sprites.inspector
    // })
})
