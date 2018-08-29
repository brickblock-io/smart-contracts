const yargs = require('yargs')
  .option('all', {
    alias: 'a',
    describe: 'Deploys eco-system with all options',
    default: false
  })
  .option('register', {
    alias: 'r',
    describe: 'Registers contracts to contract registry',
    default: false
  })
  .option('setRate', {
    alias: 'sr',
    describe: 'Sets currency rate',
    default: false
  })
  .option('finalizeBbk', {
    alias: 'fb',
    describe: 'finalizes crowdsale, distributes bbk if not mainnet',
    default: false
  })
  .option('addBroker', {
    alias: 'ab',
    describe: 'Adds broker to PoaManager',
    default: false
  })
  .option('deployPoa', {
    alias: 'dp',
    describe: 'deploys an example POA token',
    default: false
  })
  .option('addToWhiteList', {
    alias: 'aw',
    describe: 'adds accounts to whitelist',
    default: false
  })
  .option('useExistingContracts', {
    alias: 'uec',
    describe:
      'Uses existing contracts instead of a new deploy if they exist in "config/deployed-contracts.js"',
    default: false
  })
  .help()

module.exports = yargs.argv
