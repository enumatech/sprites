#!/usr/bin/env bash

# The private keys (PK) and their corresponding addresses are
# generated from the following 12 word mnemonic sentence:
MNEMONIC="network gain army age zebra tuna bracket fire fall section direct stay"

DEPLOYER_PK=e33292da27178504b848586dcee3011a7e21ee6ed96f9df17487fd6518a128c7
ALICE_PK=d8ae722d3a6876fd27907c434968e7373c6fbb985242e545a427531132ef3a71
BOB_PK=28e58f2f6a924d381e243ec1ca4a2239d2b35ebd9a44cec11aead6848a52630b
EVE_PK=8e1733c6774268aee3db54901086b1f642f51e60300674ae3b33f1e1217ec7f5

DEPLOYER=d124b979f746be85706daa1180227e716eafcc5c
ALICE=a49aad37c34e92236690b93e291ae5f10daf7cbe
BOB=b357fc3dbd4cdb7cbd96aa0a0bd905dbe56cab77
EVE=cbe431ff3fdcd4d735df5706e755d0f8726549f0

export BASEDIR="$(dirname "$0")"

if [ -z "$1" ]; then
    KEYSTORE=$(dirname "$0")/../keystore
else
    KEYSTORE="$1"
fi
KEYSTORE_ABS=$(realpath "$KEYSTORE")

if [ ! -d "$KEYSTORE_ABS" ]; then
    NEW_KEYSTORE=$(mktemp -d "$BASEDIR/../keystore-XXXXXX")
    for PK in DEPLOYER_PK ALICE_PK BOB_PK EVE_PK; do
        echo Importing private key: $PK > /dev/stderr
        geth --verbosity 2 \
            account import \
            --keystore "$NEW_KEYSTORE" \
            --password /dev/null \
            --lightkdf \
            <(echo ${!PK}) \
            >/dev/null
    done

    # Handle concurrent keystore creation
    if ln -s "$NEW_KEYSTORE" "$KEYSTORE"; then
        echo "Keystore has been created at $KEYSTORE_ABS"
        exit 0
    else
        echo -e "Keystore ($KEYSTORE_ABS) already exists\nRemoving temp keystore ($NEW_KEYSTORE)"
        rm -rf "$NEW_KEYSTORE"
    fi
fi

ADDRESS_LIST=$(ls "$KEYSTORE" | sort | gawk -F-- '{print $3}')
EXPECTED_ADDRESSES=$(echo -e "$DEPLOYER\n$ALICE\n$BOB\n$EVE")

if diff -u <(echo "$EXPECTED_ADDRESSES") <(echo "$ADDRESS_LIST"); then
    echo -e "The expected accounts has already been imported:\n$EXPECTED_ADDRESSES"
    exit 0
else
    echo "Keystore addresses differ from expected addresses."
    exit 1
fi
