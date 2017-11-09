const fs = require('fs')
const HDWalletProvider = require('truffle-hdwallet-provider')

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
      host: "localhost",
      port: 8545,
      provider: hdwallet,
      network_id: 3,
      gas: 3712388
    },
    kovan: {
      host: "localhost",
      port: 8545,
      network_id: 42,
      gas: 4500000
    }
  }
};
