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
    ContractRegistry: '0xf166a2c755c2ad404b42c9be146acefbb3907aee',
    BrickblockToken: '0x9984fcd6af2df5ddf345cf5cae606c0780bf79ec',
    AccessToken: '0x1c04bfa3be5f9616f85d755ad9e7937a50594053',
    BrickblockAccount: '0xbd26e373a943788f836498b302822e4b02f5c859',
    FeeManager: '0x44678e12b4c66c00f7d56cc1d6dbe9f4c84caec4',
    Whitelist: '0x68ecd1639bc06bfddbd7f02d10e5b66f0029038a',
    PoaManager: '0xcbdd46b4ccb65cb80e6964ba10d64988c8b14617',
    ExchangeRates: '0xf693138139b61e877c2c82fc7d2f3e8ab8dcbea2',
    ExchangeRateProvider: '0x5adf8fe37c57fdc98c6015e6aadbe8f6db8d7ea4',
    PoaTokenMaster: '0xf4517a4fc3fe5c3492df0a6e4cb349b2f317d1fc',
    PoaCrowdsaleMaster: '0x0f04f5acbe84d97e3e9b88fee513b631e65045db',
    CentralLogger: '0xbf6b7a0866d5c712aadf47b2a9cf209f04151655',
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
