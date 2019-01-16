# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="6.0.2"></a>
## [6.0.2](https://git.brickblock-dev.io/platform/smart-contracts/compare/v6.0.1...v6.0.2) (2019-01-16)



<a name="6.0.1"></a>
## [6.0.1](https://git.brickblock-dev.io/platform/smart-contracts/compare/v6.0.0...v6.0.1) (2019-01-10)


### Bug Fixes

* ContractRegistry has a different address on e2e-tooling ganache ([32e4e30](https://git.brickblock-dev.io/platform/smart-contracts/commits/32e4e30))



<a name="6.0.0"></a>
# [6.0.0](https://git.brickblock-dev.io/platform/smart-contracts/compare/v5.0.2...v6.0.0) (2019-01-03)


### Chores

* Globally renamed broker to issuer ([8efdffb](https://git.brickblock-dev.io/platform/smart-contracts/commits/8efdffb))


### BREAKING CHANGES

* functions that include 'broker' are renamed to 'issuer'



<a name="5.0.2"></a>
## [5.0.2](https://git.brickblock-dev.io/platform/smart-contracts/compare/v5.0.0...v5.0.2) (2018-12-18)



<a name="5.0.0"></a>
# [5.0.0](https://git.brickblock-dev.io/platform/smart-contracts/compare/v4.0.1...v5.0.0) (2018-12-18)


### Bug Fixes

* buy() improvements ([42f1fa3](https://git.brickblock-dev.io/platform/smart-contracts/commits/42f1fa3))
* Manual POA stage checks. Updated tests with updated POA interface ([b7c30ba](https://git.brickblock-dev.io/platform/smart-contracts/commits/b7c30ba))


### BREAKING CHANGES

* Replaced checkFundingSuccessful with manualCheckForFundingSuccessful. Replaced setStageToTimedOut with manualCheckForTimeout



<a name="4.0.0"></a>
# [4.0.0](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.9.0...v4.0.0) (2018-11-27)


### Chores

* renamed some PoaCrowdsale functions ([d38386e](https://git.brickblock-dev.io/platform/smart-contracts/commits/d38386e))


### BREAKING CHANGES

* Portal will need to be updated because it relies on the old names of the buy-functions



<a name="3.9.2"></a>
## [3.9.2](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.9.0...v3.9.2) (2018-11-27)



<a name="3.9.1"></a>
## [3.9.1](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.9.0...v3.9.1) (2018-11-27)



<a name="3.9.0"></a>
# [3.9.0](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.8.3...v3.9.0) (2018-11-27)


### Bug Fixes

* extract hard coded url parts to variables ([22908f6](https://git.brickblock-dev.io/platform/smart-contracts/commits/22908f6))


### Features

* trigger ganache deploy ([217349f](https://git.brickblock-dev.io/platform/smart-contracts/commits/217349f))



<a name="3.8.3"></a>
## [3.8.3](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.8.2...v3.8.3) (2018-11-27)



<a name="3.8.2"></a>
## [3.8.2](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.8.1...v3.8.2) (2018-11-19)



<a name="3.8.1"></a>
## [3.8.1](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.8.0...v3.8.1) (2018-11-16)


### Bug Fixes

* Minor changes to POA cancel and timeout conditions. Improved tests ([1114224](https://git.brickblock-dev.io/platform/smart-contracts/commits/1114224))
* Minor changes to POA cancel and timeout conditions. Improved tests ([acd234d](https://git.brickblock-dev.io/platform/smart-contracts/commits/acd234d))
* Updated CLI tool to work with new time variables. Added Issuer address as argument [skip ci] ([acac3ad](https://git.brickblock-dev.io/platform/smart-contracts/commits/acac3ad))



<a name="3.8.0"></a>
# [3.8.0](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.7.6...v3.8.0) (2018-11-08)


### Features

* Whitelist is Pauseable ([b516f4c](https://git.brickblock-dev.io/platform/smart-contracts/commits/b516f4c))



<a name="3.7.6"></a>
## [3.7.6](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.7.5...v3.7.6) (2018-11-07)


### Bug Fixes

* **POA:** Refactor funding time variables. Introduced duration for fiat sale ([abf0611](https://git.brickblock-dev.io/platform/smart-contracts/commits/abf0611))
* **POA:** Refactor funding time variables. Introduced duration for fiat sale ([0f8b212](https://git.brickblock-dev.io/platform/smart-contracts/commits/0f8b212))
* **POA:** Refactor funding time variables. Introduced duration for fiat sale ([db5f368](https://git.brickblock-dev.io/platform/smart-contracts/commits/db5f368))
* **POA:** Refactor funding time variables. Introduced duration for fiat sale ([2c3804d](https://git.brickblock-dev.io/platform/smart-contracts/commits/2c3804d))
* **POA:** Refactor funding time variables. Introduced duration for fiat sale ([b33d93b](https://git.brickblock-dev.io/platform/smart-contracts/commits/b33d93b))



<a name="3.7.5"></a>
## [3.7.5](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.7.4...v3.7.5) (2018-10-29)



<a name="3.7.4"></a>
## [3.7.4](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.7.3...v3.7.4) (2018-10-18)



<a name="3.7.3"></a>
## [3.7.3](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.7.2...v3.7.3) (2018-10-18)



<a name="3.7.2"></a>
## [3.7.2](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.7.1...v3.7.2) (2018-10-16)



<a name="3.7.1"></a>
## [3.7.1](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.7.0...v3.7.1) (2018-10-15)



<a name="3.7.0"></a>
# [3.7.0](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.6.9...v3.7.0) (2018-10-08)


### Features

* Fiat rate penalty ([fe6736d](https://git.brickblock-dev.io/platform/smart-contracts/commits/fe6736d))



<a name="3.6.9"></a>
## [3.6.9](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.6.8...v3.6.9) (2018-10-08)



<a name="3.6.8"></a>
## [3.6.8](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.6.7...v3.6.8) (2018-10-08)


### Bug Fixes

* this is not used anywhere ([ad48397](https://git.brickblock-dev.io/platform/smart-contracts/commits/ad48397))



<a name="3.6.7"></a>
## [3.6.7](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.6.6...v3.6.7) (2018-09-24)



<a name="3.6.6"></a>
## [3.6.6](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.6.5...v3.6.6) (2018-09-21)


### Bug Fixes

* ExchangeRateProviderStub callback is the same as actual implementation ([185735c](https://git.brickblock-dev.io/platform/smart-contracts/commits/185735c))



<a name="3.6.5"></a>
## [3.6.5](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.6.4...v3.6.5) (2018-09-20)



<a name="3.6.4"></a>
## [3.6.4](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.6.3...v3.6.4) (2018-09-19)



<a name="3.6.3"></a>
## [3.6.3](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.6.2...v3.6.3) (2018-09-18)



<a name="3.6.2"></a>
## [3.6.2](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.6.1...v3.6.2) (2018-09-17)



<a name="3.6.0"></a>
# [3.6.0](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.25...v3.6.0) (2018-09-14)


### Bug Fixes

* poa test setup now that ContractRegistry checks if address is a contract ([c3d6d85](https://git.brickblock-dev.io/platform/smart-contracts/commits/c3d6d85))
* remove transferOwnership from PoaToken, since there is a live check with COntractRegistry to get latest PoaManager address ([6aa4b9b](https://git.brickblock-dev.io/platform/smart-contracts/commits/6aa4b9b))


### Features

* ContractRegistry checks that an address is a contract when updating ([bfe13dc](https://git.brickblock-dev.io/platform/smart-contracts/commits/bfe13dc))



<a name="3.5.25"></a>
## [3.5.25](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.24...v3.5.25) (2018-09-13)



<a name="3.5.24"></a>
## [3.5.24](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.23...v3.5.24) (2018-09-04)



<a name="3.5.23"></a>
## [3.5.23](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.22...v3.5.23) (2018-09-03)



<a name="3.5.22"></a>
## [3.5.22](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.21...v3.5.22) (2018-08-31)



<a name="3.5.21"></a>
## [3.5.21](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.19...v3.5.21) (2018-08-30)



<a name="3.5.19"></a>
## [3.5.19](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.18...v3.5.19) (2018-08-24)



<a name="3.5.18"></a>
## [3.5.18](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.17...v3.5.18) (2018-08-24)



<a name="3.5.17"></a>
## [3.5.17](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.16...v3.5.17) (2018-08-23)



<a name="3.5.16"></a>
## [3.5.16](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.15...v3.5.16) (2018-08-23)



<a name="3.5.15"></a>
## [3.5.15](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.14...v3.5.15) (2018-08-23)


### Bug Fixes

* **audit:** fixed audit issue 3.2 by adding hard fork scenario [skip-ci] ([3f96ed9](https://git.brickblock-dev.io/platform/smart-contracts/commits/3f96ed9))



<a name="3.5.14"></a>
## [3.5.14](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.13...v3.5.14) (2018-08-22)


### Bug Fixes

* **audit:** fixed audit issue 3.26 by fixing argument name of 'BbkUnlocked' event ([349d9ff](https://git.brickblock-dev.io/platform/smart-contracts/commits/349d9ff))



<a name="3.5.13"></a>
## [3.5.13](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.12...v3.5.13) (2018-08-22)


### Bug Fixes

* **audit:** fixed audit issue 3.25 remove 'event' from event names ([4ef8955](https://git.brickblock-dev.io/platform/smart-contracts/commits/4ef8955))



<a name="3.5.12"></a>
## [3.5.12](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.11...v3.5.12) (2018-08-22)


### Bug Fixes

* **audit:** fixed audit issue 3.24 by changing PoaToken decimals type to uint8 ([4c4fad8](https://git.brickblock-dev.io/platform/smart-contracts/commits/4c4fad8))



<a name="3.5.11"></a>
## [3.5.11](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.10...v3.5.11) (2018-08-22)


### Bug Fixes

* **audit:** fixed audit issue 3.23 by changing comment ([d2243e9](https://git.brickblock-dev.io/platform/smart-contracts/commits/d2243e9))



<a name="3.5.10"></a>
## [3.5.10](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.9...v3.5.10) (2018-08-22)


### Bug Fixes

* **audit:** fixed audit issue 3.18 by casting 'this' to 'address' ([4c7bc6d](https://git.brickblock-dev.io/platform/smart-contracts/commits/4c7bc6d))



<a name="3.5.9"></a>
## [3.5.9](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.8...v3.5.9) (2018-08-22)


### Bug Fixes

* **audit:** fixed audit issue 3.19 by changing buyFiat condition ([de19b8a](https://git.brickblock-dev.io/platform/smart-contracts/commits/de19b8a))
* **audit:** fixed audit issue 3.19 by changing buyFiat condition ([269ca33](https://git.brickblock-dev.io/platform/smart-contracts/commits/269ca33))



<a name="3.5.8"></a>
## [3.5.8](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.7...v3.5.8) (2018-08-21)



<a name="3.5.7"></a>
## [3.5.7](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.6...v3.5.7) (2018-08-21)


### Bug Fixes

* **audit:** fixed audit issue 3.10 by moving rewuire to to it's modifier ([a7f92be](https://git.brickblock-dev.io/platform/smart-contracts/commits/a7f92be))



<a name="3.5.6"></a>
## [3.5.6](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.5...v3.5.6) (2018-08-21)


### Bug Fixes

* **audit:** fixed audit issue 3.17 by adding conditiion to refund on buy ([716a911](https://git.brickblock-dev.io/platform/smart-contracts/commits/716a911))



<a name="3.5.5"></a>
## [3.5.5](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.4...v3.5.5) (2018-08-21)


### Bug Fixes

* **audit:** fixed audit issue 3.6 by adding amount zero check to lock/unlock BBK ([cfe7093](https://git.brickblock-dev.io/platform/smart-contracts/commits/cfe7093))
* check amount before doing more work ([d5dca8b](https://git.brickblock-dev.io/platform/smart-contracts/commits/d5dca8b))



<a name="3.5.4"></a>
## [3.5.4](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.3...v3.5.4) (2018-08-21)


### Bug Fixes

* **audit:** fixed audit issue 3.14 by renaming internal buy functions ([5c68e4e](https://git.brickblock-dev.io/platform/smart-contracts/commits/5c68e4e))



<a name="3.5.3"></a>
## [3.5.3](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.2...v3.5.3) (2018-08-20)



<a name="3.5.2"></a>
## [3.5.2](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.1...v3.5.2) (2018-08-20)



<a name="3.5.1"></a>
## [3.5.1](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.5.0...v3.5.1) (2018-08-20)



<a name="3.5.0"></a>
# [3.5.0](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.4.4...v3.5.0) (2018-08-18)


### Features

* **POA:** add stress tests for POA ([120d78d](https://git.brickblock-dev.io/platform/smart-contracts/commits/120d78d))
* **POA:** Add STRESS-TESTS.md documentation ([d26f256](https://git.brickblock-dev.io/platform/smart-contracts/commits/d26f256))
* **POA:** fiat funding stress test ([400d2da](https://git.brickblock-dev.io/platform/smart-contracts/commits/400d2da))
* **POA:** finalize stress tests ([6646898](https://git.brickblock-dev.io/platform/smart-contracts/commits/6646898))
* **POA:** implement stress test for eth funding ([bc5348a](https://git.brickblock-dev.io/platform/smart-contracts/commits/bc5348a))



<a name="3.4.4"></a>
## [3.4.4](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.4.3...v3.4.4) (2018-08-17)


### Bug Fixes

* **audit:** Fixed audit issue 3.12 by removing unnecessary fallback functions ([d7d27f4](https://git.brickblock-dev.io/platform/smart-contracts/commits/d7d27f4))



<a name="3.4.3"></a>
## [3.4.3](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.4.2...v3.4.3) (2018-08-15)


### Bug Fixes

* confusing names in PoaCrowdsale for eth-funding & activation time periods ([e84e6dc](https://git.brickblock-dev.io/platform/smart-contracts/commits/e84e6dc))



<a name="3.4.2"></a>
## [3.4.2](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.4.1...v3.4.2) (2018-08-14)



<a name="3.4.1"></a>
## [3.4.1](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.4.0...v3.4.1) (2018-08-14)



<a name="3.4.0"></a>
# [3.4.0](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.3.15...v3.4.0) (2018-08-10)


### Features

* **POA:** change activation flow ([e17293e](https://git.brickblock-dev.io/platform/smart-contracts/commits/e17293e))
* **POA:** change activation flow - update tests ([343b3c8](https://git.brickblock-dev.io/platform/smart-contracts/commits/343b3c8))



<a name="3.3.15"></a>
## [3.3.15](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.3.14...v3.3.15) (2018-08-10)



<a name="3.3.14"></a>
## [3.3.14](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.3.13...v3.3.14) (2018-08-09)



<a name="3.3.13"></a>
## [3.3.13](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.3.12...v3.3.13) (2018-08-07)



<a name="3.3.12"></a>
## [3.3.12](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.3.11...v3.3.12) (2018-08-07)



<a name="3.3.11"></a>
## [3.3.11](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.3.10...v3.3.11) (2018-08-07)



<a name="3.3.10"></a>
## [3.3.10](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.3.9...v3.3.10) (2018-08-06)


### Bug Fixes

* **POA:** typo in IPoaTokenCrowdsale interface ([19b7932](https://git.brickblock-dev.io/platform/smart-contracts/commits/19b7932))



<a name="3.3.9"></a>
## [3.3.9](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.3.8...v3.3.9) (2018-08-06)


### Bug Fixes

* **CI:** fixed `yarn todo` task due to missing `leasot` dependency ([88d5071](https://git.brickblock-dev.io/platform/smart-contracts/commits/88d5071))
* **POA:** typo in IPoaTokenCrowdsale interface ([950cc3d](https://git.brickblock-dev.io/platform/smart-contracts/commits/950cc3d))



<a name="3.3.8"></a>
## [3.3.8](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.3.7...v3.3.8) (2018-08-06)



<a name="3.3.7"></a>
## [3.3.7](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.3.6...v3.3.7) (2018-08-06)



<a name="3.3.6"></a>
## [3.3.6](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.3.5...v3.3.6) (2018-08-06)



<a name="3.3.5"></a>
## [3.3.5](https://git.brickblock-dev.io/platform/smart-contracts/compare/v3.3.4...v3.3.5) (2018-08-03)



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
* **POA:** move issuer getter/setter to POACommon, add `onlyIssuer` modifier, switch `payout()` from `onlyCustodian` to `onlyIssuer` ([581a03c](https://git.brickblock-dev.io/platform/smart-contracts/commits/581a03c))
* **POA:** switch `startFiatSale` from `onlyCustodian` to `onlyIssuer` (+ some name consolidation between fiatSale / fiatPreSale / sale / ethSale / Funding / Eth Funding…) ([93a5fcb](https://git.brickblock-dev.io/platform/smart-contracts/commits/93a5fcb))



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
* EntityState implementation for storing issuer and token information in PoaManager ([d7e7491](https://git.brickblock-dev.io/platform/smart-contracts/commits/d7e7491))
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
