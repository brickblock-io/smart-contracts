/* eslint-disable no-console */
const logger = require('../../scripts/lib/logger')
const chalk = require('chalk')
const deployedContracts = require('../../config/deployed-contracts')
const { unixTimeWithOffsetInSec } = require('./general')
const truffleConfig = require('../../truffle')
const { argv } = require('../helpers/arguments')
const gasAmountForPoa = 6612388

const isForceDeploy = contractName => {
  const forceDeploy = argv.forceDeploy

  return (
    Array.isArray(argv.forceDeploy) &&
    (forceDeploy.includes(contractName) || forceDeploy.includes('all'))
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
    useExistingContracts,
    ContractRegistryABI
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
    logger.warn(chalk.magenta('using stub for Exchange Rate Provider'))
    instances.ExchangeRateProvider = await conditionalDeploy(
      'ExchangeRateProvider',
      ExchangeRateProviderStubABI,
      [instances.ContractRegistry.address],
      ...defaultParams
    )
  } else {
    instances.ExchangeRateProvider = await conditionalDeploy(
      'ExchangeRateProvider',
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
    useExistingContracts,
    ContractRegistryABI
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
  useExistingContracts,
  ContractRegistryABI
) => {
  // --forceDeploy is high priority and overrides --useExistingContract param
  if (isForceDeploy(contractName)) {
    console.log(contractName, 'forcedeploy')
    return await deployContract(
      contractName,
      contractAbi,
      contractParams,
      deployer,
      config
    )
  }

  if (useExistingContracts) {
    let contractAddress
    if (contractName === 'ContractRegistry') {
      contractAddress = await getDeployedContractAddressFromFile(
        contractName,
        network
      )
    } else {
      // If the contract is not 'Contract Registry', find the Contract Registry first
      const contractRegistryAddress = await getDeployedContractAddressFromFile(
        'ContractRegistry',
        network
      )
      const contractRegistry = ContractRegistryABI.at(contractRegistryAddress)

      // Get the address from Contract Registry
      try {
        contractAddress = await contractRegistry.getContractAddress(
          contractName
        )
      } catch (ex) {
        logger.info(
          `${contractName} not found in the registry. Will try to fetch from file`
        )
        contractAddress = await getDeployedContractAddressFromFile(
          contractName,
          network
        )
      }
    }

    if (contractAddress) {
      console.log(
        chalk.yellow(
          `\n➡️   Using current '${contractName}' at ${contractAddress}`
        )
      )

      return contractAbi.at(contractAddress)
    }

    // If it doesn't exist, deploy a new one
    logger.warn(
      `${contractName} failed to fetch address from many sources. Deploying a new one.`
    )
    const contractInstance = await deployContract(
      contractName,
      contractAbi,
      contractParams,
      deployer,
      config
    )

    if (contractName === 'ContractRegistry') {
      process.env.CONTRACT_REGISTRY = contractInstance.address
    }

    return contractInstance
  }
}

const getDeployedContractAddressFromFile = (contractName, networkName) => {
  // Use .env only for local testnet
  if (networkName.search('dev') > -1) {
    const envFileContractName = toUnderscoreCapitalCase(contractName)
    const envContractAddress = process.env[envFileContractName]

    if (envContractAddress) {
      return envContractAddress
    }
  }

  const networkConfig = truffleConfig.networks[networkName]

  if (typeof networkConfig === 'undefined') {
    return false
  }

  if (typeof deployedContracts[networkConfig.network_id] === 'undefined') {
    return false
  }

  const address = deployedContracts[networkConfig.network_id][contractName]
  logger.debug(`address found for ${contractName} at ${address}`)
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
  console.log(config)
  if (contractParams) {
    await deployer.deploy.apply(deployer, [
      contractAbi,
      ...contractParams,
      config
    ])
  } else {
    await deployer.deploy.apply(deployer, [contractAbi, config])
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
      str += `${chalk.cyan(contractName)}: '${contract.address}',\n`
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
