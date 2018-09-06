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

#### To deploy eco-system using migrations
##### Actions
There are pre-defined actions you can call with migrations
- --forceDeploy, --fd: Deploys contracts given as parameters. 'all' means deploy everything. Can be used with --uec to deploy only selected contracts and use the rest from the registry.
- --register, -r: Registers deployed contracts to Contract Registry
- --setRate, --sr: Updates ExchangeRate Contract to fetch 'EUR' currency from oraclize api (on ganache it uses a constant value instead of a real one) 
- --finalizeBbk, --fb: on BBK contract:
    - calls `changeFountainContractAddress` 
    - if the network is not mainnet, it distributes BBK token to Accounts[4,6]
    - calls `finalizeTokenSale`
    - calls `unpause`
- --addBroker, --ab: Adds accounts[1] as broker to PoaManager
- --deployPoa, --dp: Deploys a sample PoaToken with Broker account
- --addToWhiteList, --aw: Adds accounts[3] to whitelist
- --default, -a: Executes `register`, `setRate`, `finalizeBbk`, `addBroker`, `addToWhitelist` with the same order.
- --useExistingContracts, --uec: Uses existing contracts instead of deploy if they exist in "config/deployed-contracts.js"' with the chosen network. If it cannot find a pre-defined address, it deploys a new contract.
- --changeOwner, --co: Changes owner to `NEW_OWNER` given in `.env` file. Only useful if it deploys to mainnet.
- --help: Displays posible options

NOTES: 
- If no action specified, migration only deploys contracts without taking any further action.
- Only essential actions are grouped by `all` action to keep it more flexible

examples:   
```
# Deploy with default actions
yarn migrate:dev --default --fd all

# Use pre-deployed contracts
yarn migrate:dev --default --useExistingContracts
# short version
yarn migrate:dev -def --uec

# Deploy with some actions
yarn migrate:dev --fd all --register --setRate --finalizeBbk

# Ask for help
yarn migrate:dev --help

# To deploy POA Token
# make sure everything is deployed first
yarn migrate:dev --uec -dp
```

1. Start the [Ganache app](http://truffleframework.com/ganache/) (make sure it's running on `8545`in the settings!) or run `yarn ganache-cli -p 8545`
2. Run `yarn migrate:dev --[action name]`

#### To deploy on Rinkeby, Kovan or Ropsten
1. Make sure you set `TESTNET_MNEMONIC` and `INFURA_API_KEY` in `.env` file for your HD wallet
2. Run
```
yarn migrate:[network name] --def --fd all
```
The network name can be `rinkeby`, `kovan`, or `ropsten`

#### To deploy on Mainnet
The mainnet migration steps are:
* Deploys everything except Brickblock Contract
* then transfers ownership to our coldstore account

1. Make sure you set `MAINNET_MNEMONIC`, `INFURA_API_KEY` and `NEW_OWNER` in `.env` file for your HD wallet
2. Run:
```
yarn migrate:mainnet --register --finalizeBbk --changeOwner --useExistingContracts
```

#### Mainnet Checklist
- [ ] Perform migration on rinkeby or kovan using exact same script. The script should:
    * do everything the testnet deployments do
    * take into account the already deployed BrickblockToken (DO NOT DEPLOY A NEW ONE!)
    * change the owner to cold store owner address when everything else has been completed
    * double check manually all important aspects of the ecosystem such as
        * exchange rate fetching
        * locking in BBK
        * fee payments
        * poa creation
        * all stages & aspects of poas
- [ ] Make sure that the first account in the mnemonic wallet has enough ether (check previous testnet in order to get a cost estimate, make sure to take into acccount gas prices)
- [ ] double check current gas prices and make sure that the correct gas price is set in truffle.js
- [ ] double check mnemonic is correct (DO NOT USE TESTNET MNEMONIC)
 
#### Deploy to mainnet
In order to deploy the ecosystem to mainnet run the following: 
```
yarn truffle migrate --reset --network mainnet
```

#### Post Deployment Checklist
- [ ] Owner is cold store address
- [ ] check that each contract is deployed
- [ ] check that exchange rates works (fund it if needed)
- [ ] remove any remaining ether from deployment accounts and send somewhere secure

### Interacting with deployed contracts
When you'd like to interact with deployed contracts on a local testnet, check that `truffle.js` setting for `dev` matches your local testrpc / ganache-cli settings and run:

`yarn truffle console --network dev`.

This will open a node.js repl session, with all the compiled contracts available as usual (ie. `BrickblockToken.deployed()` or `PoaToken.at(some-address)`).

If you'd like to interact with contracts on a public testnet (ie. rinkeby, kovan) then we have a command  that also uses `truffle console` and additionally makes use of the library `truffle-hdwallet-provider`. This allows us to specify a remote node to connect with and a mnemonic to give access to accounts in that HDWALLET (like MetaMask does).

NOTE: any valid bip39 mnemonic will work fine unless you want to send transactions or ETH, then you will need ETH in the sending account like usual. Feel free to use the example `HDWALLET_MNEMONIC` below.

An example for rinkeby is:

`HDWALLET_MNEMONIC="ridge approve ten planet fever oyster cargo upper frequent humor hen alcohol" INFURA_URL="https://rinkeby.infura.io" yarn repl`