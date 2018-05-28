/* eslint-disable no-console */

const BrickblockAccessToken = artifacts.require('BrickblockAccessToken')
const BrickblockAccount = artifacts.require('BrickblockAccount')
const BrickblockContractRegistry = artifacts.require(
  'BrickblockContractRegistry'
)
const BrickblockToken = artifacts.require('BrickblockToken')
const ExchangeRates = artifacts.require('ExchangeRates')
const FeeManager = artifacts.require('BrickblockFeeManager')
const Logger = artifacts.require('BrickblockLogger')
const PoaManager = artifacts.require('PoaManager')
const PoaToken = artifacts.require('PoaToken')
const Whitelist = artifacts.require('BrickblockWhitelist')
let ExchangeRateProvider

const { addContractsToRegistry, setFiatRate } = require('./helpers/general')

module.exports = (deployer, network, accounts) => {
  console.log(`deploying on ${network} network`)

  if (network === 'dev' || network == 'test') {
    ExchangeRateProvider = artifacts.require('stubs/ExchangeRateProviderStub')
  } else {
    ExchangeRateProvider = artifacts.require('ExchangeRateProvider')
  }

  deployer
    .then(async () => {
      const owner = accounts[0]
      const bonusAddress = accounts[1]

      await deployer.deploy(BrickblockContractRegistry, { from: owner })
      const reg = await BrickblockContractRegistry.deployed()

      //Brickblock Token
      await deployer.deploy(BrickblockToken, bonusAddress, {
        from: owner
      })
      const bbk = await BrickblockToken.deployed()

      //BrickblockAccessToken
      await deployer.deploy(BrickblockAccessToken, reg.address, {
        from: owner
      })
      const act = await BrickblockAccessToken.deployed()

      //BrickblockAccount
      await deployer.deploy(BrickblockAccount, reg.address, 100, {
        from: owner
      })
      const bat = await BrickblockAccount.deployed()

      //FeeManager
      await deployer.deploy(FeeManager, reg.address, {
        from: owner
      })
      const fmr = await FeeManager.deployed()

      //WhiteList
      await deployer.deploy(Whitelist, {
        from: owner
      })
      const wht = await FeeManager.deployed()

      // PoaManager
      await deployer.deploy(PoaManager, reg.address, {
        from: owner
      })
      const pmr = await PoaManager.deployed()

      // ExchangeRates
      await deployer.deploy(ExchangeRates, reg.address, { from: owner })
      const exr = await ExchangeRates.deployed()

      // ExchangeRateProvider
      await deployer.deploy(ExchangeRateProvider, reg.address, {
        from: owner
      })
      const exp = await ExchangeRateProvider.deployed()

      // PoaToken master
      const poa = await deployer.deploy(PoaToken)

      // Logger
      await deployer.deploy(Logger, reg.address, { from: owner })
      const log = await Logger.deployed()

      // eslint-disable-next-line no-console
      console.log('adding contracts to the registry')
      await addContractsToRegistry({
        act,
        bat,
        bbk,
        exp,
        exr,
        fmr,
        log,
        owner,
        pmr,
        poa,
        reg,
        wht
      })

      console.log('setting ACT rate')
      await exr.setActRate(1e3)

      console.log('setting EUR rate')
      await setFiatRate(exr, exp, 'EUR', 5e4, {
        from: owner,
        value: 1e18
      })

      return true
    })
    .catch(err => {
      // eslint-disable-next-line no-console
      console.error(err)
    })
}
