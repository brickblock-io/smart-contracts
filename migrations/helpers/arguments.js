const yargs = require('yargs')
  .option('all', {
    alias: 'a',
    describe: 'Deploys eco-system with all options'
  })
  .option('register', {
    alias: 'r',
    describe: 'Registers contracts to contract registry'
  })
  .option('setRate', {
    alias: 'sr',
    describe: 'Sets currency rate'
  })
  .option('finalizeBbk', {
    alias: 'fb',
    describe: 'finalizes crowdsale, distributes bbk if not mainnet'
  })
  .option('addBroker', {
    alias: 'ab',
    describe: 'Adds broker to PoaManager'
  })
  .option('deployPoa', {
    alias: 'dp',
    describe: 'Adds broker to PoaManager'
  })
  .option('addToWhiteList', {
    alias: 'aw'
  })
  .option('useExistingContracts', {
    alias: 'uec',
    default: false
  })
  .help()

module.exports = yargs.argv
