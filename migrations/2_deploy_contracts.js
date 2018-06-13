/* eslint-disable no-console */
const AccessToken = artifacts.require('AccessToken')
const BrickblockAccount = artifacts.require('BrickblockAccount')
const BrickblockToken = artifacts.require('BrickblockToken')
const CentralLogger = artifacts.require('CentralLogger')
const ContractRegistry = artifacts.require('ContractRegistry')
const ExchangeRateProvider = artifacts.require('ExchangeRateProvider')
const ExchangeRates = artifacts.require('ExchangeRates')
const FeeManager = artifacts.require('FeeManager')
const PoaManager = artifacts.require('PoaManager')
const PoaToken = artifacts.require('PoaToken')
const Whitelist = artifacts.require('Whitelist')
const ExchangeRateProviderStub = artifacts.require(
  'stubs/ExchangeRateProviderStub'
)

const { localMigration } = require('./networks/localMigration')
const { testnetMigration } = require('./networks/testnetMigration')

// artifacts is not available in other files...
const contracts = {
  AccessToken,
  BrickblockAccount,
  ContractRegistry,
  BrickblockToken,
  ExchangeRates,
  FeeManager,
  CentralLogger,
  PoaManager,
  PoaToken,
  Whitelist,
  ExchangeRateProvider,
  ExchangeRateProviderStub
}

module.exports = (deployer, network, accounts) => {
  console.log(`deploying on ${network} network`)

  deployer
    .then(async () => {
      switch (network) {
        case 'devGeth':
        case 'test':
          return true
        case 'dev':
          await localMigration(deployer, accounts, contracts)
          return true
        case 'rinkeby':
        case 'kovan':
          await testnetMigration(deployer, accounts, contracts)
          return true
        default:
          console.log(
            `unsupported network: ${network}, default deployment will skip`
          )
          return true
      }
    })
    .catch(err => {
      // eslint-disable-next-line no-console
      console.error(err)
    })
}
