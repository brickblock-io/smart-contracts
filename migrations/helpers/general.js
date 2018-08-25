/* eslint-disable no-console */
const chalk = require('chalk')
const truffleConfig = require('../../truffle')

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
  { useExpStub = true } = {}
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
  console.log(chalk.cyan('🚀  Deploying contracts…'))

  /*
   * Registry needs to be deployed first because all other contracts depend on it
   */
  console.log(chalk.yellow('\n➡️   Deploying ContractRegistry…'))
  await deployer.deploy(ContractRegistryABI, {
    from: owner
  })
  const ContractRegistry = await ContractRegistryABI.deployed()

  console.log(chalk.yellow('\n➡️   Deploying AccessToken…'))
  await deployer.deploy(AccessTokenABI, ContractRegistry.address, {
    from: owner
  })
  const AccessToken = await AccessTokenABI.deployed()

  console.log(chalk.yellow('\n➡️   Deploying BrickblockAccount…'))
  const releaseTime = unixTimeWithOffsetInSec(60 * 60 * 24 * 365 * 2) // 2 years in seconds
  await deployer.deploy(
    BrickblockAccountABI,
    ContractRegistry.address,
    releaseTime,
    {
      from: owner
    }
  )
  const BrickblockAccount = await BrickblockAccountABI.deployed()

  console.log(chalk.yellow('\n➡️   Deploying BrickblockToken…'))
  await deployer.deploy(BrickblockTokenABI, bonusAddress, {
    from: owner
  })
  const BrickblockToken = await BrickblockTokenABI.deployed()

  console.log(chalk.yellow('\n➡️   Deploying PoaLogger…'))
  await deployer.deploy(PoaLoggerABI, ContractRegistry.address, {
    from: owner
  })
  const PoaLogger = await PoaLoggerABI.deployed()

  console.log(chalk.yellow('\n➡️   Deploying ExchangeRateProvider…'))
  let ExchangeRateProvider
  if (useExpStub) {
    console.log(chalk.magenta('using stub'))
    await deployer.deploy(
      ExchangeRateProviderStubABI,
      ContractRegistry.address,
      {
        from: owner
      }
    )
    ExchangeRateProvider = await ExchangeRateProviderStubABI.deployed()
  } else {
    await deployer.deploy(ExchangeRateProviderABI, ContractRegistry.address, {
      from: owner
    })
    ExchangeRateProvider = await ExchangeRateProviderABI.deployed()
  }

  console.log(chalk.yellow('\n➡️   Deploying ExchangeRates…'))
  await deployer.deploy(ExchangeRatesABI, ContractRegistry.address, {
    from: owner
  })
  const ExchangeRates = await ExchangeRatesABI.deployed()

  console.log(chalk.yellow('\n➡️   Deploying FeeManager…'))
  await deployer.deploy(FeeManagerABI, ContractRegistry.address, {
    from: owner
  })
  const FeeManager = await FeeManagerABI.deployed()

  console.log(chalk.yellow('\n➡️   Deploying PoaCrowdsale Master…'))
  const PoaCrowdsaleMaster = await deployer.deploy(PoaCrowdsaleMasterABI)

  console.log(chalk.yellow('\n➡️   Deploying PoaManager…'))
  await deployer.deploy(PoaManagerABI, ContractRegistry.address, {
    from: owner
  })
  const PoaManager = await PoaManagerABI.deployed()

  console.log(chalk.yellow('\n➡️   Deploying PoaTokenMaster…'))
  const PoaTokenMaster = await deployer.deploy(PoaTokenMasterABI, {
    gas: gasAmountForPoa
  })

  console.log(chalk.yellow('\n➡️   Deploying Whitelist…'))
  await deployer.deploy(WhitelistABI, {
    from: owner
  })
  const Whitelist = await WhitelistABI.deployed()

  console.log(chalk.green('\n✅  Successfully deployed all contracts'))
  console.log(chalk.green('----------------------------------------\n\n'))

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
  console.log(chalk.cyan('\n-----------------------------------------'))
  console.log(chalk.cyan('🚀  Adding contracts to ContractRegistry…'))

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

  console.log(chalk.yellow('\n➡️   Registering AccessToken…'))
  await ContractRegistry.updateContractAddress(
    'AccessToken',
    AccessToken.address,
    txConfig
  )

  console.log(chalk.yellow('\n➡️   Registering BrickblockAccount…'))
  await ContractRegistry.updateContractAddress(
    'BrickblockAccount',
    BrickblockAccount.address,
    txConfig
  )

  console.log(chalk.yellow('\n➡️   Registering BrickblockToken…'))
  await ContractRegistry.updateContractAddress(
    'BrickblockToken',
    BrickblockToken.address,
    txConfig
  )

  console.log(chalk.yellow('\n➡️   Registering PoaLogger…'))
  await ContractRegistry.updateContractAddress(
    'PoaLogger',
    PoaLogger.address,
    txConfig
  )

  console.log(chalk.yellow('\n➡️   Registering ExchangeRates…'))
  await ContractRegistry.updateContractAddress(
    'ExchangeRates',
    ExchangeRates.address,
    txConfig
  )

  console.log(chalk.yellow('\n➡️   Registering ExchangeRateProvider…'))
  await ContractRegistry.updateContractAddress(
    'ExchangeRateProvider',
    ExchangeRateProvider.address,
    txConfig
  )

  console.log(chalk.yellow('\n➡️   Registering FeeManager…'))
  await ContractRegistry.updateContractAddress(
    'FeeManager',
    FeeManager.address,
    txConfig
  )

  console.log(chalk.yellow('\n➡️   Registering PoaManager…'))
  await ContractRegistry.updateContractAddress(
    'PoaManager',
    PoaManager.address,
    txConfig
  )

  console.log(chalk.yellow('\n➡️   Registering PoaCrowdsaleMaster…'))
  await ContractRegistry.updateContractAddress(
    'PoaCrowdsaleMaster',
    PoaCrowdsaleMaster.address,
    txConfig
  )

  console.log(chalk.yellow('\n➡️   Registering PoaTokenMaster…'))
  await ContractRegistry.updateContractAddress(
    'PoaTokenMaster',
    PoaTokenMaster.address,
    txConfig
  )

  console.log(chalk.yellow('\n➡️   Registering Whitelist…'))
  await ContractRegistry.updateContractAddress(
    'Whitelist',
    Whitelist.address,
    txConfig
  )

  console.log(chalk.green('\n✅  Successfully updated ContractRegistry'))
  console.log(chalk.green('------------------------------------------\n\n'))
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

module.exports = {
  setWeb3,
  deployContracts,
  addContractsToRegistry,
  getEtherBalance,
  unixTimeWithOffsetInSec,
  getDefaultGasPrice,
  calculateUsedGasFromCost
}
