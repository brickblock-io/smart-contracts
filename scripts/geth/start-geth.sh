#!/bin/bash
#
# This script brings up a local geth blockchain to run tests against.
# If old chain data exists in the data dir, it will delete it and
# start with a clean state.

GETH_DATA_DIR='./private-chain-data'

if [ -d "$GETH_DATA_DIR/geth" ]; then
    printf '%s\n' "Removing old chain data from $GETH_DATA_DIR/geth"
    rm -rf "$GETH_DATA_DIR/geth"
fi

printf '%s\n' "init genesis block in $GETH_DATA_DIR/geth"
geth --datadir "$GETH_DATA_DIR" init "./scripts/geth/genesis.json"
printf '%s\n' "running geth..."
geth --datadir "$GETH_DATA_DIR" \
  --gasprice 0 \
  --maxpeers 0 console \
  --networkid 4447 \
  --nodiscover \
  --preload "scripts/geth/manage-accounts.js,scripts/geth/auto-mine.js" \
  --rpc \
  --rpcapi eth,net,web3,personal,miner,debug,txpool \
  --rpccorsdomain "*" \
  --targetgaslimit 94000000
