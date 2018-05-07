const BigNumber = require('bignumber.js')

const BrickblockContractRegistry = artifacts.require(
  'BrickblockContractRegistry'
)
const BrickblockToken = artifacts.require('BrickblockToken')
const BrickblockAccessToken = artifacts.require('BrickblockAccessToken')
const BrickblockAccount = artifacts.require('BrickblockAccount')
const FeeManager = artifacts.require('BrickblockFeeManager')
const Whitelist = artifacts.require('BrickblockWhitelist')
const { addContractsToRegistry, setFiatRate } = require('./helpers/general')
const ExchangeRates = artifacts.require('ExchangeRates')
const PoaTokenConcept = artifacts.require('PoaTokenConcept')
let ExchangeRateProvider

module.exports = (deployer, network, accounts) => {
  // eslint-disable-next-line no-console
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
      const broker = accounts[2]
      const custodian = accounts[3]

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

      await exr.setActRate(1e3)
      await setFiatRate(exr, exp, 'EUR', 5e4, {
        from: owner,
        value: 1e18
      })

      await deployer.deploy(
        PoaTokenConcept,
        'TestToken',
        'TST',
        'EUR',
        broker,
        custodian,
        reg.address,
        new BigNumber(Date.now()).div(1000).add(60),
        new BigNumber(60 * 60 * 24),
        new BigNumber(60 * 60 * 24 * 7),
        new BigNumber(5e5)
      )

      return true
    })
    .catch(err => {
      // eslint-disable-next-line no-console
      console.error(err)
    })
}
