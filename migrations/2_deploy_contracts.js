const BrickblockContractRegistry = artifacts.require(
  'BrickblockContractRegistry'
)
const ExchangeRates = artifacts.require('ExchangeRates')
const ExchangeRateProvider = artifacts.require('ExchangeRateProvider')

module.exports = (deployer, network, accounts) => {
  if (network != 'test') {
    deployer
      .then(async () => {
        const owner = accounts[0]
        await deployer.deploy(BrickblockContractRegistry, { from: owner })
        const reg = await BrickblockContractRegistry.deployed()
        await deployer.deploy(ExchangeRates, reg.address, { from: owner })
        await deployer.deploy(ExchangeRateProvider, reg.address, {
          from: owner
        })
        const exr = await ExchangeRates.deployed()
        const exp = await ExchangeRateProvider.deployed()
        await reg.updateContractAddress('ExchangeRates', exr.address, {
          from: owner
        })
        await reg.updateContractAddress('ExchangeRateProvider', exp.address, {
          from: owner
        })
        await exr.setCurrencySettings(
          'USD',
          'json(https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD).USD',
          30,
          2.5e5,
          { from: owner }
        )
        await exr.setCurrencySettings(
          'EUR',
          'json(https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=EUR).EUR',
          30,
          2.5e5,
          { from: owner }
        )
        await exr.fetchRate('USD', { value: 1e18 })
        await exr.fetchRate('EUR', { value: 1e18 })
        return true
      })
      .catch(err => {
        // eslint-disable-next-line no-console
        console.log(err)
      })
  }
}
