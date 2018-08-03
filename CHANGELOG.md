# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="3.3.4"></a>
## [3.3.4](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.3.3...v3.3.4) (2018-08-03)



<a name="3.3.2"></a>
## [3.3.2](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.3.1...v3.3.2) (2018-08-01)



<a name="3.3.1"></a>
## [3.3.1](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.3.0...v3.3.1) (2018-08-01)



<a name="3.3.0"></a>
# [3.3.0](https://git.brickblock-dev.io/platform/smart-contracts/compare/v2.6.1...v3.3.0) (2018-07-31)


### Bug Fixes

* added an account for the autominer and reverted to timebased triggering. ([c398a10](https://git.brickblock-dev.io/platform/smart-contracts/commits/c398a10))
* CI should `npm release` and update the `package.json` via a `git push` so the version number goes to master ([a5990ca](https://git.brickblock-dev.io/platform/smart-contracts/commits/a5990ca))
* remove setupPoaToken function from PoaManager; the only way to setup a… ([e797597](https://git.brickblock-dev.io/platform/smart-contracts/commits/e797597))
* SECRET env vars are prefixed with SECRET ([25defe1](https://git.brickblock-dev.io/platform/smart-contracts/commits/25defe1))
* testing suite for BrickblockToken now passes on geth. ([5e829f1](https://git.brickblock-dev.io/platform/smart-contracts/commits/5e829f1))
* testing suite for ContractRegistry now passes on geth. ([8c405f7](https://git.brickblock-dev.io/platform/smart-contracts/commits/8c405f7))
* testing suite for ExchangeRates now passes on geth. ([def9168](https://git.brickblock-dev.io/platform/smart-contracts/commits/def9168))
* wrap hdwallet-provider ([101a475](https://git.brickblock-dev.io/platform/smart-contracts/commits/101a475))


### Features

* BrickblockAccount uses timestamp as a time lock to successfully call withdrawBbkFunds ([bd96048](https://git.brickblock-dev.io/platform/smart-contracts/commits/bd96048))
* **POA:** move broker getter/setter to POACommon, add `onlyBroker` modifier, switch `payout()` from `onlyCustodian` to `onlyBroker` ([581a03c](https://git.brickblock-dev.io/platform/smart-contracts/commits/581a03c))
* **POA:** switch `startFiatSale` from `onlyCustodian` to `onlyBroker` (+ some name consolidation between fiatSale / fiatPreSale / sale / ethSale / Funding / Eth Funding…) ([93a5fcb](https://git.brickblock-dev.io/platform/smart-contracts/commits/93a5fcb))



<a name="2.6.1"></a>
## [2.6.1](https://git.brickblock-dev.io/platform/smart-contracts/compare/v2.6.0...v2.6.1) (2018-05-28)



<a name="2.6.0"></a>
# [2.6.0](https://git.brickblock-dev.io/platform/smart-contracts/compare/v2.5.5...v2.6.0) (2018-05-25)


### Bug Fixes

* bad test in BrickblockToken ([5b121b5](https://git.brickblock-dev.io/platform/smart-contracts/commits/5b121b5))
* frozen-tests will exit with error when suite fails ([08c9f2a](https://git.brickblock-dev.io/platform/smart-contracts/commits/08c9f2a))


### Features

* additional checks in BrickblockToken for finalize ([4eb1084](https://git.brickblock-dev.io/platform/smart-contracts/commits/4eb1084))
* testing for BrickblockToken post-ico when it has been unpaused and transfers have occured ([4305882](https://git.brickblock-dev.io/platform/smart-contracts/commits/4305882))



<a name="2.5.5"></a>
## [2.5.5](https://git.brickblock-dev.io/platform/smart-contracts/compare/v2.5.4...v2.5.5) (2018-05-25)



<a name="2.5.4"></a>
## [2.5.4](https://git.brickblock-dev.io/platform/smart-contracts/compare/v2.5.3...v2.5.4) (2018-05-24)



<a name="2.5.3"></a>
## [2.5.3](https://git.brickblock-dev.io/platform/smart-contracts/compare/v2.5.2...v2.5.3) (2018-05-22)



<a name="2.5.2"></a>
## [2.5.2](https://git.brickblock-dev.io/platform/smart-contracts/compare/v2.5.1...v2.5.2) (2018-05-15)



<a name="2.5.1"></a>
## [2.5.1](https://git.brickblock-dev.io/platform/smart-contracts/compare/v2.5.0...v2.5.1) (2018-05-15)



<a name="2.5.0"></a>
# [2.5.0](https://git.brickblock-dev.io/platform/smart-contracts/compare/v2.4.7...v2.5.0) (2018-05-07)


### Bug Fixes

* all events have Event suffix ([eded94a](https://git.brickblock-dev.io/platform/smart-contracts/commits/eded94a))
* all events have Event suffix and add version constant for PoaManager ([ad58c74](https://git.brickblock-dev.io/platform/smart-contracts/commits/ad58c74))
* commenting out migrations for ExchangeRates.fetchRate as it does not work for `truffle migrate --network dev` when using Ganache as blockchain ([6e450f3](https://git.brickblock-dev.io/platform/smart-contracts/commits/6e450f3))
* test wording and order of tests when calling from notOwner address ([30c9d71](https://git.brickblock-dev.io/platform/smart-contracts/commits/30c9d71))


### Features

* any token state is allowed for token convenience functions on PoaManager ([cabc707](https://git.brickblock-dev.io/platform/smart-contracts/commits/cabc707))
* EntityState implementation for storing broker and token information in PoaManager ([d7e7491](https://git.brickblock-dev.io/platform/smart-contracts/commits/d7e7491))
* PoaManager has functions for pausing and terminating PoaTokens ([ea99026](https://git.brickblock-dev.io/platform/smart-contracts/commits/ea99026))
* version number for POAManager ([212ad6e](https://git.brickblock-dev.io/platform/smart-contracts/commits/212ad6e))



<a name="2.4.7"></a>
## [2.4.7](https://git.brickblock-dev.io/platform/smart-contracts/compare/v2.4.6...v2.4.7) (2018-05-07)



<a name="2.4.6"></a>
## [2.4.6](https://git.brickblock-dev.io/platform/smart-contracts/compare/v2.4.5...v2.4.6) (2018-05-04)



<a name="2.4.5"></a>
## [2.4.5](https://git.brickblock-dev.io/platform/smart-contracts/compare/v2.4.4...v2.4.5) (2018-04-30)



<a name="2.4.4"></a>
## [2.4.4](https://git.brickblock-dev.io/platform/smart-contracts/compare/v2.4.3...v2.4.4) (2018-04-25)


### Bug Fixes

* use event RateUpdated during function setActRate ([35d5a96](https://git.brickblock-dev.io/platform/smart-contracts/commits/35d5a96))



<a name="2.4.3"></a>
## [2.4.3](https://git.brickblock-dev.io/platform/smart-contracts/compare/v2.4.2...v2.4.3) (2018-04-25)



<a name="2.4.2"></a>
## [2.4.2](https://git.brickblock-dev.io/platform/smart-contracts/compare/v2.3.2...v2.4.2) (2018-04-19)
