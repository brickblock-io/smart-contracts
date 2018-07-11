/* eslint-disable no-console */
const chalk = require('chalk')

let web3

const setWeb3 = _web3 => (web3 = _web3)

// given an offset in second, returns seconds since unix epoch
const unixTimeWithOffset = offset => Math.floor(Date.now() / 1000) + offset
const gasAmountForPoa = 6612388

const deployContracts = async (
  deployer,
  accounts,
  contracts,
  { useExpStub = true } = {}
) => {
  const {
    AccessToken,
    BrickblockAccount,
    ContractRegistry,
    BrickblockToken,
    ExchangeRates,
    FeeManager,
    CentralLogger,
    PoaManager,
    PoaTokenMaster,
    PoaCrowdsaleMaster,
    Whitelist,
    ExchangeRateProvider,
    ExchangeRateProviderStub
  } = contracts
  const owner = accounts[0]
  const bonusAddress = accounts[1]

  const ownerPreEtherBalance = await getEtherBalance(owner)

  console.log(chalk.yellow('deploying ContractRegistry...'))
  //ContractRegistry
  await deployer.deploy(ContractRegistry, {
    from: owner
  })
  const reg = await ContractRegistry.deployed()
  console.log(chalk.cyan('deployment successful!'))

  console.log(chalk.yellow('deploying BrickblockToken...'))
  //BrickblockToken
  await deployer.deploy(BrickblockToken, bonusAddress, {
    from: owner
  })
  const bbk = await BrickblockToken.deployed()
  console.log(chalk.cyan('deployment successful!'))

  console.log(chalk.yellow('deploying AccessToken...'))
  //AccessToken
  await deployer.deploy(AccessToken, reg.address, {
    from: owner
  })
  const act = await AccessToken.deployed()
  console.log(chalk.cyan('deployment successful!'))

  console.log(chalk.yellow('deploying BrickblockAccount...'))
  //BrickblockAccount
  const releaseTime = unixTimeWithOffset(60 * 60 * 24 * 365 * 2) // 2 years in seconds
  await deployer.deploy(BrickblockAccount, reg.address, releaseTime, {
    from: owner
  })
  const bat = await BrickblockAccount.deployed()
  console.log(chalk.cyan('deployment successful!'))

  console.log(chalk.yellow('deploying FeeManager...'))
  //FeeManager
  await deployer.deploy(FeeManager, reg.address, {
    from: owner
  })
  const fmr = await FeeManager.deployed()
  console.log(chalk.cyan('deployment successful!'))

  console.log(chalk.yellow('deploying Whitelist...'))
  //WhiteList
  await deployer.deploy(Whitelist, {
    from: owner
  })
  const wht = await FeeManager.deployed()
  console.log(chalk.cyan('deployment successful!'))

  console.log(chalk.yellow('deploying PoaManager...'))
  // PoaManager
  await deployer.deploy(PoaManager, reg.address, {
    from: owner
  })
  const pmr = await PoaManager.deployed()
  console.log(chalk.cyan('deployment successful!'))

  console.log(chalk.yellow('deploying ExchangeRates...'))
  // ExchangeRates
  await deployer.deploy(ExchangeRates, reg.address, {
    from: owner
  })
  const exr = await ExchangeRates.deployed()
  console.log(chalk.cyan('deployment successful!'))

  console.log(chalk.yellow('deploying ExchangeRateProvider...'))
  // ExchangeRateProvider
  let exp
  if (useExpStub) {
    console.log(chalk.red('using stub'))
    await deployer.deploy(ExchangeRateProviderStub, reg.address, {
      from: owner
    })
    exp = await ExchangeRateProviderStub.deployed()
  } else {
    await deployer.deploy(ExchangeRateProvider, reg.address, {
      from: owner
    })
    exp = await ExchangeRateProvider.deployed()
  }

  console.log(chalk.cyan('deployment successful!'))

  console.log(chalk.yellow('deploying PoaTokenMaster...'))
  // PoaToken master
  const poaTokenMaster = await deployer.deploy(PoaTokenMaster, {
    gas: gasAmountForPoa
  })
  console.log(chalk.cyan('deployment successful!'))

  console.log(chalk.yellow('deploying PoaCrowdsale Master...'))
  // PoaCrowdsale master
  const poaCrowdsaleMaster = await deployer.deploy(PoaCrowdsaleMaster)
  console.log(chalk.cyan('deployment successful!'))

  console.log(chalk.yellow('deploying CentralLogger...'))
  // CentralLogger
  await deployer.deploy(CentralLogger, reg.address, {
    from: owner
  })
  const log = await CentralLogger.deployed()
  console.log(chalk.cyan('deployment successful!'))

  const ownerPostEtherBalance = await getEtherBalance(owner)

  const gasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)

  return {
    contracts: {
      reg,
      bbk,
      act,
      bat,
      fmr,
      wht,
      pmr,
      exr,
      exp,
      poaTokenMaster,
      poaCrowdsaleMaster,
      log
    },
    gasCost
  }
}

const addContractsToRegistry = async config => {
  console.log(chalk.yellow('deploying adding contracts to ContractRegistry...'))

  const {
    act, // AccessToken
    bat, // BrickbloackAccount
    bbk, // BrickblockToken
    exp, // ExchangeRateProvider
    exr, // ExchangeRates
    fmr, // FeeManager
    log, // Logger
    pmr, // PoaManager
    poaTokenMaster,
    poaCrowdsaleMaster,
    reg, // ContractRegistry
    wht // Whitelist
  } = config.contracts
  const { owner } = config
  const ownerPreEtherBalance = await getEtherBalance(owner)

  console.log('Registering BricblockToken')
  await reg.updateContractAddress('BrickblockToken', bbk.address, {
    from: owner
  })
  console.log('Succesful!')
  console.log('Registering AccessToken')
  await reg.updateContractAddress('AccessToken', act.address, {
    from: owner
  })
  console.log('Registering ExchangeRates')
  await reg.updateContractAddress('ExchangeRates', exr.address, {
    from: owner
  })
  console.log('Succesful!')
  console.log('Registering ExchangeRateProvider')
  await reg.updateContractAddress('ExchangeRateProvider', exp.address, {
    from: owner
  })
  console.log('Succesful!')
  console.log('Registering FeeManager')
  await reg.updateContractAddress('FeeManager', fmr.address, {
    from: owner
  })
  console.log('Succesful!')
  console.log('Registering BrickblockAccount')
  await reg.updateContractAddress('BrickblockAccount', bat.address, {
    from: owner
  })
  console.log('Succesful!')
  console.log('Registering Whitelist')
  await reg.updateContractAddress('Whitelist', wht.address, {
    from: owner
  })
  console.log('Succesful!')
  console.log('Registering PoaManager')
  await reg.updateContractAddress('PoaManager', pmr.address, {
    from: owner
  })
  console.log('Succesful!')
  console.log('Registering PoaTokenMaster')
  await reg.updateContractAddress('PoaTokenMaster', poaTokenMaster.address, {
    from: owner
  })
  console.log('Succesful!')
  console.log('Registering PoaCrowdsaleMaster')
  await reg.updateContractAddress(
    'PoaCrowdsaleMaster',
    poaCrowdsaleMaster.address,
    {
      from: owner
    }
  )
  console.log('Succesful!')
  console.log('Registering PoaCrowdsaleMaster')
  await reg.updateContractAddress('Logger', log.address, {
    from: owner
  })
  console.log('Succesful!')
  const ownerPostEtherBalance = await getEtherBalance(owner)

  const gasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)
  console.log(chalk.cyan('registry update successful!'))

  return { gasCost }
}

const setFiatRate = async (exr, exp, queryType, rate, useStub, config) => {
  await exr.setCurrencySettings(
    queryType,
    'https://min-api.cryptocompare.com/data/price?fsym=ETH',
    30,
    1.5e5,
    {
      from: config.from
    }
  )
  await exr.fetchRate(queryType, config)
  if (useStub) {
    const pendingQueryId = await exp.pendingTestQueryId()
    await exp.simulate__callback(pendingQueryId, '50000', {
      from: config.from
    })
  }
}

const getEtherBalance = address => {
  return new Promise((resolve, reject) => {
    web3.eth.getBalance(address, (err, res) => {
      if (err) reject(err)

      resolve(res)
    })
  })
}

module.exports = {
  setWeb3,
  deployContracts,
  addContractsToRegistry,
  setFiatRate,
  getEtherBalance
}
