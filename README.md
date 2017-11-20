# Brickblock Smart Contracts

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

Company tokens are locked in by assigning the value to the contract itself. The owner never starts with any token balance. This way there is no way to move the tokens without predetermined functions. The tokens are approved to be locked into the fountain contract when `finalizeTokenSale` is called. Once when the tokens are locked into the fountain, there will be no way to move them until November 30, 2020.

The fountain contract will later be called to lock the company funds into the fountain. See below for more details.

## BrickblockFountain (Work in Progress)
BrickblockFountain will be the contract that locks in BrickblockTokens in order to mint new BrickblockAccessTokens. It will be able to:

* lock in BrickblockTokens through `transferFrom`, an ERC20 standard function
* release BrickblockTokens after November 30, 2020
* track time and amount as a ratio of total time and amount regarding locked BrickblockTokens from users and return a BrickblockAccessToken reward.
* call mint function on BrickblockAccessToken contract
* change the stored address for the BrickBlockAccessToken contract
* change the stored address for the BrickblockToken contract

The code to release the company tokens will look something like this:
```
function claimCompanyTokens() public onlyOwner returns (bool) {
  require(block.number > companyShareReleaseBlock);
  BrickblockToken _bbt = BrickblockToken(brickBlockTokenAddress);
  uint256 _companyTokens = balanceOf(_bbt);
  balances[this].tokens = balances[this].tokens.sub(_companyTokens);
  balances[owner].tokens = balances[owner].tokens.add(_companyTokens);
  updateAccount(brickBlockTokenAddress, 0);
  CompanyTokensReleased(owner, _companyTokens);
}
```

The code included in this repository for BrickblockFountain is mostly placeholder code for tests and will likely undergo major changes.

## BrickblockAccessToken (Work in Progress)
BrickblockAccessToken is the token that will be burned in order to perform a variety of functions in the Brickblock ecosystem. It will be an ERC20 token and will have some minting and pausing features.

BrickblockAccessToken will be able to:
* `mint` new tokens by owner or fountain
* burn tokens
* change the stored address for the fountain contract
* be tradable amongst users through standard ERC20 functions
* be tradable on exchanges through standard ERC20 functions

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

### Funding Stage
The token is put up on the platform and investors are able to buy a piece of the asset. If the funding goals are not met the token goes to failed stage. If the goals are met within the time limit, the token goes on to pending stage.

### Pending Stage
In the pending stage, a verified custodian of the asset must provide proof that they are in possession of the asset to move the token forward.

### Active Stage
In the active stage, a token will produce monthly payouts and will be sent to owners in the form of ether.

### Prerequisites

Node ^8.0.0 and npm are needed.


## Installing

The project uses truffle for deploying and migrations. You should have everything you need when installing through yarn or npm.
```
yarn
```


## Running the tests

After installing dependencies simply run:
```
yarn test
```

## Deployment

Deployment is carried out through truffle in a `package.json` script:
```
yarn migrate:dev
```

## Built With

* [Truffle v4.0.1](https://github.com/trufflesuite/truffle/releases/tag/v4.0.1)
* [zeppelin-solidity v1.3.0](https://github.com/OpenZeppelin/zeppelin-solidity/releases)

## Authors
* **Marius Hanne** - *Initial work* - [mhanne](https://github.com/mhanne)
* **Adrian Kizlauskas** - *Initial work* - [dissaranged](https://github.com/dissaranged)
* **Cody Lamson** - *Initial work* - [TovarishFin](https://github.com/TovarishFin)
* **Matt Stevens** - *Initial work* - [mattgstevens](https://github.com/mattgstevens)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
