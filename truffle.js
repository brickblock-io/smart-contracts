const fs = require('fs')
const HDWalletProvider = require('truffle-hdwallet-provider')
const Web3 = require('web3')

let hdwallet = null
if (process.env.npm_lifecycle_event === 'migrate:ropsten') {
  try {
    const mnemonic = fs
      .readFileSync(process.env.HDWALLET_PATH)
      .toString()
      .trim()
    hdwallet = new HDWalletProvider(mnemonic, 'https://ropsten.infura.io/')
  } catch (error) {
    console.error(`can't import key from : "${process.env.HDWALLET}" `, error)
  }
}

module.exports = {
  networks: {
    dev: {
      host: 'localhost',
      port: 9545,
      network_id: 4447
    },
    ropsten: {
      host: 'localhost',
      port: 8545,
      network_id: 3,
      gas: 4600000,
      gasPrice: 23e9
    },
    kovan: {
      host: 'localhost',
      port: 8545,
      network_id: 42,
      gas: 4700000,
      gasPrice: 20e9
    },
    live: {
      host: 'localhost',
      port: 8545,
      network_id: 0,
      gas: 4700000,
      gasPrice: 30e9
    }
  }
}
