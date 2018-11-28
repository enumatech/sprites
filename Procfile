keystore: ./bin/create-keystore.sh
dev-chain: ./bin/geth.sh --ipcdisable --rpc --datadir ./dev-chain
test-chain: ./bin/geth.sh --ipcpath $PWD/test-chain.ipc --rpc --rpcport 9545
solc: (find ./contracts -name '*.sol'; ls ./bin/.solc-colors ./bin/solc-combined.sh) | entr ./bin/solc-combined.sh "contracts/*.sol"
