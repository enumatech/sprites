# Sprites

This [monorepo](https://trunkbaseddevelopment.com/monorepos/) contains a
JavaScript library interfacing with Ethereum smart contracts which implement
[Sprites state-channels](https://arxiv.org/abs/1702.05812).

This project is funded by the Ethereum Foundation's
[scaling grant](https://blog.ethereum.org/2018/05/02/announcing-may-2018-cohort-ef-grants/).

You can find documentation, experiments and example applications in other
folders.



## Install

Prerequisite on both macOS and Linux:
- [Nix 2.0](https://nixos.org/nix/) package manager

```
git clone https://github.com/enumatech/sprites
cd sprites/
nix-shell
```

For the first time, you have to wait a few minutes until the "system
dependencies" are downloaded; subsequent `nix-shell`s should start
in a few seconds.

```
npm install
overmind start
```

The example applications may rely on the [Metamask](https://metamask.io)
browser plugin being installed.

To try these applications, you need to provide this 12 word,
[BIP39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
mnemonic sentence:

```
network gain army age zebra tuna bracket fire fall section direct stay
```

in the _Restore from seed phrase_ MetaMask dialog.
As a password you can specify whatever you like, we don't have to know it.

Accounts derived from the mnemonic sentence, aka seed phrase, are shared
between the automated tests and the example apps.

We refer to these accounts through out the test code and documentation
with the following names:

1. Deployer
1. Alice
1. Bob
1. Eve

The Deployer, being the 1st imported account, becomes the coinbase and
the built-in genesis block of the `geth --dev` chain funds it with tons of ETH.

You should see this huge ETH balance going beyond the Metamask plugin
dialog box, for _Account 1_ (`0xd124b...`), which is the Deployer account.

Create Alice, Bob and Eve accounts with the _Create Account_ menu,
which generates them deterministically from the mnemonic sentence,
aka seed phrase.



## Overmind processes

[Overmind](https://github.com/DarthSim/overmind) will populate a keystore,
starts 2 `geth --dev` chains and recompiles the smart contracts when they change.

If `overmind start` exits and returns to your shell, you might have
encountered this error:

```
geth    | Fatal: Error starting protocol stack: listen tcp 0.0.0.0:8545: bind: address already in use.
geth    |
geth    | Exited
reader  | Interrupting...
solc    | Interrupting...
publisher | Interrupting...
reader  |
publisher |
publisher | Exited
solc    | Exited
reader  | Exited
```

It means you already have a `go-ethereum` node running on port `8545`,
so you just have to stop that node and run `overmind start` again.


### `keystore` process

It imports example accounts, which are derived from the
mnemonic sentence mentioned above, into the `./keystore`
directory which is used by the `geth` processes.

The accounts are encrypted with an empty string as a password.

### `dev-chain` process

It waits for the appearance of the `keystore` directory.

It starts with the example accounts unlocked, so they can be used without
human interaction in the backends of the example applications.

It listens on http://localhost:8545.

It persists the chain in the `./dev-chain` directory, to preserve the nonces
of the example accounts and provide a stable address for the deployed
example contracts.

If we wouldn't persist this data, we would need to reset MetaMask's state
every time we restart `overmind` and we might need to register our
demo token address with multiple accounts, which is rather inconvenient.


### `test-chain` process

It runs purely in memory to provide a temporary place for the contracts
deployed and exercised from the automated test suite.

It shares its `keystore` with the `dev-chain`.

It starts with the example accounts unlocked, so automated tests can
run fast. Unlocking accounts from the tests can add several seconds
overhead to the test run time.

It listens on the `./test-chain.ipc` socket, to avoid the troubles of managing
clashing port numbers.

We experienced some issues with the IPC connection though.
Until that's fixed, the `test-chain` also listens on http://localhost:9545.


### `solc` process

It monitors the `./contracts` directory with the [entr](http://entrproject.org)
file watcher for Solidity source code changes and recompiles them with `solc`
automatically, placing the output into the `./out/contracts.json` file.



## Example applications

* [Paywall](examples/paywall/)
