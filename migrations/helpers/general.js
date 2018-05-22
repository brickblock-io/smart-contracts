const addContractsToRegistry = async ({
  act, // BrickblockAccessToken
  bat, // BrickbloackAccount
  bbk, // BrickblockToken
  exp, // ExchangeRateProvider
  exr, // ExchangeRates
  fmr, // BrickblockFeeManager
  owner,
  pmr, // PoaManager
  reg, // BrickblockContractRegistry
  wht, // BrickblockWhitelist
  poa // PoaToken master
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
  await reg.updateContractAddress('PoaManager', pmr.address, {
    from: owner
  })

  await reg.updateContractAddress('PoaTokenMaster', poa.address, {
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
