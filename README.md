# Brickblock Smart Contracts

This README shows how to work with our smart contracts. For an architectural overview, check the [Smart Contract Ecosystem doc](./ECOSYSTEM.md)

## Prerequisites
* [Node.js](https://nodejs.org/en/) (we always work with the [latest LTS release](https://github.com/nodejs/Release#release-schedule))
* [yarn](https://yarnpkg.com)
* [Python 3](https://www.python.org) for running [mythril](https://github.com/ConsenSys/mythril)

## Installing
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
Tests are split in three categories:

#### Main Tests
Unit tests, testing the general functionality of our contracts.

Run them with:

```sh
yarn test
```

#### Stress Tests

The stress tests throw random values at those contracts where integer division can result in minor inaccuracies. These tests ensure that this "dust" doesn't get too big to be of significance.
They are split out of the normal tests because they take a very long time to run due to the amount of transactions being performed.

Run them with:

```sh
yarn test:stress-tests
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

1. Choose the right network configuration (depends on the `--network` argument
1. Deploy registry
1. Deploy other contracts
1. Add all contracts to registry
1. Set ETH/EUR exchange rate
1. Run `finalizeTokenSale` on BBK contract in order to activate the BBK/ACT/FMR ecosystem
1. Distribute BBK tokens to `accounts[2-5]`

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

#### To deploy on a local ganache
1. Start the [Ganache app](http://truffleframework.com/ganache/) (make sure it's running on `8545`in the settings!) or run `yarn ganache-cli -p 8545`
1. Run `yarn truffle migrate --reset --network dev`

### Testnet
#### To deploy on Rinkeby or Kovan
Run `yarn truffle migrate --reset --network [network name]`.
The network name can be `rinkeby` or `kovan`


### Mainnet
Mainnet deployment is done through offline signing of transactions. See our [cold-store](https://git.brickblock-dev.io/core/cold-store) repo for the process.