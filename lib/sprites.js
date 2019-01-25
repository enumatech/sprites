// ----------------------------------------------------------------------------
// sprites.js
// Enuma Sprites PoC
//
// Copyright (c) 2018 Enuma Technologies Limited.
// https://www.enuma.io/
// ----------------------------------------------------------------------------

const {
    curry, ap, map, filter, identity, pathOr, none, isNil, assoc, assocPath,
    has, memoizeWith, keys, propEq, equals, indexOf, toUpper, evolve, range,
    includes, length, omit, inc
} = require('ramda')
const {thread, update, address} = require('./fp.js')
const assert = require('assert')
const {inspect} = require('util')
const Web3Eth = require('web3-eth')
const Web3EthContract = require('web3-eth-contract')
const ethers = require('ethers')
const {utils: {BigNumber, parseEther}} = ethers
const H = require('./test-helpers.js')
const ChannelState = require('./channel-state.js')
const Sign = require('./sign.js')

/* istanbul ignore next: debug aid only */
const errorFrom = curry((methodName, args, error) => {
    const argArray = inspect([...args], {depth: 3})
    const argList = '(' + argArray.slice(1, argArray.length - 1) + ')'
    error.message = `${methodName}${argList}:\n${error.message}`
    throw error
})

const Sprites = {
    make(opts) {
        return {
            web3Provider: undefined,
            gas: 4e6,
            preimageManager: undefined,
            reg: undefined,
            token: undefined,
            ownAddress: undefined,
            offChainReg: undefined,

            chId: undefined,
            channel: undefined,
            tx: undefined,
            tokenBalance: undefined,

            // Debug facilities
            [inspect.custom]: Sprites.inspector,
            [Symbol.toPrimitive]: Sprites.inspector,

            // Used by migration to ethers.js
            chain: undefined,
            wallet: undefined,
            ethersPreimageManager: undefined,
            ethersRegistry: undefined,
            ethersToken: undefined,
            ...opts
        }
    },

    boringFields: `
      wallet
      inspect
      web3Provider
      gas
      preimageManager
      token
      privateKey
    `.split(/\s+/),

    inspector() {
        return reject(isNil, {
            wallet: this.wallet,
            ...omit(Sprites.boringFields, this)
        })
    },

    async testDeploy({web3Provider}) {
        const eth = new Web3Eth(web3Provider)
        const [DEPLOYER, ALICE, BOB, EVE] = await H.waitForAccounts(web3Provider)
        const {
            PreimageManager,
            SpritesRegistry,
            ERC20Token
        } = Sprites.ABIs()

        const deploy = async (abi, ...args) =>
            H.deploy(web3Provider, abi, DEPLOYER, ...args)

        // const [preimageManager, token] = await Promise.all([
        //     deploy(PreimageManager),
        //     deploy(ERC20Token, "DAI stable coin", "DAI", 0, 1e6, DEPLOYER)])
        const preimageManager = await deploy(PreimageManager)
        const token = await deploy(ERC20Token, "DAI stable coin", "DAI", 0, 1e6, DEPLOYER)
        const reg = await deploy(SpritesRegistry, address(preimageManager))

        const sendEther = async (who) => {
            const minAmount = 10e18
            const balance = await eth.getBalance(who)

            /* istanbul ignore if: test optimization helper */
            if (balance < minAmount) {
                return eth.sendTransaction({from: DEPLOYER, to: who, value: minAmount})
            } else {
                return `Have more than ${minAmount}: ${balance}`
            }
        }

        const sendToken = async (who) =>
            token.transfer(who, 1e3).send({from: DEPLOYER})

        // await Promise.all(ap([sendEther, sendToken], [ALICE, BOB, EVE]))
        await sendEther(ALICE)
        await sendToken(ALICE)
        await sendEther(BOB)
        await sendToken(BOB)
        await sendEther(EVE)
        await sendToken(EVE)

        return Sprites.make({
            web3Provider,
            accounts: {DEPLOYER, ALICE, BOB, EVE},
            ...map(address, {preimageManager, reg, token}),
            [inspect.custom]: Sprites.inspector
        })
    },

    /**
     * @param chain - ethers.providers.Provider
     * */
    async testEthersDeploy(chain) {
        const Deployer = await chain.getSigner(0)
        Deployer.NAME = 'Deployer'

        const {
            PreimageManager,
            SpritesRegistry,
            ERC20Token
        } = Sprites.ABIs()

        const deploy = async ({abi: abiStr, bin, NAME}, ...args) => {
            const abi = JSON.parse(abiStr)
            const contractFactory = new ethers.ContractFactory(abi, bin, Deployer)
            const contract = await (await contractFactory.deploy(...args)).deployed()
            contract.NAME = NAME
            return contract
        }

        const decimals = 0
        const supply = new BigNumber(`10`).pow(6)
        const holder = await Deployer.getAddress()

        const token =
            await deploy(ERC20Token, "Test DAI", "DAI",
                decimals, supply, holder)

        const preimageManager = await deploy(PreimageManager)
        const registry = await deploy(SpritesRegistry, preimageManager.address)
        Object.assign(registry.interface.events, token.interface.events)

        return Sprites.make({
            chain,
            wallet: Deployer,
            ethersPreimageManager: preimageManager,
            ethersRegistry: registry,
            ethersToken: token
        })
    },

    randomTestClient: curry(async (NAME, s) => {
        const {ethersPreimageManager, ethersRegistry, ethersToken} = s
        const wallet = ethers.Wallet.createRandom().connect(ethersRegistry.provider)
        wallet.NAME = NAME    // Used by `util.inspect`

        const sendEther = async (who) =>
            ethersRegistry.signer.sendTransaction({
                to: await who.getAddress(),
                value: parseEther(`10`)
            })

        const sendToken = async (who) =>
            ethersToken.transfer(await who.getAddress(), new BigNumber(`1000`))

        await sendEther(wallet)
        await sendToken(wallet)

        const connectContract = (contract) => {
            const connectedContract = contract.connect(wallet)
            // Preserve contract name if any
            connectedContract.NAME = contract.NAME
            return connectedContract
        }


        const contracts = {ethersPreimageManager, ethersRegistry, ethersToken}
        return Sprites.make({wallet, ...map(connectContract, contracts)})
    }),

    /**
     * Debug aid, returning ETH and DAI balances of the Sprites actor
     * */
    async balances(s) {
        const {ethersToken, wallet} = s
        return {
            ETH: await wallet.getBalance(),
            DAI: await ethersToken.balanceOf(await wallet.getAddress()),
            who: inspect(wallet)
        }
    },

    ABIs: memoizeWith(identity, () => H.loadContracts()),

    contract(instanceName, contractName, s) {
        const ABIs = Sprites.ABIs()
        if (!has(contractName, ABIs))
            throw Error(`ABI "${contractName}" not found amongst known contracts: ${keys(ABIs)}`)

        const abi = JSON.parse(ABIs[contractName].abi)
        const addr = s[instanceName]
        assert(!isNil(addr), `Unknown contract "${instanceName}" in:\n` + inspect(s))
        const {web3Provider, ownAddress, gas} = s
        assert(ownAddress, `Missing ownAddress from:\n` + inspect(s))
        assert(gas, `Missing gas from:\n` + inspect(s))
        const inspector = () => `${contractName}(${addr})`
        return thread(
            new Web3EthContract(abi, addr, {from: ownAddress, gas}),
            c => (c.setProvider(web3Provider), c),
            H.liftMethods,
            assoc(inspect.custom, inspector),
            assoc('toJSON', inspector))
    },

    /**
     * Turns the properties containing contract addresses into ContractMethods object.
     *
     * @param sprites
     * @returns {{preimageManager: ContractMethods, reg: ContractMethods, token: ContractMethods}}
     */
    withWeb3Contracts(s) {
        const preimageManager = Sprites.contract('preimageManager', 'PreimageManager', s)
        const token = Sprites.contract('token', 'ERC20Interface', s)
        const tokenEventABIs =
            filter(propEq('type', 'event'), token.options.jsonInterface)

        const reg = Sprites.contract('reg', 'SpritesRegistry', s)
        // Allow decoding events emitted by token methods
        // when called from within reg registry methods
        reg.options.jsonInterface.push(...tokenEventABIs)

        return {...s, preimageManager, reg, token}
    },

    /**
     * Initializes a signer function which is specialized to the channel
     * actor and its blockchain provider.
     *
     * When the signer function is logged, it shows the optional actor name
     * and its Ethereum address to help with debugging.
     * */
    withRemoteSigner(sprites) {
        const {web3Provider, ownAddress, wallet} = sprites
        const sign = Sign.remotely(web3Provider, ownAddress)
        sign[inspect.custom] = function () {
            return `[Function: Sign remotely by ${prop('NAME', wallet) || ownAddress}]`
        }
        return {...sprites, sign}
    },

    ownIdx(s) {
        const {ownAddress, channel: ch} = s

        assert(!isNil(ownAddress),
            `Own address is missing:\n` + inspect(s))

        assert(none(isNil, pathOr([null, null], ['channel', 'players'], s)),
            `Channel actors are missing:\n` + inspect(s))

        const idx = indexOf(toUpper(ownAddress), map(toUpper, ch.players))

        assert(idx !== -1,
            `Own address "${ownAddress}" is not a player in channel:\n` +
            inspect(s))

        return idx
    },

    otherIdx(s) {
        return Sprites.ownIdx(s) === 0 ? 1 : 0
    },

    async sign(s) {
        const sig = await s.sign(ChannelState.serialize(s.channel))
        /*
        * Append metadata - which is preserved over the wire -
        * to the signature to aid debugging.
        *
        * It can causes a
        *
        *   `Compared values have no visual difference.`
        *
        * assertion error when using Jest
        *
        *   `expect(sigs).toMatchObject(cloneOfSigs)`
        * */
        sig.by = {
            actor: propOr('anon', 'NAME', s.wallet),
            addr: s.ownAddress
        }
        sig.ch = assoc(inspect.custom, ChannelState.inspector, s.channel)
        sig[inspect.custom] = function () {
            return `${this.by.NAME}(ch${this.ch.chId}r${this.ch.round})`
        }

        return assocPath(['channel', 'sigs', Sprites.ownIdx(s)], sig, s)
    },

    withSigs: curry((sigs, sprites) =>
        assocPath(['channel', 'sigs'], sigs, sprites)),

    channelOnChain: curry(async function (s) {
        const {chId} = s
        assert(!isNil(chId), `Missing chId:\n`, inspect(s))
        let state, players, withdrawn
        try {
            // FIXME Once web3 can decode tuples we can replace
            //  the separate calls with:
            //
            //     state = await reg.channels(chId).call()
            //
            // Currently web3 can't decode struct/tuple return values,
            // so `reg.channels(chID)` fails with:
            //     Error: Invalid solidity type: tuple
            //
            [state, players] = await Promise.all([
                s.reg.getState(chId).call(),
                s.reg.getPlayers(chId).call()
            ])
            withdrawn = await Promise.all([
                s.reg.getWithdrawn(chId).call({from: players[0]}),
                s.reg.getWithdrawn(chId).call({from: players[1]})
            ])
        } catch (e) {
            /* istanbul ignore else: not sure how to provoke other errors */
            if (e.message === "Couldn't decode uint256 from ABI: 0x") {
                throw Error(`Unknown channel ${chId}`)
            } else {
                throw e
            }
        }
        const parseIntArray = map(parseInt)
        const completeState = thread(
            {
                ...ChannelState.make(),
                ...state,
                withdrawn,
                players,
                chId
            },
            evolve({
                round: parseInt,
                deposits: parseIntArray,
                credits: parseIntArray,
                withdrawals: parseIntArray,
                withdrawn: parseIntArray,
                amount: parseInt,
                expiry: parseInt
            }))
        // Cleanup web3 contract return values indexed by position
        range(0, 8).forEach(i => delete completeState[i])
        return {...s, channel: completeState}
    }),

    /**
     * The selected channel's combined on-chain and off-chain state
     *
     * @param s
     * */
    channelState: async (s) => {
        const {chId} = s
        const [offChainChannel, onChain] = await Promise.all([
            s.offChainReg.ch(chId),
            Sprites.channelOnChain(s)])

        let channel
        if (isNil(offChainChannel)) {
            channel = onChain.channel
        } else {
            assert(onChain.channel.round <= offChainChannel.round,
                `Off-chain channel state is behind on-chain state:\n` +
                `${onChain.channel}\n` +
                `${offChainChannel}`)
            channel = {
                ...offChainChannel,
                deposits: onChain.channel.deposits,
                withdrawn: onChain.channel.withdrawn,
            }
        }
        const inspectableChannel =
            assoc(inspect.custom, ChannelState.inspector, channel)
        return {...s, channel: inspectableChannel}
    },

    async tokenBalance(s) {
        const balance = await s.token.balanceOf(s.ownAddress).call()
        return {...s, tokenBalance: parseInt(balance)}
    },

    /**
     * Save a channel state & cmd into the off-chain channel registry
     *
     * @param s
     * */
    save: async (s) => {
        await s.offChainReg.update(s.channel)
        return s
    },

    transition: curry((xforms, sprites) =>
        update('channel', ChannelState.transition(xforms), sprites)),

    propose: curry(async (cmds, sprites) => {
        const {channel: ch} = sprites
        const chErr = (msg) => msg + ':\n' + inspect(ch)
        assert(ch.chId, chErr('Missing chId from channel'))
        assert(ch.round, chErr('Missing round from channel'))
        const proposal = {}
        return {...sprites, proposal}
    }),

    create: curry(async function (otherAddress, s) {
        const tx = await s.reg
            .create(otherAddress, address(s.token))
            .send().catch(errorFrom('create', arguments))
        const chId = parseInt(tx.events.EventInit.returnValues.chId)
        return {...s, chId}
    }),

    approve: curry(async function (amount, s) {
        const tx = await s.token
            .approve(address(s.reg), amount)
            .send().catch(errorFrom('approve', arguments))
        return {...s, tx}
    }),

    // Assume a that a channel is present
    deposit: curry(async function (amount, s) {
        const {chId} = s
        await s.reg
            .deposit(chId, amount)
            .send().catch(errorFrom('deposit', arguments))
        return s
    }),

    createWithDeposit: curry(async function (otherAddress, amount, s) {
        const tx = await s.reg
            .createWithDeposit(otherAddress, address(s.token), amount)
            .send().catch(errorFrom('createWithDeposit', arguments))
        const chId = parseInt(tx.events.EventInit.returnValues.chId)
        return {...s, tx, chId}
    }),

    /**
     * Verify if a channel state signed by the other party could be
     * used to update the on-chain channel state
     * */
    verifyUpdate: curry(async function (s) {
        const ch = s.channel
        const sig = ch.sigs[Sprites.otherIdx(s)]
        assert(!isNil(sig),
            `Counter party signature is missing from channel:\n` +
            inspect(s))
        return await s.reg
            .verifyUpdate(...ChannelState.vector(ch), sig)
            .call().catch(errorFrom('verifyUpdate', arguments))
    }),

    /**
     * Update a channel state to a state signed by the other party
     * */
    update: curry(async function (s) {
        const ch = s.channel
        const sig = ch.sigs[Sprites.otherIdx(s)]
        assert(!isNil(sig),
            `Counter party signature is missing from channel:\n` +
            inspect(s))
        const tx = await s.reg
            .update(...ChannelState.vector(ch), sig)
            .send().catch(errorFrom('update', arguments))
        return {...s, tx}
    }),

    withdraw: curry(async function (s) {
        const tx = await s.reg
            .withdraw(s.chId)
            .send().catch(errorFrom('withdraw', arguments))
        return {...s, tx}
    }),

    updateAndWithdraw: curry(async function (s) {
        const ch = s.channel
        const sig = ch.sigs[Sprites.otherIdx(s)]
        const tx = await s.reg
            .updateAndWithdraw(...ChannelState.vector(ch), sig)
            .send().catch(errorFrom('updateAndWithdraw', arguments))
        return {...s, tx}
    }),

    trigger: curry(async function (s) {
        const tx = await s.reg
            .trigger(s.chId)
            .send().catch(errorFrom('trigger', arguments))
        return {...s, tx}
    }),

    finalize: curry(async function (s) {
        const tx = await s.reg
            .finalize(s.chId)
            .send().catch(errorFrom('finalize', arguments))
        return {...s, tx}
    })
}

module.exports = Sprites
