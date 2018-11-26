#!/usr/bin/env bash

KEYSTORE=$(dirname "$0")/../keystore
ACCOUNTS=$($(dirname "$0")/keystore.sh "$KEYSTORE")
APIS="shh,personal,net,eth,web3,txpool"

set -x

geth \
    --dev \
    --keystore "$KEYSTORE" \
    --unlock "$ACCOUNTS" \
    --password /dev/null \
    --verbosity 3 \
    --nousb \
    --rpcaddr 0.0.0.0 --rpccorsdomain "*" --rpcapi "$APIS" \
    --wsaddr 0.0.0.0 --wsorigins "*" --wsapi "$APIS" \
    --shh \
    --rpcvhosts=* \
    "$@"
