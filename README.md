# Brickblock Smart Contracts

## Overview
* This README shows how to work with our smart contracts.
* [ECOSYSTEM.md](./ECOSYSTEM.md) gives an architectural overview and detailed information about the individual contracts
* [TEST-AGAINST-GETH.md](./TEST-AGAINST-GETH.md) explains how to run the tests against `geth` instead of truffle's `ganache`
* [WORST-CASE-SCENARIOS.md](./WORST-CASE-SCENARIOS.md) analyzes what could go wrong along with potential mitigation steps

## Prerequisites
* [Node.js](https://nodejs.org/en/) (we always work with the [latest LTS release](https://github.com/nodejs/Release#release-schedule))
* [yarn](https://yarnpkg.com)
* [Python 3](https://www.python.org) for running [mythril](https://github.com/ConsenSys/mythril)

## Installing
1. Create local `.env`:
    
    ```sh
    cp .env.example .env
    ```
    
    This is necessary to configure the right `$NODE_PATH` for easier pathing, for example.

1. Install dependencies:

    ```sh
    yarn
    ```

1. Install [mythril](https://github.com/ConsenSys/mythril), a security analysis tool for Ethereum smart contracts

    ```sh
    # You will need python3 and pip3 for this to work
    pip3 install mythril
    ```

## Testing
Tests are split in three categories: Main tests, Stress tests and Frozen Contract tests. In development mode we run all tests against truffle's [ganache](http://truffleframework.com/ganache/). Before submitting contracts to auditors or deploying contracts to Mainnet we always run the tests against `geth`, too. [TEST-AGAINST-GETH.md](./TEST-AGAINST-GETH.md) explains how this works. It is a heck of a lot slower _but_ it is closer to the production environment in which our contracts will eventually run so it gives as a higher degree of certainty that everything really works as expected.

#### Main Tests
Unit tests, testing the general functionality of our contracts.

Run them with:

```sh
yarn test
```

#### Stress Tests

Stress tests are implemented to mimic real world scenarios, such as creating reasonable random transaction amounts with maximum available iterations and users. That's why it is recomended to run these tests using an external ganache with the config mentioned below to assure there is enough money and users to put contracts under pressure.
The stress tests throw random values at those contracts where integer division can result in minor inaccuracies. These tests ensure that this "dust" doesn't get too big to be of significance.
They are split out of the normal tests because they take a very long time to run due to the amount of transactions being performed.

Run them with:   

- (Optional but recommended step) Run an external ganache with the following config, users: 100, default ether balance: 1000
- Each stress test should be run individually. To run a stress test:
```
yarn test:stress-test stress-tests/[testFilename.js]
```

#### Frozen Contract Tests
Contracts that have already been audited and/or deployed to Mainnet, so they're immutable for now. For example, `BrickblockToken` and `CustomPOAToken`.

Run them with:

```sh
yarn test:frozen
```

## Security Analysis
You can check for common smart contract vulnerabilities in our code with mythril:

```sh
yarn test:mythril
```

## Linting
Linting both `*.js` and `*.sol` files can be done using:

```
yarn lint
```

Lint `.sol` only:

```
yarn lint:sol
```

Lint `.js` only:

```
yarn lint:js
```

## Deployment
### Local testnet

Deploying with truffle will execute the [migrations/2_deploy_contracts.js](https://git.brickblock-dev.io/platform/smart-contracts/blob/master/migrations/2_deploy_contracts.js) which does the following:

1. Choose the right network configuration (depends on the `--network` argument)
2. Deploy registry
3. Deploy other contracts
4. Add all contracts to registry
5. Set ETH/EUR exchange rate
6. Run `finalizeTokenSale` on BBK contract in order to activate the BBK/ACT/FMR ecosystem
7. Distribute BBK tokens to `accounts[2-5]`

**Note: Make sure you have at least 6 accounts on your node setup**

* `account[0]` is the owner
* `account[1]` is the bonus address for BBK
* `account[2-5]` are BBK token holders


#### To deploy in a local truffle session
1. Run `yarn truffle develop --network dev`
2. In the truffle console, run `migrate --reset` to deploy fresh contract instances
3. Play around with the contracts, e.g. add a broker via

    ```js
    PoaManager.deployed()
        .then(poaManager => {
            poaManager.addBroker(web3.eth.accounts[3])
        })
    ```

#### CLI Helpers for POA :robot:
To move a POA token through different stages manually, we've built a little CLI helper:

1. Open a `truffle` console and deploy the contract ecosystem (see above)
1. Call the helper with `exec ./migrations/helpers/poa-token.js`
1. Follow the interactive prompt :shell:

#### To deploy on a local ganache
1. Start the [Ganache app](http://truffleframework.com/ganache/) (make sure it's running on `8545`in the settings!) or run `yarn ganache-cli -p 8545`
1. Run `yarn truffle migrate --reset --network dev`

### Testnet
#### To deploy on Rinkeby or Kovan
Run `yarn truffle migrate --reset --network [network name]`.
The network name can be `rinkeby` or `kovan`

#### Steps to deploy on Rinkeby
1. Install `geth` (MacOs users can run `brew install geth` on terminal)
1. Create or import 6 accounts for geth. See [Managing Accounts On Geth](https://github.com/ethereum/go-ethereum/wiki/Managing-your-accounts) for details.
1. Create a password file where each line is an account password in the same order as the created accounts.
2. 1. Run `geth` with the following arguments
    ```
    geth --rinkeby --rpc --unlock "0,1,2,3,4,5,6" --password "path to password file"
    ```
3. Wait for geth node to synchronize blocks.
4. On another terminal window, go to project folder and run
    ```
    yarn truffle migrate --network rinkeby
    ```

### Mainnet
Mainnet deployment is done through offline signing of transactions. See our [cold-store](https://git.brickblock-dev.io/core/cold-store) repo for the process.

### Interacting with deployed contracts
When you'd like to interact with deployed contracts on a local testnet, check that `truffle.js` setting for `dev` matches your local testrpc / ganache-cli settings and run:

`yarn truffle console --network dev`.

This will open a node.js repl session, with all the compiled contracts available as usual (ie. `BrickblockToken.deployed()` or `PoaToken.at(some-address)`).

If you'd like to interact with contracts on a public testnet (ie. rinkeby, kovan) then we have a command  that also uses `truffle console` and additionally makes use of the library `truffle-hdwallet-provider`. This allows us to specify a remote node to connect with and a mnemonic to give access to accounts in that HDWALLET (like MetaMask does).

NOTE: any valid bip39 mnemonic will work fine unless you want to send transactions or ETH, then you will need ETH in the sending account like usual. Feel free to use the example `HDWALLET_MNEMONIC` below.

An example for rinkeby is:

`HDWALLET_MNEMONIC="ridge approve ten planet fever oyster cargo upper frequent humor hen alcohol" INFURA_URL="https://rinkeby.infura.io" yarn repl`
