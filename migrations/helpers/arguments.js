const yargs = require('yargs')
  .version(require('../../package.json').version)
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
  .option('changeOwner', {
    alias: 'co',
    describe: 'Changes owner to "NEW_OWNER" given in .env file',
    default: false
  })
  .option('deployOnly', {
    alias: 'do',
    describe:
      'deploys specified contracts given as parameters seperated by space. Ex: --do ContractRegistry AccessToken',
    type: 'array',
    choices: [
      'AccessToken',
      'BrickblockAccount',
      'ContractRegistry',
      'BrickblockToken',
      'ExchangeRates',
      'FeeManager',
      'PoaLogger',
      'PoaManager',
      'PoaTokenMaster',
      'PoaCrowdsaleMaster',
      'Whitelist',
      'ExchangeRateProvider',
      'ExchangeRateProviderStub'
    ]
  })
  .help()

module.exports = yargs.argv
