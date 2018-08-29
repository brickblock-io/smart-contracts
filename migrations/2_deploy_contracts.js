/* eslint-disable no-console */
const AccessToken = artifacts.require('AccessToken')
const BrickblockAccount = artifacts.require('BrickblockAccount')
const BrickblockToken = artifacts.require('BrickblockToken')
const ContractRegistry = artifacts.require('ContractRegistry')
const ExchangeRateProvider = artifacts.require('ExchangeRateProvider')
const ExchangeRateProviderStub = artifacts.require(
  'stubs/ExchangeRateProviderStub'
)
const ExchangeRates = artifacts.require('ExchangeRates')
const FeeManager = artifacts.require('FeeManager')
const PoaCrowdsaleMaster = artifacts.require('PoaCrowdsale')
const PoaLogger = artifacts.require('PoaLogger')
const PoaManager = artifacts.require('PoaManager')
const PoaTokenMaster = artifacts.require('PoaToken')
const Whitelist = artifacts.require('Whitelist')

const { setWeb3 } = require('./helpers/general.js')
setWeb3(web3)

const actions = require('./actions')

// artifacts is not available in other files...
const contracts = {
  AccessToken,
  BrickblockAccount,
  BrickblockToken,
  ContractRegistry,
  ExchangeRateProvider,
  ExchangeRateProviderStub,
  ExchangeRates,
  FeeManager,
  PoaCrowdsaleMaster,
  PoaLogger,
  PoaManager,
  PoaTokenMaster,
  Whitelist
}

module.exports = (deployer, network, accounts) => {
  console.log(`deploying on ${network} network`)
  deployer
    .then(async () => {
      switch (network) {
        case 'test':
          return true
        default:
          await actions(deployer, accounts, contracts, web3, network)
          return true
      }
    })
    .catch(err => {
      // eslint-disable-next-line no-console
      console.error(err)
    })
}
