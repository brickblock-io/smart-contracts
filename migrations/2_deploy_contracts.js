const BrickblockContractRegistry = artifacts.require(
  'BrickblockContractRegistry'
)
const BrickblockToken = artifacts.require('BrickblockToken')
const BrickblockAccessToken = artifacts.require('BrickblockAccessToken')
const BrickblockAccount = artifacts.require('BrickblockAccount')
const FeeManager = artifacts.require('BrickblockFeeManager')
const Whitelist = artifacts.require('BrickblockWhitelist')
const { addContractsToRegistry } = require('./helpers/general')
const ExchangeRates = artifacts.require('ExchangeRates')
let ExchangeRateProvider

module.exports = (deployer, network, accounts) => {
  // eslint-disable-next-line no-console
  console.log(`deploying on ${network} network`)

  if (network === 'dev') {
    ExchangeRateProvider = artifacts.require('stubs/ExchangeRateProviderStub')
  } else {
    ExchangeRateProvider = artifacts.require('ExchangeRateProvider')
  }

  if (network != 'test') {
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
        await deployer.deploy(BrickblockAccount, reg.address, {
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

        await deployer.deploy(ExchangeRates, reg.address, { from: owner })
        await deployer.deploy(ExchangeRateProvider, reg.address, {
          from: owner
        })
        const exr = await ExchangeRates.deployed()
        const exp = await ExchangeRateProvider.deployed()

        addContractsToRegistry({
          owner,
          reg,
          bbk,
          act,
          bat,
          fmr,
          exr,
          exp,
          wht
        })

        //setupCurrencies(exr, owner)
        return true
      })
      .catch(err => {
        // eslint-disable-next-line no-console
        console.error(err)
      })
  }
}
