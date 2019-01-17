# Actors and Processes

In our ecosystem, there exist 5 types of actors (roles) which map different responsibilities:

- Brickblock
- Whitelisted Investor
- BBK Holder
- Issuer
- Custodian

In the following, we describe all processes per role. We use the term 'POA Token' as the logic bundle for the smart contracts `PoaProxy`, `PoaCommon`, `PoaProxyCommon`, `PoaCrowdsale`, and `PoaToken`, which are connected through inheritance and the `delegatecall`-pattern we use. Hereby, the address of `PoaProxy` represents the 'interface' of the POA Token, while `PoaCrowdsale` and `PoaToken` serve as delegates in the background.

## Brickblock

Brickblock is responsible for managing Issuers and whitelisting Investors. Furthermore, Brickblock manages fiat rates and controls the company funds stored in `BrickblockAccount`. This role is split into various Ethereum addresses that are used by smart contracts to restrict access to functions.

### Processes

- Manage Issuers
  - `addIssuer(address)` on `PoaManager`: Adds an Issuer's address as listed Issuer.
  - `removeIssuer(address)` on `PoaManager`: Removes and delists an Issuer's address.
  - `listIssuer(address)` on `PoaManager`: Lists an already added but currently delisted Issuer.
  - `delistIssuer(address)` on `PoaManager`: Delists an already added and listed Issuer.
- Re-add POA Tokens to upgraded `PoaManager`:
  - `addExistingToken(address,bool)`: Adds an already deployed POA token as either active or inactive.
- Manage whitelisted Investors
  - `addAddress(address)` on `Whitelist`: Adds an Investor's address as whitelisted Investor.
  - `removeAddress(address)` on `Whitelist`: Removes an Investor's address (de-whitelisting).
- Manage company-owned BBKs when vesting period is over
  - `withdrawBbkFunds(address,uint256)` on `BrickblockAccount`: After the vesting period, the company-reserved BBKs can be withdrawn to an address.
  - `withdrawActFunds(address,uint256)` on `BrickblockAccount`: Transfers an amount of ACTs held by `BrickblockAccount` to an address.
  - `withdrawEthFunds(address,uint256)` on `BrickblockAccount`: Transfers an amount of ETH held by `BrickblockAccount` to an address.
  - `lockBbk(uint256)` on `BrickblockAccount`: Locks an amount of company BBKs in `AccessToken`.
  - `unlockBbk(uint256)` on `BrickblockAccount`: Unlocks amount of locked company BBKs in `AccessToken`.
  - `claimFee(uint256)` on `BrickblockAccount`: Converts an ACT amount into ETH via `FeeManager`. This is a wrapper for the same functionality BBK Holders can also execute via `claimFee(uint256)` (see below).
- Manage fiat rates
  - `fetchRate(string)` on `ExchangeRates`: Initiates a fiat rate query of a currency (e.g. USD, EUR, GBP) via an oracle.
  - `setCurrencySettings(string,string,uint256,uint256,uint256)` on `ExchangeRates`: Sets the currency name, fetch URL, fetch interval, callback gas limit, and fiat rate penalty. This set contains fetch parameters for one currency. There exist more fine-grained functions to update only one of the listed parameters.
  - `killProvider(address)` on `ExchangeRates`: Kills (selfdestruct) an `ExchangeRatesProvider` contract at a given address.
  - `toggleRatesActive()` on `ExchangeRates`: Toggles recursive fiat rate fetches.
- Terminate POA Token
  - `terminate()` on POA Token. When a POA Token is in stage `Active` (meaning: fully funded and activated by Custodian), the POA Token can be terminated to signal the end of the tokenized representation of the asset. When terminated, payouts and claims can still occur, however, POA Tokens cannot be traded anymore. Terminations can be performed by Custodians, too.

## Investor (whitelisted)

Whitelisted investors can invest in POA Tokens with ETH. Once the POA Token is issued, Investors can trade POA tokens through ERC-20 functionality. There exist two types of investors:

- **Fiat Investors:** Whitelisted investor that sends fiat to the Custodian via wire transfer. Custodian will assign POA Tokens to the investor by using the investor's ETH address and the transferred money in fiat cents. Thus, the token purchase is conducted by the Custodian, not by the fiat investor. To invest with fiat, the POA Token must be in stage `FiatFunding`.
- **ETH Investors:** Whitelisted investor that purchases POA Tokens with ETH. The token purchase is conducted by the investor without relying on the Custodian. To invest with fiat, the POA Token must be in stage `EthFunding`.

A POA Token can support fiat-only, ETH-only, or fiat-and-ETH funding types. Depending on this funding type, one of the above investor types might not be allowed a POA token sale.

### Processes

- Invest in POA Tokens
  - `buyWithEth()` on POA Token: When the POA Token is in stage `EthFunding`, whitelisted investors can invest by sending ETH along this function call. This only works in case the investor hasn't participated in the fiat funding before.
- Trade POA Tokens
  - `transfer()`/`transferFrom()` on POA Token: We expect that investors do not call this these ERC-20 functions manually but through some exchange. In order to transfer POA tokens, the receiver address must be whitelisted, too.
- Receive dividend payouts
  - `claim()` on POA Token. This function sends ETH to the Investor in case there was a past payout.
- Claim refund of investment in case funding goal of POA Token is not reached
  - `reclaim()` on POA Token. In case the funding goal of a POA Token was not reached, ETH Investors can get their prior investment fully refunded by calling this function.

## BBK Holder

A BBK Holder either participated in our ICO or acquired BBK through an exchange. BBK Holders can trade BBKs on exchanges and lock their BBKs in order to receive ACT generated through dividend payouts.

### Processes

- Trade BBKs
  - `transfer()`/`transferFrom()` on POA Token:s We expect that BBK Holders do not call this these ERC-20 functions manually but through some exchange. In contrast to POA Tokens, there are no whitelisting requirements for sending or receiving BBKs.
- Lock and unlock BBKs
  - `lockBbk(uint256)` on `AccessToken`: Locks (in marketing terms: Activates) some amount of the BBKs that the BBK Holder has. This makes the BBK untradable until BBKs are unlocked again. While having BBKs locked, BBK Holders become eligible to receive ACT when there is a dividend payout.
  - `unlockBbk(uint256)` on `AccessToken`: Unlocks some amount of currently locked BBKs. This makes the BBKs transferable again, however, the BBK holder's stake for receiving ACT is reduced/removed.
- Converting ACT into ETH
  - `claimFee(uint256)` on `FeeManager`: Burns an amount of ACT, which the BBK Holder owns, and receives ETH in return. The ETH is directly sent to the BBK Holder's Ethereum address.

## Issuer

The Issuer, previously referred to as Broker, must be listed by Brickblock in order to create POA Tokens. Once a POA Token is deployed, the Issuer can change the POA's parameters in its initial stage `Preview`. Furthermore, the Issuer is responsible for paying out generated dividends to POA token holders. Also, the Issuer can terminate POA Tokens in case of special events.

### Processes

- Deploy a new POA Token
  - `addNewToken(...)` on `PoaManager`: This effectively deploys a new `PoaProxy` contract with the specified parameters.
- Manage newly deployed POA Tokens
  - `update*()` on POA Token: After a POA Token is deployed via `addNewToken(...)`, the Issuer can change all token parameters, i.e. funding start, durations, name, symbol, etc., via fine-grained functions. As soon as the POA Token is moved to stage `PreFunding`, the token parameters become immutable.
  - `startPreFunding()` on POA Token: Moves a POA Token from its initial stage `Preview` to `PreFunding`. When calling this function, the Issuer signals the finality of the token parameters, as these become immutable with this function call.
- Payout dividends to investors
  - `payout()` on POA Token: After the Issuer converted the dividend into ETH, he sends these ETH along this function call to the POA Token. Payouts can be performed by Custodians, too.

## Custodian

The Custodian represents the role that is responsible for the compliance. He activates POA Tokens when these are successfully funded. Furthermore, the Custodian manages a document called proof-of-custody. In case something goes wrong during the funding period, he can cancel the funding.

### Processes

- Buy (and undo buy) POA Tokens on behalf of fiat Investors
  - `buyWithFiat(address,uint256)` on POA Token: When in stage `FiatFunding`, the Custodian buys POA Tokens with a given fiat cent amount on behalf of a fiat Investor, represented by an Ethereum address. Custodians call this function when they received a fiat-based wire transfer from Investors. This function only succeeds when the fiat investor is whitelisted. This function call only succeeds when the passed fiat amount in cents does not exceed the funding goal.
  - `removeFiat(address,uint256)` on POA Token: When in stage `FiatFunding`, the Custodian can undo a previous fiat-based token purchase on behalf of a fiat Investor. This only works when the POA Token is not fully funded yet.
- Confirm legitimacy of POA Token
  - `updateProofOfCustody(bytes32[2])` on POA Token: By passing an IPFS hash to this function, the Custodian registers additional information, a proof-of-custody, with the POA Token. The Custodian can call this function at any time throughout the POA Token lifecycle.
  - `activate()` on POA Token: In case the funding succeeded, the Custodian confirms the legal legitimacy by calling this function. Prior to activation, the proof-of-custody must be specified as an IPFS-hash via `updateProofOfCustody()`. After activation, the POA Token becomes tradable.
- Payout dividends to investors
  - `payout()` on POA Token: After the Custodian converted the dividend into ETH, he sends these ETH along this function call to the POA Token. Payouts can be performed by Issuers, too.
- Terminate POA Token
  - `terminate()` on POA Token. When a POA Token is in stage `Active` (meaning: fully funded and activated by Custodian), the POA Token can be terminated to signal the end of the tokenized representation of the asset. When terminated, payouts and claims can still occur, however, POA Tokens cannot be traded anymore. Terminations can be performed by Brickblock, too.
