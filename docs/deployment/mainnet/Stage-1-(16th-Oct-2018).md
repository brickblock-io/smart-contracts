# Mainnet Deployment - Stage 1

### Table of Content
1.  [Plan](#plan)
2.  [Protocol](#protocol)

## Plan
- Use existing BrickblockToken contract
    * make sure the address is written in `config/deployed-contracts.js`
    --> For testnet prep: deploy BrickblockToken on testnet with Remix (specify any bonusDistributionAddress) and call `unpause()`

- We use the following Ethereum addresses:
    * `0xa9776a043463a4ba4041256e6e29fba7b74d5098` for deployment. Will be initial owner of contracts. Funded with ~1 ETH.
        * [x] Should be funded with 2 BBK to transfer to BrickblockAccount after its deployed (to test locking of BBK)
    * `0xc59b4da560b6cbd20a15722addc3c2caddc317af` is 'BBK-Holder' in the steps below. Funded with ~0.01 ETH to pay for transaction fees.
        * [x] Should be funded with 1 BBK to test locking of BBK.

1. Deploy 4 contracts:
    * ContractRegistry
    * AccessToken
    * FeeManager
    * BrickblockAccount (use token release timestamp: 1625961600, which corresponds to 3 years lockup until: Sun, 11 Jul 2021, 00:00:00 GMT)
    ```
    yarn migrate:mainnet --fd ContractRegistry AccessToken FeeManager BrickblockAccount --register
    ```
    * If something goes wrong (Infura issues):
        * during deployment: note already deployed contract addresses, remove them from command and run again
        * during registering: note deployed contract addresses. Switch to Remix and register still unregistered contracts manually via `updateContractAddress(name, address)`
	
	
2. Register all 4 contracts (including BrickblockToken) in ContractRegistry
	* register BrickblockToken
	* register AccessToken
	* register FeeManager
	* register BrickblockAccount
  --> Either partial-automatic with CLI tool (see step above), or fully-manually with Remix
  --> Note: existing BrickblockToken always must be registered manually with Remix!
	
3. Transfer BBK tokens
	* 2 BBK to BrickblockAccount (mainnet: must be transferred from somewhere)
	  - 2000000000000000000 token amount
	* 1 BBK to a any bbk-holder (mainnet: must come from somewhere)
	  - 1000000000000000000 token amount
	--> testnet prep: use `distributeTokens(address,uint)` to give BrickblockAccount and
	    BBK-holder the right amount of BBK tokens
		
4. BBK-holder must approve AccessToken to transfer tokens from BrickblockToken
	* as BBK-holder, call `approve(<accessTokenAddress>, 1000000000000000000)`
	* BrickblockAccount doesn't have to do that since it's done in same transaction
	  as locking BBK
	
5. Lock BBK
	* BrickblockAccount owner calls `lockBBK(2 * 10^18)` on BrickblockAccount contract
	* BBK-holder calls `lockBBK(1 * 10^18)` on ACT contract
	--> Verify `totalLockedBbk()` in AccessToken, should be 3*10^18
	
6. Anyone sends ETH to FeeManager
	* ETH-holder sends ETH, e.g. 0.01 ETH, to FeeManager via `payFee()`
	--> ACT are now being distributed among BBK-holders who locked their BBK
	
7. Verify ACT balance of BrickblockAccount and BBK-holder
    * BrickblockAccount should have 2x token amount compared to BBK-holder.
	* BrickblockAccount should have: 6666666666666666666 (6.66 ACT)
	* BBK-Holder        should have: 3333333333333333333 (3.33 ACT)
	
8. Convert ACT back to ETH via FeeManager's `claimFee()` (1000 ACT = 1 ETH).
	* BrickblockAccount owner calls `claimFee()` on BrickblockAccount,
	  e.g. 2333333333333333333 (2.33 ACT will be converted to ETH)
	* BBK-Holder calls `claimFee()` on FeeManager
	
9. Verify ETH balance of BrickblockAccount and BBK-holder
	* With claimed token amount above, BrickblockAccount should have 0.002333333333333333 ETH
	
10. Unlock BBK again (from BrickblockAccount and from BBK-Holder) to reset state (no locked BBK)

## Protocol

Deployed contract addresses:

- ContractRegistry: `0x5973376b603268fe4251d13040226078257014f8` (tx: `0xa19b356d8fb242013763ba93e959ada7e7ac999bd9e507e0ec50c7e27e9d4942`)
- AccessToken: `0xE043dd0C6712b862D68Be955f4a031940FBB5513` (tx: `0x2f6567bb27c76ffccf565436915c36be84c96acce3dfcabdfdf1768be00a6b20`)
- FeeManager: `0xe87227adf0fd3f6e580e2825069a0f8e8da66ad0` (tx: `0xb18459c50efe72136d8324428baaacc77fe4655d8afac9122230a0727fd462c5`)
- BrickblockAccount: `0x5E59DE3c393bf442288E5a7aA2A9b216aF79EA63` (tx: `0xa3f75001002e32580c815e6883e26dbed8a0f6ab6fd815ba44b129e628adb919`)

Register deployed contracts in `ContractRegistry`:
- registering FeeManager: `0x5e4f0a61f030d7bef5a4ad0ab1ccc19b4601b75ff072e0d020aa3a0d157c6b5f`
- registering BrickblockAccount: `0x15c2fff8a100a9e5d14fea4d25438196267a41276d017964cd991003f79bec36`
- registering AccessToken: `0xfb271a7c66c1151f9d65c8b234c5f2c16b97a5a992cf9e4c786aed27b0fe4bc9`
- registering BrickblockToken: `0x4db5603122d2ae10ef59ebb327a787c12c1fe0a9fa899636cc46533100640ba3` (reusing BrickblockToken at address `0x4a6058666cf1057eaC3CD3A5a614620547559fc9`)

BBK-Holder (1 BBK) approves AccessToken on BrickblockToken:
`0x4be917974d3e470d5ae4b5654614809a1a5afa34b772111cfe9d0c1b43014013`

BBK-Holder locks 1 BBK on AccessToken:
`0x1ad667720ecafc7e3de519660acb393d2ba7137641268423791fc95e3591b435`

Transferring 2 BBK from account1 (deploying wallet) to BrickblockAccount

BrickblockAccount's owner calls `lockBbk(2e18)` on BrickblockAccount (which approves and locks BBK in the same transaction)
`0x4f67f9c79d20270ce66d37500b40d7b0862a58ab0cf70e60c361a8b3ac2d975d`

A payout is simulated by transferring 0.01 ETH from account1 to FeeManager by calling its `payFee()` function:
`0xfd6f723f733e7c1756bc8b2dbadae07c238c80037f992e9c8e8cb530046922ca`

This triggered the ACT generation. We verify:
- AccessToken contract has total supply of 10*10^18 ACT
- BrickblockAccount has 6666666666666666666 ACT
- BBK-Holder has 3333333333333333333 ACT

Convert ACT back to ETH (1000 ACT = 1 ETH):
- BBK-Holder claims all ACT:
`0xe09c7451d667ee951ecbb8bea0de133b7821d180e2b58ade8fd7d6e1cd031b0f` (transferred ETH can be seen in etherscan)
- BrickblockAccount claims ACT:
`0x250a950b0174cba2ad8479dec7c47386064c55108d007764648f43cf851ef52f` (transferred ETH can be seen in etherscan)

Unlocking BBKs
- BBK-Holder unlocks all locked BBK (1 BBK):
`0xb8013217b8c3da8e5e1a7276becd6239f40ea82094c8bc00e32ced125b1cdc21`
- BrickblockAccount unlocks all locked BBK (2 BBK):
`0x50bfcfa2ceb5742e5b9fd6c2c031859a08e22ab97829b7e67b9e722d688e392c`

We verified the deployed contracts on etherscan.io:
- `ContractRegistry` (no constructor args, no libraries)
- `AccessToken` (constructor arg prefilled, no libraries)
- `FeeManager` (constructor arg prefilled, library flattened)
- `BrickblockAccount` (constructor args prefilled, no libraries)
- already verified: `BrickblockToken`

We verified that transferring ACT between addresses works as expected
- Checked `spentAct(<address>)` and `receivedAct(<address>)` of both sender and receiver of ACT

Transferred 0.5 ETH back to @philip