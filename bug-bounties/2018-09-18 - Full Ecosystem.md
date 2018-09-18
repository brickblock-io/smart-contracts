# Bug Bounty Program

All contracts under review have been audited by [ConsenSys Diligence](https://consensys.net/diligence/). The audit reports are published under [/audits](/audits).

## Platform: Solidified
All issues must be submitted through https://solidified.io. The official URL for this bug bounty is https://web.solidified.io/contract/5b9e754ffd407500116a9d0f

## Rewards

### Critical Bugs: 50 ETH
Bugs that enable an attacker to steal ETH or BBK tokens or ACT tokens or POA tokens from any of the contracts under review or participants in our ecosystem holding BBK, ACT or POA.

### Major Bugs: 25 ETH
Bugs that would lock or render our POA tokens, BBK tokens or ACT tokens otherwise unusable and/or make said tokens vulnerable to attacks.

### Minor Bugs: 1 ETH
Bugs that break specified or reasonably assumed contract behavior but do not enable an attacker to steal, freeze or destroy funds.

### Available pool: 100 ETH

## Rules
* Public disclosure of vulnerabilities outside of Solidified render the publisher and their associates ineligible for any bounty rewards.
* Current and former Brickblock employees and contractors as well as ConsenSys Diligence employees and contractors are not eligible for bounty rewards.
* The submission’s quality will factor into the level of compensation. A high-quality submission includes an explanation of how the bug can be reproduced, a failing test case, and ideally a fix that makes the test case pass. High-quality submissions may be awarded higher amounts than the amounts specified above.
* Excluded are scenarios that rely on explicit user action like phishing, social engineering etc.

### Issues In Scope (including but not limited to listed bullet points)
* Being able to steal funds
* Being able to freeze funds or render them inaccessible by their owners
* Being able to perform replay attacks

### Issues Out of Scope
* Issues that have already been submitted by another user
* Issues outlined in WORST CASE SCENARIOS
* Issues outlined in the AUDIT REPORT

### Contracts in Scope
The official commit hash at which to review is [46c9d13c14401eb0020d33588881208b38e2854f](/tree/46c9d13c14401eb0020d33588881208b38e2854f)

* [AccessToken.sol](/contracts/AccessToken.sol)
* [BrickblockAccount.sol](/contracts/BrickblockAccount.sol)
* [BrickblockToken.sol](/contracts/BrickblockToken.sol)
* [ContractRegistry.sol](/contracts/ContractRegistry.sol)
* [ExchangeRateProvider.sol](/contracts/ExchangeRateProvider.sol)
* [ExchangeRates.sol](/contracts/ExchangeRates.sol)
* [FeeManager.sol](/contracts/FeeManager.sol)
* [PoaCommon.sol](/contracts/PoaCommon.sol)
* [PoaCrowdsale.sol](/contracts/PoaCrowdsale.sol)
* [PoaLogger.sol](/contracts/PoaLogger.sol)
* [PoaManager.sol](/contracts/PoaManager.sol)
* [PoaProxy.sol](/contracts/PoaProxy.sol)
* [PoaProxyCommon.sol](/contracts/PoaProxyCommon.sol)
* [PoaToken.sol](/contracts/PoaToken.sol)
* [SafeMathPower.sol](/contracts/tools/SafeMathPower.sol)
* [Whitelist.sol](/contracts/Whitelist.sol)

### Help
* Read [README.md](/README.md) for technical instructions on how to run our ecosystem locally
* Read [ECOSYSTEM.md](/ECOSYSTEM.md) for an overview of our smart contract structure
* Read [WORST-CASE-SCENARIOS.md](/WORST-CASE-SCENARIOS.md) to learn about accepted risks/tradeoffs and known issues that are not eligible for bounty rewards

### Legal
We can end the bug bounty program at any time. Awards are at the sole discretion of the Brickblock bug bounty panel. In addition, we are not able to issue awards to individuals who are on sanctions lists or who are in countries on sanctions lists (e.g. North Korea, Iran, etc). You are responsible for all taxes. All awards are subject to applicable law. Finally, your testing must not violate any law or compromise any data that is not yours.