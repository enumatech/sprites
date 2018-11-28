keystore: ./bin/create-keystore.sh
dev-chain: ./bin/geth.sh --ipcdisable --rpc --datadir ./chaindata
test-chain: ./bin/geth.sh --ipcpath ./test-chain.ipc --rpc --rpcport 9545
solc: (find ./contracts -name '*.sol'; ls ./bin/.solc-colors ./bin/solc-combined.sh) | entr ./bin/solc-combined.sh "contracts/*.sol"
