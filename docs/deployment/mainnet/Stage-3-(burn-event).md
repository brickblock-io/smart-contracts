# Mainnet Deployment - Stage 3 (burn event)

### Table of Content
1.  [Plan](#plan)
2.  [Protocol](#protocol)

## Plan

### Prerequisites

- [x] BrickblockAccount is deployed: `0x5E59DE3c393bf442288E5a7aA2A9b216aF79EA63`
- [x] Collecting relevant token numbers:
    * old total supply: `500,000,000`
    * 'company tokens' moved to BrickblockAccount: `175,000,000`, which is 35% of old total supply
    * 'contributor tokens' (max sellable tokens): `255,000,000`, which is 51% of old total supply
    * 'bonus tokens': `70,000,000`, which is 14% of old total supply
    * sent tokens from BrickblockToken: `89,658,150.387577581504002893` (found by crawling blockchain)
    * send to escrow: `90,000,143.34 - 89,658,150.387577581504002893 = 341,992.95242242515`
    * **tokens to be burnt: `234,999,856.65`**
    * new total supply: `265,000,143.34`
- [x] Align all token numbers with this document: https://docs.google.com/spreadsheets/d/1nsiEHxbc1VPyO8eAnDOlCj7IYtMUOLh5-WvJslIRxV4/edit#gid=0. @pascal owns this I think. UPDATE: We agreed on token numbers in a meeting. See above numbers.
- [ ] Receive Escrow wallet address for unclaimed BBK from @Jakob.
- [ ] Doublecheck amount of burnt tokens (management, marketing must confirm)
- [ ] Doublecheck amount of tokens moved to escrow (management, marketing must confirm)

### Mainnet steps

1. Update the “fountain contract address” (old name for what is now referred to as `BrickblockAccount`) to BrickblockAccount
    - Call `changeFountainContractAddress(<BrickblockAccount address>)` on `BrickblockToken` (by `owner`).
    - verify!

2. Moving unclaimed BBK tokens from the ICO to an escrow wallet
    - verify correct token amount and escrow wallet address
    - Call with Remix on BrickblockToken: `distributeTokens(<Escrow wallet address>, <amount>)`. Must be called by BrickblockToken owner.
    - verify! e.g. balance of escrow wallet on BrickblockToken

3. Burning unsold BBK tokens.
    - verify correct burnt amount
    - verify current state of BrickblockToken
    - Call with Remix on BrickblockToken: `finalizeTokenSale()`. Must be called by BrickblockToken owner.
    - verify! new total supply, emitted events..

4. Pull company-reserved BBK tokens to `BrickblockAccount` contract
    - Call `pullFunds()` on `BrickblockAccount` (by `owner`)
    - Verify new BBK balance of `BrickblockAccount`


Optional: Set up ENS domains for all deployed contracts (edited)

## Protocol
