const logger = require('../../scripts/lib/logger')
const {
  oneHundredThousandTokensInWei,
  oneWeekInSec,
  twoWeeksInSec,
  oneHundredThousandEuroInCents
} = require('../helpers/constants')
const { unixTimeWithOffsetInSec } = require('../helpers/general')
const yargs = require('yargs')
  .version(require('../../package.json').version)
  .option('default', {
    alias: 'def',
    describe:
      'Deploys eco-system with default actions (register, finalizeBbk, setRate, addBroker, addToWhiteList)',
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
  .option('setRate-interval', {
    alias: 'sr-iv',
    describe: 'Sets currency rate fetch interval',
    default: 0
  })
  .option('setRate-symbol', {
    alias: 'sr-sym',
    describe: 'Sets currency symbol',
    default: 'EUR'
  })
  .option('setRate-gasLimit', {
    alias: 'sr-gas',
    describe: 'Sets exchange rate callback gas limit',
    default: 1500000
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
    describe: 'Deploys an example POA token',
    default: false
  })
  .option('deployPoa-totalSupply', {
    alias: 'dp-ts',
    describe: 'Total supply of POA Token in wei',
    default: oneHundredThousandTokensInWei
  })
  .option('deployPoa-currency', {
    alias: 'dp-c',
    describe: 'Currency of POA Token',
    default: 'EUR'
  })
  .option('deployPoa-name', {
    alias: 'dp-n',
    describe: 'Name of POA Token',
    default: 'Local Testnet Token'
  })
  .option('deployPoa-symbol', {
    alias: 'dp-s',
    describe: 'Symbol of POA Token',
    default: 'BBK-RE-DE123'
  })
  .option('deployPoa-startTimeForEthFunding', {
    alias: 'dp-start',
    describe:
      'Start Time for eth funding period in unix time in seconds format. Default is 60 seconds after from now.',
    default: unixTimeWithOffsetInSec(60)
  })
  .option('deployPoa-durationForEthFunding', {
    alias: 'dp-de',
    describe:
      'Duration for eth funding period in seconds. Default is 1 week from start time.',
    default: oneWeekInSec
  })
  .option('deployPoa-durationForActivation', {
    alias: 'dp-da',
    describe:
      'Duration for activation period in seconds. Default is 2 weeks from start time.',
    default: twoWeeksInSec
  })
  .option('deployPoa-fundingGoalInCents', {
    alias: 'dp-fg',
    describe: 'Funding goal in cents.',
    default: oneHundredThousandEuroInCents
  })
  .option('deployPoa-listToken', {
    alias: 'dp-lt',
    describe: 'If POA token address should be listed in PoaManager.',
    default: true,
    type: 'boolean'
  })
  .option('addToWhiteList', {
    alias: 'aw',
    describe:
      'adds given address to whitelist. If no address is given, fallbacks to accounts[3]'
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
  .option('forceDeploy', {
    alias: 'fd',
    describe:
      'deploys specified contracts given as parameters seperated by space. Ex: --do ContractRegistry AccessToken. "all" means deploy everything. Can be used with --uec to deploy only selected contracts and use the rest from the registry.',
    type: 'array',
    choices: [
      'all',
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
  .option('execute', {
    alias: 'exec',
    describe:
      'Contract name for the function to be executed. Should be used together with --execute-functionName'
  })
  .option('execute-functionName', {
    alias: 'exec-fn',
    describe: 'function name to be executed'
  })
  .option('execute-arguments', {
    alias: 'exec-args',
    describe: 'function arguments',
    type: 'array',
    default: []
  })
  .option('execute-address', {
    alias: 'exec-addr',
    describe:
      'Contract address. Can be the real address or index number in Poa Manager'
  })
  .option('execute-txConfig', {
    alias: 'exec-tc',
    describe:
      'tx params for the function to executed. Ex: \'{"from":"0x1c34e1325d5193cdf95fc6e863edc789a798a23e", "value": 10000000}\''
  })
  .help()

const init = network => {
  if (
    network !== 'test' &&
    yargs.argv.uec === false &&
    (typeof yargs.argv.fd === 'undefined' || yargs.argv.fd.length === 0)
  ) {
    logger.error(
      '\nMissing parameters! You have to enter at least one of "--useExistingContracts" or "--fd [params]" parameters.'
    )
    process.exit(1)
  }

  return yargs.argv
}

module.exports = { init, argv: yargs.argv }
