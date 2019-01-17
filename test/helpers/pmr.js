const PoaManager = artifacts.require('PoaManager.sol')
const PoaToken = artifacts.require('PoaToken.sol')
const PoaCrowdsale = artifacts.require('PoaCrowdsale')

const {
  issuer,
  defaultActivationDuration,
  defaultFiatCurrency,
  defaultFiatCurrency32,
  defaultFiatRate,
  defaultFiatRatePenalty,
  defaultFundingGoal,
  defaultFiatFundingDuration,
  defaultEthFundingDuration,
  defaultIpfsHashArray32,
  defaultName32,
  defaultSymbol32,
  defaultTotalSupply,
  getDefaultStartTimeForFundingPeriod,
  setupEcosystem,
  stages,
  testActivate,
  testBuyRemainingTokens,
  testPayActivationFee,
  testSetCurrencyRate,
  testStartPreFunding,
  testStartEthSale,
  testUpdateProofOfCustody,
  timeTravelToEthFundingPeriod,
  whitelistedEthInvestors,
} = require('./poa')
const { gasPrice } = require('./general')

const accounts = web3.eth.accounts
const owner = accounts[0]
// must be accounts 2 in order to work with poa test helpers
const custodian = accounts[2]

const setupPoaManager = async () => {
  const poatm = await PoaToken.new()
  const poacm = await PoaCrowdsale.new()
  const { reg, exr, exp, fmr } = await setupEcosystem()
  const pmr = await PoaManager.new(reg.address)

  await reg.updateContractAddress('PoaManager', pmr.address)
  await reg.updateContractAddress('PoaTokenMaster', poatm.address)
  await reg.updateContractAddress('PoaCrowdsaleMaster', poacm.address)

  await testSetCurrencyRate(
    exr,
    exp,
    defaultFiatCurrency,
    defaultFiatRate,
    defaultFiatRatePenalty,
    {
      from: owner,
      value: 1e18,
    }
  )

  return {
    poatm,
    reg,
    pmr,
    fmr,
  }
}

const addNewToken = async (pmr, config) => {
  const txReceipt = await pmr.addNewToken(
    defaultName32,
    defaultSymbol32,
    defaultFiatCurrency32,
    custodian,
    defaultTotalSupply,
    await getDefaultStartTimeForFundingPeriod(),
    defaultFiatFundingDuration,
    defaultEthFundingDuration,
    defaultActivationDuration,
    defaultFundingGoal,
    config
  )

  const tokenAddress = txReceipt.logs[0].args.token

  return {
    tokenAddress,
    txReceipt,
  }
}

const moveTokenToActive = async (poa, fmr) => {
  // move from `Preview` to `PreFunding` stage
  await testStartPreFunding(poa, { from: issuer, gasPrice })

  await timeTravelToEthFundingPeriod(poa)

  // move from `PreFunding` to `EthFunding` stage
  await testStartEthSale(poa)

  await testBuyRemainingTokens(poa, {
    from: whitelistedEthInvestors[whitelistedEthInvestors.length - 1],
    gasPrice,
  })

  await testUpdateProofOfCustody(poa, defaultIpfsHashArray32, {
    from: custodian,
  })

  await testPayActivationFee(poa, fmr)

  await testActivate(poa, fmr, {
    from: custodian,
  })
}

const testPauseToken = async (pmr, poa, config) => {
  await pmr.pauseToken(poa.address, config)
}

const testUnpauseToken = async (pmr, poa, config) => {
  await pmr.unpauseToken(poa.address, config)
}

const testTerminateToken = async (pmr, poa, config) => {
  const preStage = await poa.stage()
  assert.equal(
    preStage.toString(),
    stages.Active,
    'poa should start in stage Active'
  )

  await pmr.terminateToken(poa.address, config)

  const postStage = await poa.stage()
  assert.equal(
    postStage.toString(),
    stages.Terminated,
    'poa should be in stage Terminated after terminate'
  )
}

module.exports = {
  setupPoaManager,
  addNewToken,
  moveTokenToActive,
  testPauseToken,
  testUnpauseToken,
  testTerminateToken,
}
