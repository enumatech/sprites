# Paywall demo for the Sprites library

This is a demonstration of using the Sprites library for unconditional,
off-chain payments between 2 parties.

In a sprites payment channel one of the parties is a _Reader_ and the other
party is a _Publisher_.

_Publishers_ are selling _articles_ from their _catalog_, which _Readers_
purchase with the ERC20 tokens requested by the publisher.

Readers' _payments_ are acknowledged with a _receipt_, which they keep in
their personal _library_. Presenting these receipts later to the publisher,
allow them to receive the content of the article they paid for.

A _receipt_ contains an article reference and a digital signature of the
payment channel state at the time of purchase, signed by the publisher.

The publisher does not have to store receipts, because they can trust
a receipt if it carries their signature.

The publishers still has to maintain the off-chain state of the channels
they are involved in, so they can withdraw their funds and safely advance
the channel state with the readers.



## Install

Follow the installation instructions in the main [README](../../)
and import the mnemonic sentence into MetaMask too!

Install the Node.js dependencies which are specific to this example
application:

```
nix-shell
cd examples/paywall
npm install
```

In this demo Alice and Eve can act as a _Reader_ and _Bob_ plays the
_Publisher_ role.



## Start

This example has its own background processes, to provide HTTP servers
for an auto-bundling web app seen by Readers and an API for the Publisher.

There are no database servers; we simply use the browser local storage
and a JSON file via the [lowdb](https://github.com/typicode/lowdb)
abstraction layer, for demonstration purposes.

It shares the test and dev chains and their accounts with other projects
in this repo, so we assume you have already started an `overmind`
at the project root.

```
# Make sure we are in a nix-shell
echo $IN_NIX_SHELL   # => impure
pwd    # => .../sprites/examples/paywall
overmind start
```

Once output of `overmind` has settled, open http://localhost:9966 in
your browser and select the Alice account in your MetaMask.

### `publisher` process

It deploys smart contracts with `npm run deploy` and starts a HTTP server
with `npm run publisher`, exposing the Publisher API on http://localhost:3000.

The addresses of the deployed contracts are saved into the
`./sprites-config.json` file.

Chiefly a Sprites channel registry and a Preimage manager
contract is deployed for resolving disputes.

Then a very simple ERC20 token is available, with 0 decimal precision and
a huge total supply, which is originally owned by the Deployer account.

This token can be used in the payment channels, which currently support
tokens only, no ETH, for the sake of clarity.

To let you easily try this example, the deployer pre-funds the example accounts
with both some ETH and tokens, the same way as they are prepared for the
automated tests.

You can find the address of this token in the `./sprites-config.json` file's
`token` key.

In MetaMask there is an _ADD TOKEN_ feature, where you
can provide this address (for every account), so you can  follow how their
token balances change, while using the paywall.

Contracts, including the token contract, are redeployed every time you (re)start
the application, so you have to add the tokens again to MetaMask with their new
address.


### `reader` process

It starts a [beefy](http://didact.us/beefy/) webserver which bundles
the web app with browserify, on-demand, whenever you reload the page.

It is accessible via http://localhost:9966.



## Usage

We assume you switched to Alice in MetaMask and you are on the paywall
web page.

You can open a channel with the publisher, which will take 2 blockchain
transactions. The 1st one is an approval to the sprites channel registry
to take your tokens as a deposit and the 2nd one is opening a channel
with the publisher and transferring a deposit within one combined
transaction.

If you look into the `sprites` local storage key, you should see the initial
channel state there.

The publisher doesn't know about this channel yet, because it's on-chain
only at this moment, so their off-chain channel state in is still empty.

The off-chain channel state is stored in a plain JSON file under an
`off-chain-reg/<on-chain registry contract address>.json`, so a new file
is created when a new registry contract is deployed to the dev chain.
For the sake of convenience, the currently used off-chain registry file
is always accessible via the `off-chain-reg/latest.json` symlink, after
starting the `publisher` process.

After opening a channel, the _Buy_ buttons become enabled, so we can
buy them using an off-chain payment.

Such a payment will open a MetaMask popup, where we can sign a channel
state which combines crediting the publisher with the article price and
allowing withdrawals both by the reader and the publisher in one step.

At this point we should see the article contents and have a receipt in our
local storage under the `library` key, the channel state under the `sprites`
key and the publisher should see the same channel state in their
`off-chain-reg/latest.json`.

Now the publisher can choose to withdraw their balance onto the blockchain.
For this we provide a command-line utility:

```
node publisher-withdraw-all.js
```

After running that, we can switch to Bob in MetaMask and see their balance
grow.
