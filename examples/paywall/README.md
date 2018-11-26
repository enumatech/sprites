# Paywall demo for the Sprites library

This is a demonstration of using the Sprites library for
unconditional, off-chain payments between 2 parties.

In a sprites payment channel one of the parties is a _Reader_
and the other party is a _Publisher_.

_Publishers_ are selling _articles_ from their _catalog_, which _Readers_
purchase using ERC20 tokens desired by the publisher.

Readers' _payments_ are acknowledged with a _receipt_, which they keep in
their personal _library_. Presenting these receipts later to the publisher,
allow them to receive the content of the article they paid for.

A _receipt_ contains an article reference and a digital signature of the
payment channel state at the time of purchase, signed by the publisher.

To let people easily play with the system, we hard-wired and pre-funded
a few Ethereum accounts (aka wallets) into the demo.

These accounts are generated from the following mnemonic sentence,
which you can change in the [../../bin/keystore.sh]:

```
network gain army age zebra tuna bracket fire fall section direct stay
```

The first 4 accounts are used by both the automated tests and the demo.
We call them:

1. Deployer
1. Alice
1. Bob
1. Eve

In this demo Alice and Eve acts as a _Reader_ and _Bob_ assumes the
_Publisher_ role.

These accounts are imported into the [../../keystore](../../keystore)
directory, encrypted with an empty string and unlocked by `geth`
on startup, so they can be used without human interaction during
automated tests and from the publisher webserver.

To access these pre-funded account from the browser, you need the
[Metamask](https://metamask.io) plugin installed provide the
mnemonic stentence from above on their _Restore from seed phrase_
dialog. You can provide whatever password you like, then you should see
a huge ETH balance which goes beyond the Metamask plugin dialog box,
for _Account 1_ (`0xd124b...`), which is the Deployer account.
Create Alice, Bob and Eve accounts with the _Create Account_ menu,
which generates them deterministically from the seed phrase above.

We also deploy a very simple, ERC20 token, with 0 decimal precision
and a huge total supply, which is originally owned by the Deployer account.

This is the token our example uses as the currency for its payments.

You can find the address of this token in the `sprites-config.json` file's
`token` key. In Metamask there is an _ADD TOKEN_ feature, where you
can provide this address (for every account), then follow how their
token balances change, while using the paywall.

Contracts, including this token contract is redeployed every time you (re)start
the application, so you have to add the tokens again to Metamask with their new
address.

## Install

Prerequisite on both macOS and Linux:
- [Nix 2.0](https://nixos.org/nix/) package manager

```
git clone https://github.com/enumatech/sprites
cd sprites/
nix-shell
```

Wait a few minute until the "system dependencies" are downloaded for the
1st time, then

```
cd lib/
pnpm install
```

to acquire the Node.js dependencies.

## Start

```
overmind start
```

Once output of `overmind` has settled, open http://localhost:9966 in
your browser and select the Alice account in your Metamask.

If `overmind start` exits and returns to your shell, you might have
encountered this error:

```
geth    | Fatal: Error starting protocol stack: listen tcp 0.0.0.0:8545: bind: address already in use.
geth    |
geth    | Exited
client  | Interrupting...
solc    | Interrupting...
paywall | Interrupting...
client  |
paywall |
paywall | Exited
solc    | Exited
client  | Exited
```

It means you already have a `go-ethereum` node running on port `8545`,
so you just have to stop that node and run `overmind start` again.
