const BigNumber = require('bignumber.js')
const { setupContracts } = require('../helpers/exr')
const { table } = require('table')

describe('when analyzing gas costs', () => {
  contract('ExchangeRates/ExchangeRatesProviderStub', accounts => {
    const owner = accounts[0]
    const callInterval = new BigNumber(60)
    const callbackGasLimit = new BigNumber(20e9)
    const queryString = 'https://domain.com/api/?base=ETH&to=USD'
    const queryType = 'USD'
    let exr

    before('setup contracts', async () => {
      const contracts = await setupContracts()
      exr = contracts.exr
    })

    it('should output to console gas costs', async () => {
      const data = [['Function', 'Gas Used']]

      //setCurrencySettings
      const txSetCurrencySettings = await exr.setCurrencySettings(
        queryType,
        queryString,
        callInterval,
        callbackGasLimit,
        { from: owner }
      )
      data.push(['setCurrencySettings', txSetCurrencySettings.receipt.gasUsed])

      //getCurrencySettings
      const txFetchRate = await exr.fetchRate(queryType, {
        from: owner,
        value: 1e18
      })

      data.push(['txFetchRate', txFetchRate.receipt.gasUsed])

      // eslint-disable-next-line
      console.log(table(data))
    })
  })
})
