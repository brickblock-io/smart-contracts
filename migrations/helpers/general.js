/* eslint-disable no-console */
const chalk = require('chalk')

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

  console.log(chalk.yellow('\n➡️  Deploying contracts…'))

  /*
   * Registry needs to be deployed first because all other contracts depend on it
   */
  console.log(chalk.yellow('Deploying ContractRegistry…'))
  await deployer.deploy(ContractRegistry, {
    from: owner
  })
  const reg = await ContractRegistry.deployed()

  console.log(chalk.yellow('Deploying AccessToken…'))
  await deployer.deploy(AccessToken, reg.address, {
    from: owner
  })
  const act = await AccessToken.deployed()

  console.log(chalk.yellow('Deploying BrickblockAccount…'))
  const releaseTime = unixTimeWithOffsetInSec(60 * 60 * 24 * 365 * 2) // 2 years in seconds
  await deployer.deploy(BrickblockAccount, reg.address, releaseTime, {
    from: owner
  })
  const bat = await BrickblockAccount.deployed()

  console.log(chalk.yellow('Deploying BrickblockToken…'))
  await deployer.deploy(BrickblockToken, bonusAddress, {
    from: owner
  })
  const bbk = await BrickblockToken.deployed()

  console.log(chalk.yellow('Deploying CentralLogger…'))
  await deployer.deploy(CentralLogger, reg.address, {
    from: owner
  })
  const log = await CentralLogger.deployed()

  console.log(chalk.yellow('Deploying ExchangeRateProvider…'))
  let exp
  if (useExpStub) {
    console.log(chalk.magenta('using stub'))
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

  console.log(chalk.yellow('Deploying ExchangeRates…'))
  await deployer.deploy(ExchangeRates, reg.address, {
    from: owner
  })
  const exr = await ExchangeRates.deployed()

  console.log(chalk.yellow('Deploying FeeManager…'))
  await deployer.deploy(FeeManager, reg.address, {
    from: owner
  })
  const fmr = await FeeManager.deployed()

  console.log(chalk.yellow('Deploying PoaCrowdsale Master…'))
  const poaCrowdsaleMaster = await deployer.deploy(PoaCrowdsaleMaster)

  console.log(chalk.yellow('Deploying PoaManager…'))
  await deployer.deploy(PoaManager, reg.address, {
    from: owner
  })
  const pmr = await PoaManager.deployed()

  console.log(chalk.yellow('Deploying PoaTokenMaster…'))
  const poaTokenMaster = await deployer.deploy(PoaTokenMaster, {
    gas: gasAmountForPoa
  })

  console.log(chalk.yellow('Deploying Whitelist…'))
  await deployer.deploy(Whitelist, {
    from: owner
  })
  const wht = await Whitelist.deployed()

  console.log(chalk.cyan('✅  Successfully deployed all contracts\n\n'))

  const ownerPostEtherBalance = await getEtherBalance(owner)
  const gasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)

  return {
    contracts: {
      act,
      bat,
      bbk,
      exp,
      exr,
      fmr,
      log,
      pmr,
      poaCrowdsaleMaster,
      poaTokenMaster,
      reg,
      wht
    },
    gasCost
  }
}

const addContractsToRegistry = async config => {
  console.log(chalk.yellow('➡️  Adding contracts to ContractRegistry…'))

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

  console.log('Registering BrickblockToken…')
  await reg.updateContractAddress('BrickblockToken', bbk.address, {
    from: owner
  })
  console.log('Registering AccessToken…')
  await reg.updateContractAddress('AccessToken', act.address, {
    from: owner
  })
  console.log('Registering ExchangeRates…')
  await reg.updateContractAddress('ExchangeRates', exr.address, {
    from: owner
  })
  console.log('Registering ExchangeRateProvider…')
  await reg.updateContractAddress('ExchangeRateProvider', exp.address, {
    from: owner
  })
  console.log('Registering FeeManager…')
  await reg.updateContractAddress('FeeManager', fmr.address, {
    from: owner
  })
  console.log('Registering BrickblockAccount…')
  await reg.updateContractAddress('BrickblockAccount', bat.address, {
    from: owner
  })
  console.log('Registering Whitelist…')
  await reg.updateContractAddress('Whitelist', wht.address, {
    from: owner
  })
  console.log('Registering PoaManager…')
  await reg.updateContractAddress('PoaManager', pmr.address, {
    from: owner
  })
  console.log('Registering PoaTokenMaster…')
  await reg.updateContractAddress('PoaTokenMaster', poaTokenMaster.address, {
    from: owner
  })
  console.log('Registering PoaCrowdsaleMaster…')
  await reg.updateContractAddress(
    'PoaCrowdsaleMaster',
    poaCrowdsaleMaster.address,
    {
      from: owner
    }
  )
  console.log('Registering PoaCrowdsaleMaster…')
  await reg.updateContractAddress('Logger', log.address, {
    from: owner
  })
  console.log(chalk.cyan('✅  Successfully updated ContractRegistry\n\n'))

  const ownerPostEtherBalance = await getEtherBalance(owner)
  const gasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)

  return { gasCost }
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
  getEtherBalance,
  unixTimeWithOffsetInSec
}
