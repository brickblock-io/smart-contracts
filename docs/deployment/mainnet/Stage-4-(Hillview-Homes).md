# Mainnet Deployment - Stage 4 - POA Hillview Homes

### Table of Content
1.  [Plan](#plan)
2.  [Protocol](#protocol)

## Plan

### Prerequisites
- [ ] Remaining contracts of the ecosystem are deployed on mainnet
- [ ] Fiat rate is initially fetched (for first housesale: GBP as currency)
- [ ] Agree on fiat rate API to be used. Does the API has to be approved by JTC?
- [ ] Agree on Broker address to be used for POA creation
- [ ] Collect remaining POA parameters:
    - [ ] Custodian address
    - [ ] Start time for ETH funding period
    - [ ] Duration for ETH funding period
    - [ ] Duration for activation period
- [ ] Agree on GBP rate penalty (by default: 0%)

### Mainnet steps

1. List Broker address as active broker so that he can create POAs
    - Call `addBroker(<Broker address>)` on PoaManager. This must be done by the owner of PoaManager.
    - Verify that the Broker address is added to PoaManager and that the Broker status is active.

2. Use the CLI tool to deploy parametrized POA contracts

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

3. Verify:
    - POA token is listed as active in PoaManager
    - POA token is in paused state and has correct values in variables (check with Remix getters)
    - POA token is in `Preview` stage (stage 0)

## Protocol