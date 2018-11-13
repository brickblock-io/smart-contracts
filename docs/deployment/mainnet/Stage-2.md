# Mainnet Deployment - Stage 2

### Table of Content
0.  [TODO](#todo)
1.  [Plan](#plan)
2.  [Protocol](#protocol)

## TODO:
- [ ] Fix CLI tool by updating to recent smart contract changes
- [ ] Add Broker address as CLI argument

## Plan

### Prerequisites
- Set Environment Variables

    In your local `.env` file, set:
    * `MAINNET_MNEMONIC` to the mnemonic of the hot wallet that will do the deployment
    * `INFURA_API_KEY` to a valid Infura API key

- Use existing `ContractRegistry` contract
    * make sure the mainnet address is written in `config/deployed-contracts.js`

- We use the following Ethereum addresses:
    * `0xa9776a043463a4ba4041256e6e29fba7b74d5098` for deployment. Will be initial owner of contracts. Funded with ca. 0.46 ETH.


### Mainnet steps

1. **Deploy 7 contracts:**
    * PoaCrowdsale
    * PoaToken
    * PoaManager
    * PoaLogger
    * Whitelist
    * ExchangeRates
    * ExchangeRateProvider

    ```
    yarn migrate:mainnet --uec --register
    ```
    * If something goes wrong (Infura issues):
        * during deployment: note already deployed contract addresses, remove them from command and run again
        * during registering: note deployed contract addresses. Switch to Remix and register still unregistered contracts manually via `updateContractAddress(name, address)`


2. **Register all 7 contracts (including BrickblockToken) in `ContractRegistry`**
    * PoaCrowdsale
    * PoaToken
    * PoaManager
    * PoaLogger
    * Whitelist
    * ExchangeRates
    * ExchangeRateProvider
    --> Either partial-automatic with CLI tool (see step above), or fully-manually with Remix

3. **Verifications with Remix**

    1. **Verify that `ContractRegistry` has all newly deployed contracts registered**

        * via `getContractAddress(<contract name>)` on `ContractRegistry`

    2. **Set currency setting for a desired currency, test setters, and verify**

        * Call the following function on `ExchangeRates`. It must be called by the contract's `owner`. The gas limit is justified by [this transaction on Kovan](https://kovan.etherscan.io/tx/0x716a78e87f4cb433e524bf1750b2fa388d9dcb782f0ae8ff182cb9d42bcc9358):

        ```
        function setCurrencySettings(
          "GBP",                                                                // _currencyName
          "https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=GBP",    // _queryString
          0,                                                                    // _callInterval
          80000,                                                                // _callbackGasLimit
          10                                                                    // (1%) _ratePenalty
        )
        ```

        * Verify that currency setting is set by calling `getCurrencySettings("GBP")`
        * Update currency setting parameters via setters `setCurrencySettingRatePenalty()`, `setCurrencySettingCallbackGasLimit()`, `setCurrencySettingCallInterval()`, `setCurrencySettingQueryString()` (from `owner`).
        * Update callback gas price by using `setCallbackGasPrice(<new gasprice>)` (from `owner`).
        * Toggle recursive fetching of fiat rates via `toggleRatesActive()` (from `owner`). Run it twice to get back to `ratesActive == true`.

    3. **Fetch initial fiat rate**

        * Call `fetchRate("GBP")` with at least 0.04 Ether as `msg.value`. Must be called by contract's `owner`. One sample transaction, which justifies 0.04 Ether, [was performed on Kovan](https://kovan.etherscan.io/tx/0xd728c8bdd12d7f52fe0bf76265e83f77a3ad58e1b424817dc373c47c31c8f1c1)
        * Verify on Etherscan that Oracle sends a 'response' transaction back as `__callback()` is called by them.
        * Verify that `ExchangeRates` holds correct fiat rate in cents by calling `getRate("GBP")`. `getRate("gpb")` (small letters) should work too.

    4. **Add, list, and remove a Broker in `PoaManager`**

        * Call `addBroker(<broker address>)` from `owner` of `PoaManager`.
        * Test getters of Broker by calling `isRegisteredBroker(<broker address>)`, `getBrokerStatus(<broker address>)` and `getBrokerAddressList()`.
        * Delist Broker via `delistBroker(<broker address>)` and verify its status via above getters
        * Remove Broker via `removeBroker(<broker address>)` and verify its removal via above getters

    5. **Whitelist and de-whitelist an Ethereum address**

        * Whitelist an address via `addAddress(<address>)` (by owner)
        * Verify the whitelisted status of that address
        * De-whitelist this address via `removeAddress(<address>)` (by owner)
        * Verify the de-whitelisted status of that address

    6. **Deploy a POA Proxy for Hillview Homes sale**

        * Re-add a Broker via `addBroker()` on `PoaManager` (by `owner`). Make the Broker is listed/active with according getters (see above)
        * The Broker address needs a balance of 0.04 ETH to deploy a POA
        * Active Broker calls `addToken()` with all required parameters. This can be done via Remix or via CLI tool (**TODO: must be fixed and updated first!**):
        ```
        yarn migrate:mainnet
          --uec
          --dp
          --deployPoa-totalSupply 100000000000000000000000
          --deployPoa-currency GBP
          --deployPoa-name "Hillview Homes"
          --deployPoa-symbol BBK-RE-UK1
          --deployPoa-custodian <tbd>
          --deployPoa-startTimeForEthFunding <tbd>
          --deployPoa-durationForEthFunding <tbd>
          --deployPoa-durationForActivation <tbd>
          --deployPoa-fundingGoalInCents 335000000
        ```
        * Verify POA state with calling all its getters

    7. **Upgrade POA master contract**

        * Deploy new `PoaCrowdsale` and `PoaToken` master contracts and register their addresses in `ContractRegistry` by calling `updateContractAddress(<name>, <address>)`. This will overwrite the previous master contract addresses.
        * Call `updateCrowdsale(<proxy address>)` and `updateToken(<proxy address>)` on `PoaManager`, which will let the POA proxy (at <proxy address>) re-fetch the master contract addresses from `ContractRegistry`
        * Verify that getter functions still work as before

    8. **Move POA Proxies in all possible stages**
        * Paths and final stages we want to test. For preparation, we should deploy at least 4 `PoaProxy` contracts with minimum `startTimeForFundingPeriod` and `durationFor*` parameters
            1. Happy path: `Preview` -> `PreFunding` -> `FiatFunding` -> `EthFunding` -> `FundingSuccessful` -> `Active` (this active POA can be used in step 9. Write down investor addresses!)
                * need to wait 1+3 days (until funding ends) to move to active
            2. ... -> `Active` -> `Terminated`
                * need to wait 1+3 days (until funding ends) to move to terminated
            3. ... -> `EthFunding`/`FundingSuccessful` -> `TimedOut`
                * need to wait 1 day (until fiat funding ends)
            4. ... -> `PreFunding`/`FiatFunding` -> `FundingCancelled`
                * no waiting time
            5. Optional: test fiat-only and eth-only funding
        * Note: We have duration checks implemented, which means that we can't test everything in one day. We can use minimum funding/activation durations though and test the rest a week later
        * Note: In each stage, we can test all getters
        * Note: Funding stages require whitelisted investor addresses
        * Note: If we want a POA in each of the 9 stages in the end, we have to deploy more

    9. **Test payout/claim process and fee payout to locked BBK holders**
        1. Lock 1 BBK of *account2* and 2 BBK of `BrickblockAccount`
        2. Broker or Custodian calls `payout()` with `msg.value` of active (or terminated) POA proxy contract.
        3. A few things happened now. We verify:
            * Check that `FeeManager` received 0.5% of the paid out Ether by checking ACT balance of *account2* and `BrickblockAccount` in `AccessToken`. ACT is generated during `payout()`.
            * `PoaLogger` should log the event `Payout(<amount>)`
            * Check `currentPayout(<poa holder address>, bool)` of active POA Token by passing an address, which holds POA tokens. It should reflect the ETH payout for each POA holder.
            * Call `claim()` on the active POA Token from a POA holder. Unclaimed payouts should be sent to him.

    10. **Trade some POA-tokens between whitelisted and unwhitelisted addresses (should fail) in paused and unpaused state**
        1. Prepare active POA proxy contract
        2. We use 2 Ethereum addresses:
            * *Seller*: Has >1 POA token and is whitelisted
            * *Buyer*: Has no POA token and is NOT whitelisted
        3. Seller tries to send his POA to Buyer by calling `transfer(<buyer address>, <amount>)`. This should fail as the Buyer is not whitelisted
        4. Whitelist the Buyer in `Whitelist`
        5. Sell tries again to send POA to Buyer by calling the same function. Now it should work.
        6. Verify updated POA balances

4.  **Cleanup**
    * Burn/Convert all generated ACT in `AccessToken`
    * Unlock BBKs of *account2* and `BrickblockAccount`
    * Remove all added/delisted Brokers by calling `removeBroker(<Broker address>)` on `PoaManager` (by `owner`)
    * Remove deployed POA Tokens by calling `removeToken(<Proxy address>)` on `PoaManager` (by `owner`)
## Protocol

Deployed contract addresses:

- PoaCrowdsale: `<tbd>` (tx: `<tbd>`)
- PoaToken: `<tbd>` (tx: `<tbd>`)
- PoaManager: `<tbd>` (tx: `<tbd>`)
- PoaLogger: `<tbd>` (tx: `<tbd>`)
- Whitelist: `<tbd>` (tx: `<tbd>`)
- ExchangeRates: `<tbd>` (tx: `<tbd>`)
- ExchangeRateProvider: `<tbd>` (tx: `<tbd>`)

Register deployed contracts in `ContractRegistry`:
- registering PoaCrowdsale: `<tbd>`
- registering PoaToken: `<tbd>`
- registering PoaManager: `<tbd>`
- registering PoaLogger: `<tbd>`
- registering Whitelist: `<tbd>`
- registering ExchangeRates: `<tbd>`
- registering ExchangeRateProvider: `<tbd>`
