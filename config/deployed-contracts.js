// This file contains the addresses that are injected into the build/contracts artifacts for
// consuming applications to use.
//
// While we still like using `truffle-contract` we should inject, as this file could also be
// included in the npm publish and used directly
// ie. `SomeContract.at(pick-address-based-on-network)`

module.exports = {
  // mainnet
  '1': {
    BrickblockToken: '0x4a6058666cf1057eac3cd3a5a614620547559fc9'
  },

  // rinkeby
  '4': {
    ContractRegistry: '0xe1c0a6e3894a690c3182b8005bbba18ecac4b026',
    BrickblockToken: '0x9651bb4124346d0145f886f4be14d146d46a47ed',
    AccessToken: '0x7ca6ac20d06b4d0fb1e59a9e4ced35de506fc53b',
    BrickblockAccount: '0x2ae7e7fd214df573d3b4ac32248a43bfcf2f473c',
    FeeManager: '0x2a46784a1971c43440c01d84208660c8f6950853',
    Whitelist: '0x7b236255a5c9f0faac7c085c76ec1876aeef102f',
    ExchangeRates: '0x09c03400b4338713081ac69d5184741dd057b69c',
    ExchangeRateProvider: '0x6f6addd773758f1db6d3771d052085ed71a1ce76',
    PoaManager: '0x219303e1fd7c7d89f122fb1cd30d3ab9e5dca6ac',
    PoaTokenMaster: '0xfc34822730abe7b6170ec1b129e71ae2a533a324',
    PoaCrowdsaleMaster: '0xed514da634bb61047c260052b1788343fa9aa62f',
    CentralLogger: '0xdfb4e846c34dd184ff5ae89c441db8283abfd07d',
    CustomPOAToken: ['0xcbf23082233ebf2b97a986b4d05669472d744e3c']
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
    PoaManager: '0x73d2f7225781aa1f002a1694cdd56dccc0c3253f'
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
