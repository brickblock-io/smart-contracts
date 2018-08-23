## Upgrading
`PoA`s are upgradeable. A PoA is composed of a `Proxy` contract which makes use of `PoaToken` and `PoaCrowdsale` which both inherit from `PoaCommon`. PoaManager uses the currently set `PoaToken` and `PoaCrowdsale` contracts set in the `Registry` contract when deploying a new `PoA`.

There are two components specifically that are upgradeable: `PoaToken` and `PoaCrowdsale`. If the inherited contract `PoaCommon` needs to be upgraded, BOTH `PoaToken` and `PoaCrowdsale` need to be upgraded.

### Before Upgrading
1. Write the new version which inherits from the old version:
```
contract PoaTokenV2 is PoaToken {

}
```
2. Test extensively!
1. Test every piece of storage manually making sure that no storage is being overwritten.
1. Test on testnet using a contract with already existing state mirroring something on mainnet as closely as possible.
1. `pause()` the token.

### The Actual Upgrade
At a high level the following must happen:
1. deploy the new contract
    * `PoaToken` or `PoaCrowdsale` or both
1. call the appropriate function on `PoaProxy` to upgrade
    * `proxyChangeTokenMaster` if changing `PoaToken`
    * `proxyChangeCrowdsaleMaster` if changing `PoaCrowdsale`
    * if both, call each with the appropriate contract address
1. call the appropriate initializers (if necessary) to set any new storage that is needed.
1. repeat above steps for any other already deployed `PoA`s that need to be upgraded.

### How to Upgrade
The upgraded master contracts can be deployed by anyone, this means that the owner does not need to be involved in the deployment process. Feel free to deploy the upgraded contract through truffle, remix, or myetherwallet. Just make sure to note the address once deployed.

Because the owner should be in cold store at this point, all upgrade transactions must be done with the cold store tool. Transactions for this would look like the following:

**Upgrading the PoaToken Portion**
```
{
  "defaults": {
    "to": "<POA_PROXY_ADDRESS_HERE>",
    "from": "<ECOSYSTEM_OWNER_HERE>",
    "fn": "proxyChangeTokenMaster(address)"
  },
  "txs" : [
    {
      "args": ["<DEPLOYED_UPGRADED_POA_TOKEN_HERE>"]
    }
  ],
}
```

**Upgrading the PoaCrowdsale Portion**
```
{
  "defaults": {
    "to": "<POA_PROXY_ADDRESS_HERE>",
    "from": "<ECOSYSTEM_OWNER_HERE>",
    "fn": "proxyChangeCrowdsaleMaster(address)"
  },
  "txs" : [
    {
      "args": ["<DEPLOYED_UPGRADED_POA_CROWDSALE_HERE>"]
    }
  ],
}
```

**Upgrading both PoaToken and PoaCrowdsale**
```
{
  "defaults": {
    "to": "<POA_PROXY_ADDRESS_HERE>",
    "from": "<ECOSYSTEM_OWNER_HERE>"
  },
  "txs" : [
    {
      "fn": "proxyChangeTokenMaster(address)",
      "args": ["<DEPLOYED_UPGRADED_POA_TOKEN_HERE>"]
    },
    {
      "fn": "proxyChangeCrowdsaleMaster(address)",
      "args": ["<DEPLOYED_UPGRADED_POA_CROWDSALE_HERE>"]
    },
  ],
}
```

### After Upgrading
1. `unpause()` the token.
1. check on any viewable state to ensure that no storage has been overwritten in some way.
1. change registry entries if this upgrade should be for all future contracts.