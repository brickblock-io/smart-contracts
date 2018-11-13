# Testing Against Geth
Before submitting contracts for audit or deploying to Mainnet, we always run our tests against `geth` because the [majority of Mainnet Ethereum nodes](https://ethstats.net) run `geth`. This gives us the greatest possible certainty that everything will work as expected on Mainnet.

## Requirements
* [geth](https://geth.ethereum.org) `^1.8.10`
* [yarn](https://yarnpkg.com) `^1.6`

## How to run tests against a private `geth` blockchain

Open 2 terminal windows, `cd` into the project folder on both and then run:

| Terminal 1 | Terminal 2 |
|---|---|
| Start a local geth blockchain | Run the tests against your local geth blockchain |
| `yarn start:geth` | `yarn truffle test test/main-tests/<name-of-testfile>.js --network devGeth` |

### Notes:    
- You can run all tests in the `./test/main-tests/` folder against `geth`
- The initial geth config is in [./scripts/geth/genesis.json](./scripts/geth/genesis.json)
- Find the arguments used for running geth in [./scripts/geth/start-geth.sh](./scripts/geth/start-geth.sh) file.
- `yarn start:geth` first always deletes old chain data and starts with a fresh state
- Tests run _a lot_ slower against `geth`. This is expected and also the reason why we run tests against `ganach` during normal development
- **All JavaScript files loaded by geth via the `--preload` argument only support ES5.** Why? Because geth uses [otto](https://github.com/robertkrimen/otto) as its JavaScript interpreter. See [https://github.com/ethereum/go-ethereum/wiki/JavaScript-Console#caveat](https://github.com/ethereum/go-ethereum/wiki/JavaScript-Console#caveat)


### Auto Mining
[./scripts/geth/auto-mine.js](./scripts/geth/auto-mine.js) makes geth auto mine blocks (which it doesn't do per default!). If you don't want automining, e.g. for debugging purposes, outcomment the `--preload` argument in [./scripts/geth/start-geth.sh](./scripts/geth/start-geth.sh).

### Account Management
[./scripts/geth/manage-accounts.js](./scripts/geth/manage-accounts.js) unlocks 10 pre-made accounts for 60 minutes which should be enough for the test duration.

### Genesis Block
[./scripts/geth/genesis.json](./scripts/geth/genesis.json) configures the genesis block for geth. It creates 10 accounts filled with 100 ETH each in the `alloc` section.