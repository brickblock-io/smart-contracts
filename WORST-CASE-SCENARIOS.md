# Worst Case Scenarios
A collection of unlikely, but possible scenarios that we might need to deal with and strategies on how to deal with them.

## 1. Non-upgradeable Contract Scenarios
(`ContractRegistry`, `BrickblockAccount`, `FeeManager`)

### ContractRegistry

| Probability | Severity |
| ----------- | -------- |
| Very Low    | Very High |

The registry address is hardcoded into all contracts via the `constructor` at deploy time. If we have to update the registry (read: re-deploy under new address), **all** our contracts would need to be either upgraded, if possible, or re-deployed to point to the new registry.

This is doable but very painful. This scenario is very unlikely because this contract is very simple and we can reasonably expect that there won't be any issues with it.

The `owner` address of the registry contract is essential, as changing the addresses in the registry can allow for a wide variety of attacks on our ecosystem.

### BrickblockAccount

| Probability | Severity |
| ----------- | -------- |
| Very Low    | High     |

This contract holds the company's BBK tokens and should not be upgradeable to instill trust in the community that we won't run off with the money. If a security issue was found here,  the company tokens could be at risk.

It's also a relatively simple contract. Additionally, all functions have the `onlyOwner` modifier. This contract should function as intended as long as the `ContractRegistry` isn't compromised.

### FeeManager

| Probability | Severity |
| ----------- | -------- |
| Very Low    | High     |

This contract holds all ETH that was paid as fees during PoA sales. It's impossible to move its ETH, other than through burning ACT first. Not even the `owner` can access the ETH in this contract without burning a proportionate amount of ACT.

It would be very painful to change. However, it also is a straightforward contract and the likelihood that there is an issue with it is very low.

## 2. AccessToken Scenarios

### We need to update the economics of ACT

| Probability | Severity |
| ----------- | -------- |
| Medium      | Medium   |

It could happen that there is a flaw in the token economics of ACT that we need to fix. This contract holds all locked BBK, which means we cannot simply redeploy it into some arbitrary state. Luckily, there is no ETH stored here and we're only concerned with BBK balances.

#### Mitigation Steps
- Deploy new version of the contract
- Pause the old contract (it's a `PausableToken`)
- Set the `totalSupply_` of the new version to the last value of the predecessor's `totalSupply_`
- On the new contract, the `balanceOf()` function needs to call its predecessor to get an accurate balance for an address. Essentially, we're keeping this part of the state on the old contract because migrating it would be too painful.
- Update `ContractRegistry` with the address of the new contract

## PoaToken Scenarios

### Restrict `transfer()` to whitelisted ETH addresses

| Probability | Severity |
| ----------- | -------- |
| Medium      | Very Low |

Currently, we only check for whitelist status during the initial sale of tokens. If a buyer of a token wants to send their token to a 3rd party afterward, they're free to do so at the moment. However, it's not unlikely that regulations change at some point forcing us to check both sender and receiver before allowing a `transfer()` to happen.

#### Mitigation Steps
- We've built this in behind a feature flag already
- We just need to call `toggleWhitelistTransfers` on all active PoA tokens, to set the boolean flag `whitelistTransfers` which enables checking that both `_to` and `_from` are whitelisted

### Prevent bad actor from transferring PoaTokens but NOT from receiving payouts
| Probability | Severity |
| ----------- | -------- |
| Medium      | Very Low |

There can be a case where we need to prevent a bad actor from transferring tokens. For example, we might receive a court order against a particular individual. Or we find out that their KYC data was invalid or fraudulent.

#### Mitigation Steps
- Call `toggleWhitelistTransfers` to turn on the `transfer()` whitelist
- NOTE: This is a global flag, so this will turn on this check for *all* token holders of a given `PoaToken`.
- Take the offending ETH address off of the whitelist
- This effectively "freezes" the offender's assets
- NOTE: This does not currently prevent the offender from receiving payouts

### Prevent bad actor from transferring PoaTokens AND receiving payouts

| Probability | Severity |
| ----------- | -------- |
| Medium      | Medium   |

Explanation see above. However, in addition we might also have to stop a bad actor from receiving payouts.

#### Mitigation Steps
We need to upgrade the `PoaToken` master contract. There are two approaches:

1. Either update `claimPayout()` to do a whitelist check, similar to `transfer()`
    - This effectively freezes both POA tokens and the ETH payout balance as long as the address is not whitelisted
2. OR change the `PoaToken` balance of the bad actor to zero. This would be a change with a large impact, as it removes all trustlessness properties from PoaToken holders. Since now *someone* (regulator, Brickblock, the custodian…) could decide that a PoaToken holder is not allowed to hold tokens and receive payouts. If we have to take this route, then additional questions arise such as: Where do those tokens go? Would they have to be auctioned? If they're auctioned, who would get the ETH? Where does the ETH balance of the unclaimed payouts go? And, most importantly, what are the checks and balances to perform this action?

### Custodian of a PoaToken loses their private key

| Probability | Severity |
| ----------- | -------- |
| High        | Medium   |

This is bound to happen sooner or later. If the custodian lost their private key, no `onlyCustodian` functions could be called on `PoaToken` anymore (e.g. `activate`, `changeCustodianAddress`, `payout`, `updateProofOfCustody`). Effectively, the `PoaToken` would be stuck, can never be activated (if in a pre-active stage) and payouts become impossible since the custodian address can't be changed.

#### Mitigation Steps: Short Term
- Set `PoaToken` to stage `terminated`
- Redeploy the `PoaToken`
- Migrate the state of the old contract to the new
- Special case: If the asset should not be tokenized anymore, we'd need to re-build `PoaToken` balances by reducing all `BuyEvent`s and `TransferEvent`s in order to do a final payout

#### Mitigation Steps: Mid Term
We could add an admin function to change the custodian's address.
The checks and balances would be critical here.
We need to think carefully about what conditions need to be met to call this function, e.g.:

- Custodian needs to sign a legally binding document, asking the `owner` of the contract to update their address
- Upload this document to IPFS
- Store the IPFS hash in the `PoaToken` contract for a public audit trail
- Change the custodian's address in the `PoaToken` contract

#### Mitigation Steps: Long Term
Long term we probably want to switch to a smart contract representing identity. Could be [EIP725](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-725.md), [EIP735](https://github.com/ethereum/EIPs/issues/735)
or whichever EIP is best suited to manage the custodian's identity and offers an option to recover lost keys with some strong checks and balances.

### Security vulnerability in PoaToken

| Probability | Severity |
| ----------- | -------- |
| Medium      | Medium   |

Solidity is still a young language, and there is no guarantee that there won't be new vulnerabilities discovered in the future. This is why we chose to make `PoaToken`s upgradeable via the Proxy pattern to be able to react quickly and protect investors.

#### Mitigation Steps
- Pause all `PoaToken` instances to prevent transfers
- Figure out what the issue is
- Check whether we can resolve the issue by upgrading the master `PoaToken` contract via the Proxy
- Work out which contracts are in a bad state because of an attack
- If balances have been manipulated due to the vulnerability:
  * Rebuild the state for affected contracts by reducing all `Buy` and `Transfer` events for that `PoaToken` to get a mapping of address balances:
  * Replay all correct `Buy` and `Transfer` events, skip malicious ones (e.g. hacker draining balances into one of their wallets via a vulnerability)
  * Check that the total of tokens matches the expected total
  * Check that the mapping of addresses to tokens is the same number on old and new contract (minus potential hacker addresses)
- Redeploy affected contracts with correct state in `paused` state
- Notify exchanges and token holders of this `PoaToken`s new address
- Terminate the old `PoaToken`
- Unpause the new `PoaToken`


## WhitelistContract Scenarios

### The whitelist needs to be changed from a global to a scoped version

| Probability | Severity |
| ----------- | -------- |
| High        | Low      |

Initially, there is one global master whitelist to rule them all. As we scale our business, it's likely that new requirements arise around whitelisting. It could be that each broker will need their own whitelist of their own clients. Or due to new regulation, we might need different whitelists for different jurisdictions. Or there may be special assets that even require a whitelist on a per PoaToken contract level.

#### Mitigation Steps
- Code a new `WhitelistContract` that checks the `msg.sender` (which would be the PoaToken itself) as well as the address that is sent in the PoaToken function `checkIsWhitelisted`
- Deploy new `WhitelistContract`
- Initialize with desired state of whitelisting
- Update `ContractRegistry`


## ExchangeRates Scenarios

### We no longer want to use Oraclize

| Probability | Severity |
| ----------- | -------- |
| Medium      | Low      |

If Oraclize goes out of business, changes its fees or we want to use another oracle service (perhaps even our own), there are two scenarios to cover:

1. The Interface expected in `ExchangeRates` of the `ExchangeRateProvider` stays the same
2. The Interface expected in `ExchangeRates` of the `ExchangeRateProvider` changes

#### Mitigation Steps: Interface Remains Unchanged
- Build and deploy a new `ExchangeRateProvider`
- Call `killProvider` on old `ExchangeRate` with an address to receive any leftover ETH
- Update the `ContractRegistry` with the new `ExchangeRateProvider`'s address
- Fund the new `ExchangeRateProvider` with ETH to fund Oracle callbacks when needed

#### Mitigation Steps: Interface Changes
- Build and deploy a new `ExchangeRateProvider` as above
- Build and deploy a new `ExchangeRates` contract to use the updated interface
- Ensure the expected fiat exchange rates are active in the new `ExchangeRates` contract
- Update the `ContractRegistry` with the new `ExchangeRates`'s address
- Call `toggleRatesActive` on old `ExchangeRate`

## Force Majeure Scenarios

### There is a hard fork on Ethereum Blockchain

| Probability | Severity |
| ----------- | -------- |
| Medium      | Low      |

As there is no possibility to clone a real world asset, Brickblock will choose on which blockchain to operate.

#### Mitigation Steps: Interface Remains Unchanged
- Warn users about the blockchain change
- Call `killProvider` on old `ExchangeRate` with an address to receive any leftover ETH
- Pause `BBK Token`, `ACT token` on old blockchain
- Terminate all active POA Tokens on old blockchain
