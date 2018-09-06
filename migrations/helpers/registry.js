const logger = require('../../scripts/lib/logger')
const chalk = require('chalk')

const addContractsToRegistry = async (
  contracts = {},
  txConfig = { from: null, gas: null }
) => {
  logger.info(chalk.cyan('\n-----------------------------------------'))
  logger.info(chalk.cyan('\n🚀  Adding contracts to ContractRegistry…'))

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

  await conditionalRegister(
    ContractRegistry,
    'AccessToken',
    AccessToken.address,
    txConfig
  )

  await conditionalRegister(
    ContractRegistry,
    'BrickblockAccount',
    BrickblockAccount.address,
    txConfig
  )

  await conditionalRegister(
    ContractRegistry,
    'BrickblockToken',
    BrickblockToken.address,
    txConfig
  )

  await conditionalRegister(
    ContractRegistry,
    'PoaLogger',
    PoaLogger.address,
    txConfig
  )

  await conditionalRegister(
    ContractRegistry,
    'ExchangeRates',
    ExchangeRates.address,
    txConfig
  )

  await conditionalRegister(
    ContractRegistry,
    'ExchangeRateProvider',
    ExchangeRateProvider.address,
    txConfig
  )

  await conditionalRegister(
    ContractRegistry,
    'FeeManager',
    FeeManager.address,
    txConfig
  )

  await conditionalRegister(
    ContractRegistry,
    'PoaManager',
    PoaManager.address,
    txConfig
  )

  await conditionalRegister(
    ContractRegistry,
    'PoaCrowdsaleMaster',
    PoaCrowdsaleMaster.address,
    txConfig
  )

  await conditionalRegister(
    ContractRegistry,
    'PoaTokenMaster',
    PoaTokenMaster.address,
    txConfig
  )

  await conditionalRegister(
    ContractRegistry,
    'Whitelist',
    Whitelist.address,
    txConfig
  )

  logger.info(chalk.green('\n✅  Successfully updated ContractRegistry'))
  logger.info(chalk.green('------------------------------------------\n\n'))
}

const conditionalRegister = async (
  ContractRegistry,
  contractName,
  contractAddress,
  txConfig
) => {
  let currentAddress
  try {
    currentAddress = await ContractRegistry.getContractAddress(
      contractName,
      txConfig
    )
  } catch (error) {
    logger.info(chalk.gray(`${contractName} is not available in the registry`))
  }

  if (contractAddress === currentAddress) {
    logger.info(
      chalk.gray(
        `\n➡️   ${contractName} address is identical with address in the registry. skipping...`
      )
    )
    return
  }

  logger.info(chalk.yellow(`\n➡️   Registering ${contractName}…`))
  await ContractRegistry.updateContractAddress(
    contractName,
    contractAddress,
    txConfig
  )
}

module.exports = {
  addContractsToRegistry
}
