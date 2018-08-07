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
    CentralLogger: '0xbf6b7a0866d5c712aadf47b2a9cf209f04151655',
    ExchangeRateProvider: '0x5adf8fe37c57fdc98c6015e6aadbe8f6db8d7ea4',
    ExchangeRates: '0xf693138139b61e877c2c82fc7d2f3e8ab8dcbea2',
    FeeManager: '0x44678e12b4c66c00f7d56cc1d6dbe9f4c84caec4',
    PoaCrowdsaleMaster: '0x0f04f5acbe84d97e3e9b88fee513b631e65045db',
    PoaManager: '0xcbdd46b4ccb65cb80e6964ba10d64988c8b14617',
    PoaTokenMaster: '0xf4517a4fc3fe5c3492df0a6e4cb349b2f317d1fc',
    Whitelist: '0x68ecd1639bc06bfddbd7f02d10e5b66f0029038a'
  },

  // kovan
  '42': {
    PoaManager: '0x73d2f7225781aa1f002a1694cdd56dccc0c3253f'
  },

  // local testnet (default ganache when running `truffle develop --network dev`)
  '4447': {
    ContractRegistry: '0x345ca3e014aaf5dca488057592ee47305d9b3e10',

    AccessToken: '0xf25186b5081ff5ce73482ad761db0eb0d25abfbf',
    BrickblockAccount: '0x8f0483125fcb9aaaefa9209d8e9d7b9c8b9fb90f',
    BrickblockToken: '0x9fbda871d559710256a2502a2517b794b482db40',
    CentralLogger: '0x2c2b9c9a4a25e24b174f26114e8926a9f2128fe4',
    ExchangeRateProvider: '0x30753e4a8aad7f8597332e813735def5dd395028',
    ExchangeRates: '0xfb88de099e13c3ed21f80a7a1e49f8caecf10df6',
    FeeManager: '0xaa588d3737b611bafd7bd713445b314bd453a5c8',
    PoaCrowdsaleMaster: '0xf204a4ef082f5c04bb89f7d5e6568b796096735a',
    PoaManager: '0x75c35c980c0d37ef46df04d31a140b65503c0eed',
    PoaTokenMaster: '0x82d50ad3c1091866e258fd0f1a7cc9674609d254',
    Whitelist: '0xdda6327139485221633a1fcd65f4ac932e60a2e1'
  }
}
