/* eslint-disable no-console */
const chalk = require('chalk')

const setFiatRate = async (
  ExchangeRates,
  ExchangeRateProvider,
  params = {
    currencyName: 'EUR',
    queryString:
      'json(https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=EUR).EUR',
    callIntervalInSec: 30,
    callbackGasLimit: 150000,
    useStub: true
  },
  txConfig = {
    from: null,
    gas: null
  }
) => {
  const {
    currencyName,
    queryString,
    callIntervalInSec,
    callbackGasLimit,
    useStub
  } = params

  console.log(
    chalk.cyan(`\n--------------------------------------------------------`)
  )
  console.log(
    chalk.cyan(
      `🚀  Setting up exchange rate fetching for "ETH <> ${currencyName}"…`
    )
  )
  console.log(
    chalk.yellow('\n➡️   Setting currency settings in ExchangeRates contract…')
  )
  await ExchangeRates.setCurrencySettings(
    currencyName,
    queryString,
    callIntervalInSec,
    callbackGasLimit,
    txConfig
  )

  console.log(
    chalk.yellow('\n➡️   Fetching latest rate from ExchangeRates contract…')
  )
  // This method needs some ETH to pay the Oraclize fees
  await ExchangeRates.fetchRate(currencyName, { ...txConfig, value: 1e17 })
  if (useStub) {
    console.log(chalk.yellow('\n➡️   Using stub to generate a test queryId…'))
    const pendingQueryId = await ExchangeRateProvider.pendingTestQueryId(
      txConfig
    )

    console.log(
      chalk.yellow(
        '\n➡️   Using stub to simulate a successful callback from Oraclize…'
      )
    )
    await ExchangeRateProvider.simulate__callback(
      pendingQueryId,
      // expected that this API returns a euro dollar value
      '500.12',
      txConfig
    )
  }

  console.log(
    chalk.green(
      `\n✅  Successfully set up exchange rate fetching for "ETH <> ${currencyName}"`
    )
  )
  console.log(
    chalk.green(
      '-----------------------------------------------------------------\n\n'
    )
  )
}

module.exports = {
  setFiatRate
}
