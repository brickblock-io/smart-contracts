// This file contains the addresses that are injected into the build/contracts artifacts for
// consuming applications to use.
//
// While we still like using `truffle-contract` we should inject, as this file could also be
// included in the npm publish and used directly
// ie. `SomeContract.at(pick-address-based-on-network)`

module.exports = {
  // mainnet
  '1': {},

  // rinkeby
  '4': {
    CustomPOAToken: ['0xcbf23082233ebf2b97a986b4d05669472d744e3c'],
    PoaManager: '0x219303e1fd7c7d89f122fb1cd30d3ab9e5dca6ac'
  },

  // kovan
  '42': {
    // deployed many so that we can see different stages in the `platform` web client
    // CustomPoaToken is "special" as PoaToken will be discovered through the PoaManager
    CustomPOAToken: [
      '0x5c49ac16796fce23c9e7a297ae17e6582e68519c',
      '0x09058386ad38c724d90f19fa35734dec426e2e6b',
      '0x99db07282c2d39b2ddda6484ebd04064cee73389',
      '0xced255300197fe359f3b9924f36e6be62a8e70b9',
      '0x9edf81ef84c828117b5bbfc42d44dfc5254522a1'
    ],
    PoaManager: '0x2b202911689205e853d0a3fa5705cf2c16ebed94'
  },

  // testnet
  //
  // NOTE: this is mainly used for cypress test suite in `platform` repo
  // the addresses can be defined here since the blockchain being used during cypress test runs
  // will always use the same owner address / nonce and so its deterministic
  '4447': {
    CustomPOAToken: ['0xd3aa556287afe63102e5797bfddd2a1e8dbb3ea5'],
    PoaManager: '0xd17e1233a03affb9092d5109179b43d6a8828607'
  }
}
