const addContractsToRegistry = async ({
  owner,
  reg,
  bbk,
  act,
  bat,
  fmr,
  exr,
  exp,
  wht
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

module.exports = {
  addContractsToRegistry
}
