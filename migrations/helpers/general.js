/* eslint-disable no-console */
const logger = require('../../scripts/lib/logger')
const chalk = require('chalk')
const truffleConfig = require('../../truffle')

let web3

const setWeb3 = _web3 => (web3 = _web3)

// given an offset in second, returns seconds since unix epoch
const unixTimeWithOffsetInSec = (offset = 0) =>
  Math.floor(Date.now() / 1000) + offset

const addContractsToRegistry = async (
  contracts = {},
  txConfig = { from: null, gas: null }
) => {
  logger.info(chalk.cyan('\n-----------------------------------------'))
  logger.info(chalk.cyan('🚀  Adding contracts to ContractRegistry…'))

  const {
    AccessToken,
    BrickblockAccount,
    BrickblockToken,
    PoaLogger,
    ContractRegistry,
    ExchangeRateProvider,
    ExchangeRates,
    FeeManager,
    PoaManager,
    PoaTokenMaster,
    PoaCrowdsaleMaster,
    Whitelist
  } = contracts

  logger.info(chalk.yellow('\n➡️   Registering AccessToken…'))
  await ContractRegistry.updateContractAddress(
    'AccessToken',
    AccessToken.address,
    txConfig
  )

  logger.info(chalk.yellow('\n➡️   Registering BrickblockAccount…'))
  await ContractRegistry.updateContractAddress(
    'BrickblockAccount',
    BrickblockAccount.address,
    txConfig
  )

  logger.info(chalk.yellow('\n➡️   Registering BrickblockToken…'))
  await ContractRegistry.updateContractAddress(
    'BrickblockToken',
    BrickblockToken.address,
    txConfig
  )

  logger.info(chalk.yellow('\n➡️   Registering PoaLogger…'))
  await ContractRegistry.updateContractAddress(
    'PoaLogger',
    PoaLogger.address,
    txConfig
  )

  logger.info(chalk.yellow('\n➡️   Registering ExchangeRates…'))
  await ContractRegistry.updateContractAddress(
    'ExchangeRates',
    ExchangeRates.address,
    txConfig
  )

  logger.info(chalk.yellow('\n➡️   Registering ExchangeRateProvider…'))
  await ContractRegistry.updateContractAddress(
    'ExchangeRateProvider',
    ExchangeRateProvider.address,
    txConfig
  )

  logger.info(chalk.yellow('\n➡️   Registering FeeManager…'))
  await ContractRegistry.updateContractAddress(
    'FeeManager',
    FeeManager.address,
    txConfig
  )

  logger.info(chalk.yellow('\n➡️   Registering PoaManager…'))
  await ContractRegistry.updateContractAddress(
    'PoaManager',
    PoaManager.address,
    txConfig
  )

  logger.info(chalk.yellow('\n➡️   Registering PoaCrowdsaleMaster…'))
  await ContractRegistry.updateContractAddress(
    'PoaCrowdsaleMaster',
    PoaCrowdsaleMaster.address,
    txConfig
  )

  logger.info(chalk.yellow('\n➡️   Registering PoaTokenMaster…'))
  await ContractRegistry.updateContractAddress(
    'PoaTokenMaster',
    PoaTokenMaster.address,
    txConfig
  )

  logger.info(chalk.yellow('\n➡️   Registering Whitelist…'))
  await ContractRegistry.updateContractAddress(
    'Whitelist',
    Whitelist.address,
    txConfig
  )

  logger.info(chalk.green('\n✅  Successfully updated ContractRegistry'))
  logger.info(chalk.green('------------------------------------------\n\n'))
}

const getEtherBalance = address => {
  return new Promise((resolve, reject) => {
    web3.eth.getBalance(address, (err, res) => {
      if (err) reject(err)

      resolve(res)
    })
  })
}

const sendTransaction = args => {
  return new Promise(function(resolve, reject) {
    web3.eth.sendTransaction(args, (err, res) => {
      if (err) {
        reject(err)
      } else {
        resolve(res)
      }
    })
  })
}

const getDefaultGasPrice = networkName => {
  const networkProperties = truffleConfig.networks[networkName]

  return networkProperties.gasPrice
}

const calculateUsedGasFromCost = (networkName, totalcost) => {
  const gasPrice = getDefaultGasPrice(networkName)

  return totalcost.div(gasPrice)
}

module.exports = {
  setWeb3,
  addContractsToRegistry,
  getEtherBalance,
  unixTimeWithOffsetInSec,
  getDefaultGasPrice,
  calculateUsedGasFromCost,
  sendTransaction
}
