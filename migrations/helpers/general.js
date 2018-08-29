/* eslint-disable no-console */
const logger = require('../../scripts/lib/logger')
const chalk = require('chalk')
const truffleConfig = require('../../truffle')
const deployedContracts = require('../../config/deployed-contracts')

let web3

const setWeb3 = _web3 => (web3 = _web3)

// given an offset in second, returns seconds since unix epoch
const unixTimeWithOffsetInSec = (offset = 0) =>
  Math.floor(Date.now() / 1000) + offset
const gasAmountForPoa = 6612388

const deployContracts = async (
  deployer,
  accounts,
  contracts,
  { useExpStub = true, useExistingContracts, network } = {}
) => {
  const {
    AccessToken: AccessTokenABI,
    BrickblockAccount: BrickblockAccountABI,
    ContractRegistry: ContractRegistryABI,
    BrickblockToken: BrickblockTokenABI,
    ExchangeRates: ExchangeRatesABI,
    FeeManager: FeeManagerABI,
    PoaLogger: PoaLoggerABI,
    PoaManager: PoaManagerABI,
    PoaTokenMaster: PoaTokenMasterABI,
    PoaCrowdsaleMaster: PoaCrowdsaleMasterABI,
    Whitelist: WhitelistABI,
    ExchangeRateProvider: ExchangeRateProviderABI,
    ExchangeRateProviderStub: ExchangeRateProviderStubABI
  } = contracts
  const owner = accounts[0]
  const bonusAddress = accounts[1]

  logger.info(chalk.cyan('\n-------------------------'))
  logger.info(chalk.cyan('🚀  Deploying contracts…'))

  const defaultParams = [
    network,
    deployer,
    { from: owner },
    useExistingContracts
  ]

  /*
   * Registry needs to be deployed first because all other contracts depend on it
   */

  const ContractRegistry = await conditionalDeploy(
    'ContractRegistry',
    ContractRegistryABI,
    null,
    ...defaultParams
  )

  const AccessToken = await conditionalDeploy(
    'AccessToken',
    AccessTokenABI,
    [ContractRegistry.address],
    ...defaultParams
  )

  const releaseTime = unixTimeWithOffsetInSec(60 * 60 * 24 * 365 * 2) // 2 years in seconds
  const BrickblockAccount = await conditionalDeploy(
    'BrickblockAccount',
    BrickblockAccountABI,
    [ContractRegistry.address, releaseTime],
    ...defaultParams
  )

  const BrickblockToken = await conditionalDeploy(
    'BrickblockToken',
    BrickblockTokenABI,
    [bonusAddress],
    ...defaultParams
  )

  const PoaLogger = await conditionalDeploy(
    'PoaLogger',
    PoaLoggerABI,
    [ContractRegistry.address],
    ...defaultParams
  )

  let ExchangeRateProvider
  if (useExpStub) {
    logger.info(chalk.magenta('using stub'))
    ExchangeRateProvider = await conditionalDeploy(
      'PoaLogger',
      ExchangeRateProviderStubABI,
      [ContractRegistry.address],
      ...defaultParams
    )
  } else {
    ExchangeRateProvider = await conditionalDeploy(
      'PoaLogger',
      ExchangeRateProviderABI,
      [ContractRegistry.address],
      ...defaultParams
    )
  }

  const ExchangeRates = await conditionalDeploy(
    'ExchangeRates',
    ExchangeRatesABI,
    [ContractRegistry.address],
    ...defaultParams
  )

  const FeeManager = await conditionalDeploy(
    'FeeManager',
    FeeManagerABI,
    [ContractRegistry.address],
    ...defaultParams
  )

  const PoaCrowdsaleMaster = await conditionalDeploy(
    'PoaCrowdsaleMaster',
    PoaCrowdsaleMasterABI,
    null,
    ...defaultParams
  )

  const PoaTokenMaster = await conditionalDeploy(
    'PoaTokenMaster',
    PoaTokenMasterABI,
    null,
    network,
    deployer,
    { from: owner, gas: gasAmountForPoa },
    useExistingContracts
  )

  const PoaManager = await conditionalDeploy(
    'PoaManager',
    PoaManagerABI,
    [ContractRegistry.address],
    ...defaultParams
  )

  const Whitelist = await conditionalDeploy(
    'Whitelist',
    WhitelistABI,
    null,
    ...defaultParams
  )

  logger.info(chalk.green('\n✅  Successfully deployed all contracts'))
  logger.info(chalk.green('----------------------------------------\n\n'))

  return {
    AccessToken,
    BrickblockAccount,
    BrickblockToken,
    PoaLogger,
    ContractRegistry,
    ExchangeRateProvider,
    ExchangeRates,
    FeeManager,
    PoaManager,
    PoaCrowdsaleMaster,
    PoaTokenMaster,
    Whitelist
  }
}

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

const getDefaultGasPrice = networkName => {
  const networkProperties = truffleConfig.networks[networkName]

  return networkProperties.gasPrice
}

const calculateUsedGasFromCost = (networkName, totalcost) => {
  const gasPrice = getDefaultGasPrice(networkName)

  return totalcost.div(gasPrice)
}

const getDeployedContractAddress = (contractName, networkName) => {
  const networkConfig = truffleConfig.networks[networkName]

  if (typeof networkConfig === 'undefined') {
    return false
  }

  const address = deployedContracts[networkConfig.network_id][contractName]

  return address || false
}

const conditionalDeploy = async (
  contractName,
  contractAbi,
  contractParams,
  network,
  deployer,
  config,
  useExistingContracts
) => {
  let contractInstance

  if (useExistingContracts) {
    const contractAddress = getDeployedContractAddress(contractName, network)

    if (contractAddress) {
      contractInstance = contractAbi.at(contractAddress)

      logger.info(
        chalk.yellow(
          `\n➡️   Using current '${contractName}' at ${contractAddress}`
        )
      )
    } else {
      contractInstance = await deployContract(
        contractName,
        contractAbi,
        contractParams,
        deployer,
        config
      )
    }
  } else {
    contractInstance = await deployContract(
      contractName,
      contractAbi,
      contractParams,
      deployer,
      config
    )
  }

  return contractInstance
}

const deployContract = async (
  contractName,
  contractAbi,
  contractParams,
  deployer,
  config
) => {
  logger.info(chalk.yellow(`\n➡️   Deploying ${contractName}...`))
  if (contractParams) {
    await deployer.deploy(contractAbi, ...contractParams, config)
  } else {
    await deployer.deploy(contractAbi, config)
  }

  return await contractAbi.deployed()
}

module.exports = {
  setWeb3,
  deployContracts,
  addContractsToRegistry,
  getEtherBalance,
  unixTimeWithOffsetInSec,
  getDefaultGasPrice,
  calculateUsedGasFromCost
}
