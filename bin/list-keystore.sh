#!/usr/bin/env bash

export BASEDIR="$(dirname "$0")"

if [ -z "$1" ]; then
    KEYSTORE="$BASEDIR/../keystore"
else
    KEYSTORE="$1"
fi

# Print comma separated account list for `geth --unlock ...`
echo $(ls "$KEYSTORE" | sort | head -n 4 | awk -F '--' '{print $3}') | tr ' ' ,
