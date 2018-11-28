#!/usr/bin/env bash

export BASEDIR="$(dirname "$0")"
KEYSTORE="$(realpath "$BASEDIR/../keystore")"

while [ ! -d "$KEYSTORE" ]; do
    echo "Waiting for keystore ($KEYSTORE)..."
    sleep 0.3
done

ACCOUNTS=$("$BASEDIR"/list-keystore.sh "$KEYSTORE")
APIS="personal,net,eth,web3"

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
    --rpcvhosts=* \
    "$@"
