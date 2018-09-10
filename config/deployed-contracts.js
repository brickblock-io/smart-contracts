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

    AccessToken: '0x1c04bfa3be5f9616f85d755ad9e7937a50594053',
    BrickblockAccount: '0xbd26e373a943788f836498b302822e4b02f5c859',
    BrickblockToken: '0x9984fcd6af2df5ddf345cf5cae606c0780bf79ec',
    ExchangeRateProvider: '0x5adf8fe37c57fdc98c6015e6aadbe8f6db8d7ea4',
    ExchangeRates: '0xf693138139b61e877c2c82fc7d2f3e8ab8dcbea2',
    FeeManager: '0x44678e12b4c66c00f7d56cc1d6dbe9f4c84caec4',
    PoaCrowdsaleMaster: '0x0f04f5acbe84d97e3e9b88fee513b631e65045db',
    PoaLogger: '0xbf6b7a0866d5c712aadf47b2a9cf209f04151655',
    PoaManager: '0xcbdd46b4ccb65cb80e6964ba10d64988c8b14617',
    PoaTokenMaster: '0xf4517a4fc3fe5c3492df0a6e4cb349b2f317d1fc',
    Whitelist: '0x68ecd1639bc06bfddbd7f02d10e5b66f0029038a'
  },

  // kovan
  '42': {
    BrickblockToken: '0xf32A2e166d35A62a99955e7856A13C0C8FDEA730'
  },

  // local testnet (dedicated ganache when running `yarn ganache-cli --network 4448` in platform to run end-to-end tests against)
  '4448': {
    ContractRegistry: '0xd3aa556287afe63102e5797bfddd2a1e8dbb3ea5',

    AccessToken: '0x32cf1f3a98aeaf57b88b3740875d19912a522c1a',
    BrickblockAccount: '0xd17e1233a03affb9092d5109179b43d6a8828607',
    BrickblockToken: '0x5cca2cf3f8a0e5a5af6a1e9a54a0c98510d92081',
    ExchangeRateProvider: '0x1967d06b1faba91eaadb1be33b277447ea24fa0e',
    ExchangeRates: '0x336e71dab0302774b1e4c53202bf3f2d1ad1a8e6',
    FeeManager: '0x3635d6ae8610ea00b6ad8342b819fd21c7db77ed',
    PoaCrowdsaleMaster: '0x3f3993d6a6ce7af16662fbcf2fc270683fc56345',
    PoaLogger: '0x559e01ac5e8fe78963998d632e510bef3e306a78',
    PoaManager: '0x9e2c43153aa0007e6172af3733021a227480f008',
    PoaTokenMaster: '0xaef6182310e3d34b6ea138b60d36a245386f3201',
    Whitelist: '0xb2443146ec9f5a1a5fd5c1c9c0fe5f5cc459a31a'
  }
}
