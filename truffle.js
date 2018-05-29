/*
 * Our CI runners often run multiple smart contract test jobs in parallel which can lead
 * to port conflicts. That's why we're defining a range of 100 ports here that the CI
 * runners can choose from, depending on which ports are already in use
 */
const FIRST_PORT = 8545
const LAST_PORT = 8645

const ciNetworks = {}
for (let portCounter = FIRST_PORT; portCounter < LAST_PORT; portCounter++) {
  ciNetworks[`ci${portCounter}`] = {
    host: 'localhost',
    port: portCounter,
    network_id: '*',
    gasPrice: 1e9
  }
}

module.exports = {
  networks: {
    dev: {
      host: 'localhost',
      port: 9545,
      network_id: 4447,
      gasPrice: 1e9
    },
    ...ciNetworks,
    ropsten: {
      host: 'localhost',
      port: 8545,
      network_id: 3,
      gas: 4.6e6,
      gasPrice: 23e9
    },
    kovan: {
      host: 'localhost',
      port: 8545,
      network_id: 42,
      gas: 4.7e6,
      gasPrice: 20e9
    },
    rinkeby: {
      host: 'localhost',
      port: 8545,
      network_id: 4,
      gas: 7e6,
      gasPrice: 1e9
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
