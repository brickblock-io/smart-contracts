/* eslint-disable no-console */
const chalk = require('chalk')

const { getEtherBalance } = require('./general.js')

const setFiatRate = async (
  exr,
  exp,
  params = {
    currencyName: 'EUR',
    queryString: 'https://min-api.cryptocompare.com/data/price?fsym=ETH',
    callIntervalInSec: 30,
    callbackGasLimit: 150000,
    useStub: true,
    config: {
      from: '',
      value: 2e18
    }
  }
) => {
  const {
    currencyName,
    queryString,
    callIntervalInSec,
    callbackGasLimit,
    useStub,
    config: { from: owner }
  } = params
  const ownerPreEtherBalance = await getEtherBalance(owner)

  console.log(
    chalk.yellow(
      `➡️  Setting up exchange rate fetching for "ETH <> ${currencyName}"…`
    )
  )
  await exr.setCurrencySettings(
    currencyName,
    queryString,
    callIntervalInSec,
    callbackGasLimit,
    {
      from: params.config.from
    }
  )

  await exr.fetchRate(currencyName, params.config)
  if (useStub) {
    const pendingQueryId = await exp.pendingTestQueryId()
    await exp.simulate__callback(pendingQueryId, '50000', {
      from: params.config.from
    })
  }

  console.log(
    chalk.cyan(
      `✅  Successfully set up exchange rate fetching for "ETH <> ${currencyName}"\n\n`
    )
  )

  const ownerPostEtherBalance = await getEtherBalance(owner)
  const gasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)
  return { gasCost }
}

module.exports = {
  setFiatRate
}
