module.exports = {
  networks: {
    // no longer need development network... new truffle handles this!
    ropsten: {
      host: "localhost",
      port: 8545,
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
