// This file contains the addresses that are injected into the build/contracts artifacts for
// consuming applications to use.
//
// While we still like using `truffle-contract` we should inject, as this file could also be
// included in the npm publish and used directly
// ie. `SomeContract.at(pick-address-based-on-network)`

module.exports = {
  // mainnet
  '1': {
    ContractRegistry: '0x5973376b603268fe4251d13040226078257014f8',
  },

  // ropsten
  '3': {
    ContractRegistry: '0xae472faaf28b2979d4d36be8ad8947ed7c827e99',
  },

  // rinkeby
  '4': {
    ContractRegistry: '0xf166a2c755c2ad404b42c9be146acefbb3907aee',
  },

  // kovan
  '42': {
    ContractRegistry: '0x138d5bb1eef88dad0b6dde5e46a746ef31a22f6e',
  },

  // local testnet (dedicated ganache when running `yarn ganache-cli --network 4448` in platform to run end-to-end tests against)
  '4448': {
    ContractRegistry: '0x17e91224c30c5b0b13ba2ef1e84fe880cb902352',
  },
}
