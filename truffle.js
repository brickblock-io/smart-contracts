const HDWalletProvider = require('truffle-hdwallet-provider')
const testnetMnemonic = process.env.TESTNET_MNEMONIC
const mainnetMnemonic = process.env.MAINNET_MNEMONIC
const providerUrl = process.env.PROVIDER_URL

module.exports = {
  networks: {
    dev: {
      host: 'localhost',
      port: 8545,
      network_id: 4447,
      gasPrice: 1e9
    },
    devGeth: {
      host: 'localhost',
      port: 8545,
      network_id: 4448,
      // Values below 6000000 fail often because of the required minimum block gas amount.
      gas: 6300000
    },
    ropsten: {
      network_id: 3,
      gas: 4.6e6,
      gasPrice: 5e9,
      provider: () =>
        new HDWalletProvider(
          testnetMnemonic,
          providerUrl || 'https://ropsten.infura.io'
        )
    },
    kovan: {
      network_id: 42,
      gas: 6.5e6,
      gasPrice: 5e9,
      provider: () =>
        new HDWalletProvider(
          testnetMnemonic,
          providerUrl || 'https://kovan.infura.io'
        )
    },
    rinkeby: {
      network_id: 4,
      gas: 4.5e6,
      gasPrice: 5e9,
      provider: () =>
        new HDWalletProvider(
          testnetMnemonic,
          providerUrl || 'https://rinkeby.infura.io'
        )
    },
    mainnet: {
      network_id: 1,
      gas: 6.5e6,
      gasPrice: 5e9,
      provider: () =>
        new HDWalletProvider(
          mainnetMnemonic,
          providerUrl || 'https://mainnet.infura.io'
        )
    },
    // to be used when we want to interact in a local truffle console session
    hdwallet: {
      provider: () => {
        return new HDWalletProvider(
          // NOTE: this can be any valid mnemonic, as long as you are making `calls` and not `transactions`
          process.env.HDWALLET_MNEMONIC,
          // NOTE: this is the network you want to connect to; if you are running a local network you
          // can connect to that instead of infura but then you probably want to use:
          // `truffle console --network dev`
          process.env.INFURA_URL
        )
      },
      network_id: '*'
    }
  },
  mocha: {
    /*
     * Default reporter: 'spec'
     * + Prints out test duration
     * + Faster
     * - Doesn't display gas costs
     *
     * Gas cost reporter: 'eth-gas-reporter'
     * + Can analyze gas costs
     * - Slow
     * - Doesn't display test duration
     */
    reporter: process.env.GAS_REPORTER ? 'eth-gas-reporter' : 'spec'
  }
}
