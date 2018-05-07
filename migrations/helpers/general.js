const addContractsToRegistry = async ({
  owner,
  reg, // reg = Registry
  bbk, // bbk = BrickblockToken
  act, // act = AccessToken
  bat, // bat = BrickblockAccount
  fmr, // fmr = BrickblockFeeManager
  exr, // exr = ExchangeRates
  exp, // exp = ExchangeRatesProvider
  wht // wht = BrickblockWhitelist
}) => {
  await reg.updateContractAddress('BrickblockToken', bbk.address, {
    from: owner
  })
  await reg.updateContractAddress('AccessToken', act.address, {
    from: owner
  })
  await reg.updateContractAddress('ExchangeRates', exr.address, {
    from: owner
  })
  await reg.updateContractAddress('ExchangeRateProvider', exp.address, {
    from: owner
  })
  await reg.updateContractAddress('FeeManager', fmr.address, {
    from: owner
  })
  await reg.updateContractAddress('BrickblockAccount', bat.address, {
    from: owner
  })
  await reg.updateContractAddress('Whitelist', wht.address, {
    from: owner
  })
}

const setFiatRate = async (exr, exp, queryType, rate, config) => {
  await exr.setCurrencySettings(
    queryType,
    'https://domain.com?currency=ETH',
    30,
    1.5e5,
    {
      from: config.from
    }
  )
  await exr.getCurrencySettingsReadable(queryType)
  await exr.fetchRate(queryType, config)
  const pendingQueryId = await exp.pendingTestQueryId()
  await exp.simulate__callback(pendingQueryId, '50000', {
    from: config.from
  })
}

module.exports = {
  addContractsToRegistry,
  setFiatRate
}
