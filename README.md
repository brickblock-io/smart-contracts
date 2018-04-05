# Brickblock Smart Contracts
 
## Installing

1. Install dependencies using:

    ```sh
    yarn
    ```

1. Install [mythril](https://github.com/ConsenSys/mythril), a security analysis tool for Ethereum smart contracts

    ```sh
    # You will need python3 and pip3 for this to work
    pip3 install mythril
    ```

## Running the tests

### Unit Tests
```
yarn test
```

### Stress Tests
```
yarn test:stress-test
```

### Security Analysis

```sh
yarn test:mythril
```

## Running the linter

```
yarn lint
```

## Development with testrpc and MetaMask
If you would like to use MetaMask in your dev environment then

* Copy the HD wallet mnemonic that testrpc logs during its initialization when running `yarn start:dev`
* Open the MetaMask extension in your browser, use the "lock" action from top right menu and click "I forgot my password"
* Use the copied mnemonic as the wallet seed
* set metamask network to `localhost:8545`
* This should give you some ETH and several accounts to work with
* If MetaMask gets out of sync (which can happen as it caches some state about the network it is connected to) then connect to another network and then back to your local testrpc on `localhost:8545`

## Deployment

Deployment is carried out through truffle in a `package.json` script:
```
yarn migrate:dev
```

### Deploy to Ropsten Test Net
If you want to deploy the contracts to ropsten (or mainnet in theory, but wouldn't be advisable and requires reconfiguration of truffle.js) then
* Go to MetaMask using an development wallet (maybe create a new one or use a shared Brickblock mnemonic)
* choose Ropsten Test Net
* click Buy -> Ropsten Test Faucet
* get some test ether (will take about 5min)
* go to  ≡ -> Settings -> Reveal Seed Words
* save them to a file
* set the env var HDWALLET_PATH
```sh
HDWALLET_PATH=/path/to/your/MetaMask\ Seed\ Words yarn migrate:ropsten
```
* open a shell and migrate via `yarn migrate:ropsten`

These are the smart contracts which will power the Ethereum side of our platform. The following are included:

1. BrickblockToken
1. BrickblockAccessToken
1. BrickblockFountain
1. Brickblock
1. POAToken

Initial drafts of each of these contracts have already been developed and will be released in the near future.

## BrickblockToken
BrickblockToken is an ERC20 Token with added features enabling the Brickblock contract to:

* send out tokens from the token sale
* finalise the token sale according to previously agreed up terms
* approve the fountain contract to transfer tokens
* change the stored address for the fountain contract
* be tradable amongst users
* be tradable on exchanges
* be upgradeable

Company tokens are locked in by assigning the value to the contract itself. The owner never starts with any token balance. This way there is no way to move the tokens without predetermined functions. The tokens are approved to be locked into the `BrickblockAccessToken` contract when `finalizeTokenSale` is called. Once when the tokens are locked into the `BrickblockAccessToken`, there will be no way to move them until November 30, 2020.

The `BrickblockAccessToken` contract will later be called to lock the company funds into the fountain. See below for more details.

## BrickblockAccessToken (Work in Progress)
`BrickblockAccessToken` allows for `BrickblockToken` holders to lock in their BBK in order to receive ACT whenever a fee is paid on the Brickblock network. When a fee is paid, users who have locked in their BBK receive an ACT reward proportional to their locked tokens relative to the entire locked BBK balance of the contract.

`BrickblockAccessToken` is an ERC20 compliant token contract.

## BrickblockFeeManager (Work in Progress)

`BrickblockFeeManager` allows for other smart contracts or accounts to pay a fee to the contract. When a fee is paid, ACT (BrickblockAccessTokens) are created and given proportionally to lockedBBK holders.

Owners of ACT can claim Ether by running `claimFee`. When claiming, ACT is burnt in return for Ether.

## BrickblockAccount (Work in Progress)

`BrickblockAccount` is the sole means of the company to interact with the company tokens before the token release date of November 30, 2020. The code preventing token withdrawal is here:

```
function withdrawBbkFunds(
    address _address,
    uint256 _value
  )
    external
    onlyOwner
    returns (bool)
  {
    require(fundsReleaseBlock < block.number);
    BrickblockToken bbk = BrickblockToken(
      registry.getContractAddress("BrickblockToken")
    );
    return bbk.transfer(_address, _value);
  }
```

The rest of this functionality allows Brickblock to interact with the ecosystem as any other participant.

## BrickblockContractRegistry (Work in Progress)
This contract allows for the communication between other smart contracts in our ecosystem.

## BrickblockWhitelist

This contract stores whitelisted addresses. This will allow users to buy POA tokens after being whitelisted.

## Brickblock (Work in Progress)
The Brickblock contract will allow brokers to be added and removed. It is also responsible for deploying new POATokens on behalf of the brokers. It will be able to:

* add a broker
* remove a broker
* list brokers
* create new tokens

## POAToken (Proof of Asset Token) (Work in Progress)

The POAToken is the token that represents an asset in the real world. The primary example at the moment is real estate. A broker will go through a vetting process and provide legal proof that they hold the asset in question.

Once when this process is complete they will be able to have a token added by the owner.

The token will go through different phases:
1. funding
1. pending
1. failed
1. active
1. terminated

### Funding Stage
The token is put up on the platform and investors are able to buy a piece of the asset. If the funding goals are not met the token goes to failed stage. If the goals are met within the time limit, the token goes on to pending stage.

### Pending Stage
In the pending stage, a verified custodian of the asset must provide proof that they are in possession of the asset to move the token forward.

### Failed Stage
When failed, tokens that have been bought are redeemable for the amount of ether they were bought for. The contract will never become active or tradeable when reaching a failed state. The contract reaches failed state when the fundingGoal is not reached in time.

### Active Stage
In the active stage, a token will produce monthly payouts and will be sent to owners in the form of ether.

### Terminated Stage
A contract enters the terminated stage when a poa contract needs to end. This could be because the building is sold, or some other "act of god" occurs. When in terminated stage, users will not be able to trade the tokens any longer. Payouts from custodian are still possible. This should allow sending money from insurance to token holders if a building is destroyed.

## Built With

* [Truffle v4.0.1](https://github.com/trufflesuite/truffle/releases/tag/v4.0.1)
* [zeppelin-solidity v1.3.0](https://github.com/OpenZeppelin/zeppelin-solidity/releases)

## Authors
* **Cody Lamson** - *BrickblockToken, CustomPOAToken, BrickblockAccessToken, BrickblockAccount, PoaToken, WarpTool, BrickblockWhitelist, BrickblockContractRegistry, BrickblockFeeManager* - [TovarishFin](https://github.com/TovarishFin)
* **Matt Stevens** - *BrickblockToken, CustomPOAToken, POAToken, PoaManager, BrickblockWhitelist, BrickblockContractRegistry* - [mattgstevens](https://github.com/mattgstevens)
* **Adrian Kizlauskas** - *BrickblockToken, CustomPOAToken POAToken, PoaManager* - [dissaranged](https://github.com/dissaranged)
* **Marius Hanne** - *POAToken, PoaManager* - [mhanne](https://github.com/mhanne)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
