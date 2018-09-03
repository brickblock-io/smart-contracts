/* eslint-disable no-console */
const logger = require('../../scripts/lib/logger')
const chalk = require('chalk')
const deployedContracts = require('../../config/deployed-contracts')
const { unixTimeWithOffsetInSec } = require('./general')
const truffleConfig = require('../../truffle')
const argv = require('../helpers/arguments')
const gasAmountForPoa = 6612388

const isDeployOnly = contractName => {
  const deployOnly = argv.deployOnly

  return (
    (Array.isArray(deployOnly) && deployOnly.includes(contractName)) ||
    !deployOnly
  )
}

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

  console.log(chalk.cyan('\n-------------------------'))
  console.log(chalk.cyan('\n🚀  Deploying contracts…'))

  const defaultParams = [
    network,
    deployer,
    { from: owner },
    useExistingContracts
  ]

  /*
   * Registry needs to be deployed first because all other contracts depend on it
   */

  const instances = {}

  instances.ContractRegistry = await conditionalDeploy(
    'ContractRegistry',
    ContractRegistryABI,
    null,
    ...defaultParams
  )

  instances.AccessToken = await conditionalDeploy(
    'AccessToken',
    AccessTokenABI,
    [instances.ContractRegistry.address],
    ...defaultParams
  )

  const releaseTime = unixTimeWithOffsetInSec(60 * 60 * 24 * 365 * 2) // 2 years in seconds

  instances.BrickblockAccount = await conditionalDeploy(
    'BrickblockAccount',
    BrickblockAccountABI,
    [instances.ContractRegistry.address, releaseTime],
    ...defaultParams
  )

  instances.BrickblockToken = await conditionalDeploy(
    'BrickblockToken',
    BrickblockTokenABI,
    [bonusAddress],
    ...defaultParams
  )

  instances.PoaLogger = await conditionalDeploy(
    'PoaLogger',
    PoaLoggerABI,
    [instances.ContractRegistry.address],
    ...defaultParams
  )

  if (useExpStub) {
    logger.info(chalk.magenta('using stub'))
    instances.ExchangeRateProvider = await conditionalDeploy(
      'PoaLogger',
      ExchangeRateProviderStubABI,
      [instances.ContractRegistry.address],
      ...defaultParams
    )
  } else {
    instances.ExchangeRateProvider = await conditionalDeploy(
      'PoaLogger',
      ExchangeRateProviderABI,
      [instances.ContractRegistry.address],
      ...defaultParams
    )
  }

  instances.ExchangeRates = await conditionalDeploy(
    'ExchangeRates',
    ExchangeRatesABI,
    [instances.ContractRegistry.address],
    ...defaultParams
  )

  instances.FeeManager = await conditionalDeploy(
    'FeeManager',
    FeeManagerABI,
    [instances.ContractRegistry.address],
    ...defaultParams
  )

  instances.PoaCrowdsaleMaster = await conditionalDeploy(
    'PoaCrowdsaleMaster',
    PoaCrowdsaleMasterABI,
    null,
    ...defaultParams
  )

  instances.PoaTokenMaster = await conditionalDeploy(
    'PoaTokenMaster',
    PoaTokenMasterABI,
    null,
    network,
    deployer,
    { from: owner, gas: gasAmountForPoa },
    useExistingContracts
  )

  instances.PoaManager = await conditionalDeploy(
    'PoaManager',
    PoaManagerABI,
    [instances.ContractRegistry.address],
    ...defaultParams
  )

  instances.Whitelist = await conditionalDeploy(
    'Whitelist',
    WhitelistABI,
    null,
    ...defaultParams
  )

  logger.info(chalk.green('\n✅  Successfully deployed all contracts'))
  logger.info(chalk.green('----------------------------------------\n\n'))

  if (network.search('dev') > -1) {
    printAddressesForEnv(instances)
  } else {
    printAddressesForJson(instances)
  }

  return instances
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
  if (isDeployOnly(contractName)) {
    contractInstance = await deployContract(
      contractName,
      contractAbi,
      contractParams,
      deployer,
      config
    )
  } else if (useExistingContracts) {
    const contractAddress = getDeployedContractAddress(contractName, network)

    if (contractAddress) {
      contractInstance = contractAbi.at(contractAddress)

      console.log(
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
  }

  return contractInstance
}

const getDeployedContractAddress = (contractName, networkName) => {
  const envFileContractName = toUnderscoreCapitalCase(contractName)
  const envContractAddress = process.env[envFileContractName]

  if (envContractAddress) {
    console.log(
      chalk.yellow(`\n⚠️   Fetching ${contractName} address from .env file`)
    )
    return envContractAddress
  }

  const networkConfig = truffleConfig.networks[networkName]

  if (typeof networkConfig === 'undefined') {
    return false
  }

  const address = deployedContracts[networkConfig.network_id][contractName]

  return address || false
}

const deployContract = async (
  contractName,
  contractAbi,
  contractParams,
  deployer,
  config
) => {
  console.log(chalk.yellow(`\n➡️   Deploying ${contractName}...`))
  if (contractParams) {
    await deployer.deploy(contractAbi, ...contractParams, config)
  } else {
    await deployer.deploy(contractAbi, config)
  }

  return await contractAbi.deployed()
}

const printAddressesForEnv = contracts => {
  let str = '\n'
  str += chalk.yellow('Contract addresses for .env file') + '\n'
  Object.keys(contracts).forEach(contractName => {
    const contract = contracts[contractName]
    if (contract) {
      str += `${chalk.cyan(toUnderscoreCapitalCase(contractName))}=${
        contract.address
      }\n`
    }
  })

  console.log(str)
}

const printAddressesForJson = contracts => {
  let str = '\n'
  str +=
    chalk.yellow('Contract addresses for config/deployed-contracts.js file') +
    '\n'
  Object.keys(contracts).forEach(contractName => {
    const contract = contracts[contractName]
    if (contract) {
      str += `${chalk.cyan(contractName)}: ${contract.address}\n`
    }
  })

  console.log(str)
}

const toUnderscoreCapitalCase = value => {
  return value
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([0-9])([^0-9])/g, '$1-$2')
    .replace(/([^0-9])([0-9])/g, '$1-$2')
    .replace(/-+/g, '_')
    .toUpperCase()
}

module.exports = {
  unixTimeWithOffsetInSec,
  deployContracts,
  deployContract
}
