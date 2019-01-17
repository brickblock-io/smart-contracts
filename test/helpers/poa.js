const AccessToken = artifacts.require('AccessToken')
const ContractRegistry = artifacts.require('ContractRegistry')
const ExchangeRateProvider = artifacts.require('ExchangeRateProviderStub')
const ExchangeRates = artifacts.require('ExchangeRates')
const FeeManager = artifacts.require('FeeManager')
const PoaLogger = artifacts.require('PoaLogger')
const PoaManager = artifacts.require('PoaManager')
const PoaToken = artifacts.require('PoaToken')
const PoaCrowdsale = artifacts.require('PoaCrowdsale')
const Whitelist = artifacts.require('Whitelist')
const IPoaTokenCrowdsale = artifacts.require('IPoaTokenCrowdsale')

const assert = require('assert')
const BigNumber = require('bignumber.js')

const { getTimeInFutureBySeconds, timeTravelToTarget } = require('helpers')
const {
  areInRange,
  bigZero,
  gasPrice,
  getEtherBalance,
  getGasUsed,
  sendTransaction,
  testWillThrow,
  percentBigInt,
} = require('./general')
const { finalizedBBK } = require('./bbk')
const { testApproveAndLockMany } = require('./act')
const {
  testSetCurrencySettings,
  testFetchRate,
  testSetRate,
  testSetQueryId,
} = require('./exr')

const stages = {
  Preview: '0',
  PreFunding: '1',
  FiatFunding: '2',
  EthFunding: '3',
  FundingSuccessful: '4',
  FundingCancelled: '5',
  TimedOut: '6',
  Active: '7',
  Terminated: '8',
}

const accounts = web3.eth.accounts
const owner = accounts[0]
const issuer = accounts[1]
const custodian = accounts[2]
const bbkBonusAddress = accounts[3]
const bbkContributors = accounts.slice(4, 6)
// overlap with bbkContributors... need more than 2 buyer accounts
const whitelistedEthInvestors = accounts.slice(4, 8)
const whitelistedFiatInvestor = accounts[9]
const bbkTokenDistAmount = new BigNumber(1e18)
const actRate = new BigNumber(1e3)
const defaultName = 'TestPoa'
const defaultName32 = web3.toHex('TestPoa')
const defaultSymbol = 'TPA'
const defaultSymbol32 = web3.toHex('TPA')
const defaultFiatCurrency = 'EUR'
const defaultFiatCurrency32 = web3.toHex('EUR')
const defaultFiatFundingDuration = new BigNumber(60 * 60 * 24 * 3)
const defaultEthFundingDuration = new BigNumber(60 * 60 * 24)
const defaultActivationDuration = new BigNumber(60 * 60 * 24 * 7)
const defaultFundingGoal = new BigNumber(5e5)
const defaultTotalSupply = new BigNumber(1e23)
const defaultFiatRate = new BigNumber('333.33')
const defaultPenalizedFiatRate = new BigNumber('326.66')
const defaultFiatRatePenalty = new BigNumber(20) // in permille => 20/1000 = 2%
const defaultIpfsHash = 'QmSUfCtXgb59G9tczrz2WuHNAbecV55KRBGXBbZkou5RtE'
const newIpfsHash = 'Qmd286K6pohQcTKYqnS1YhWrCiS4gz7Xi34sdwMe9USZ7u'
const defaultIpfsHashArray32 = [
  web3.toHex(defaultIpfsHash.slice(0, 32)),
  web3.toHex(defaultIpfsHash.slice(32)),
]
const newIpfsHashArray32 = [
  web3.toHex(newIpfsHash.slice(0, 32)),
  web3.toHex(newIpfsHash.slice(32)),
]
// default buy amount of 1e18 wei including effect
// of penalized fiat rate, which increases this amount
// by factor defaultFiatRate/defaultPenalizedFiatRate.
const defaultBuyAmount = new BigNumber(
  new BigNumber(1e18)
    .times(defaultFiatRate)
    .dividedBy(defaultPenalizedFiatRate)
    .toFixed(0, 1) // cut off decimals to simulate integer
)

const emptyBytes32 = '0x' + '0'.repeat(64)

const getDefaultStartTimeForFundingPeriod = async () => {
  return getTimeInFutureBySeconds(60)
}

// Travels forward in time until `startTimeForFundingPeriod` is reached.
const timeTravelToFundingPeriod = async poa => {
  const startTimeForFiatFunding = await poa.startTimeForFundingPeriod()
  return timeTravelToTarget(startTimeForFiatFunding)
}

// Travels forward in time until `startTimeForFundingPeriod` +
// `durationForFiatFundingPeriod` is reached.
// If `durationForEthFundingPeriod` is 0, do NOT travel.
// If `durationForFiatFundingPeriod` is 0, travel to `startTimeForFundingPeriod`
const timeTravelToEthFundingPeriod = async poa => {
  const startTimeForFundingPeriod = await poa.startTimeForFundingPeriod()
  const durationForFiatFundingPeriod = await poa.durationForFiatFundingPeriod()
  const durationForEthFundingPeriod = await poa.durationForEthFundingPeriod()

  // Only travel when ETH funding period exists
  if (durationForEthFundingPeriod.greaterThan(0)) {
    return timeTravelToTarget(
      startTimeForFundingPeriod.add(durationForFiatFundingPeriod)
    )
  } else {
    // eslint-disable-next-line
    console.log('💫 Did not warp... ETH funding period does not exist')
  }
}

// Travels forward in time until `startTimeForFundingPeriod` +
// `durationForFiatFundingPeriod` + `durationForEthFundingPeriod` is reached.
const timeTravelToFundingPeriodTimeout = async poa => {
  const startTimeForFundingPeriod = await poa.startTimeForFundingPeriod()
  const durationForFiatFundingPeriod = await poa.durationForEthFundingPeriod()
  const durationForEthFundingPeriod = await poa.durationForFiatFundingPeriod()

  return timeTravelToTarget(
    startTimeForFundingPeriod
      .add(durationForFiatFundingPeriod)
      .add(durationForEthFundingPeriod)
  )
}

const timeTravelToActivationPeriodTimeout = async poa => {
  const startTimeForFundingPeriod = await poa.startTimeForFundingPeriod()
  const durationForFiatFundingPeriod = await poa.durationForEthFundingPeriod()
  const durationForEthFundingPeriod = await poa.durationForFiatFundingPeriod()
  const durationForActivationPeriod = await poa.durationForActivationPeriod()

  return timeTravelToTarget(
    startTimeForFundingPeriod
      .add(durationForFiatFundingPeriod)
      .add(durationForEthFundingPeriod)
      .add(durationForActivationPeriod)
  )
}

// sets up all contracts needed in the ecosystem for POA to function
const setupEcosystem = async () => {
  const reg = await ContractRegistry.new()
  const act = await AccessToken.new(reg.address)
  const bbk = await finalizedBBK(
    owner,
    bbkBonusAddress,
    act.address,
    bbkContributors,
    bbkTokenDistAmount
  )
  const exr = await ExchangeRates.new(reg.address)
  const exp = await ExchangeRateProvider.new(reg.address)
  const fmr = await FeeManager.new(reg.address)
  const wht = await Whitelist.new(reg.address)
  const pmr = await PoaManager.new(reg.address)
  const log = await PoaLogger.new(reg.address)

  for (const buyer of [...whitelistedEthInvestors, whitelistedFiatInvestor]) {
    const preWhitelisted = await wht.whitelisted(buyer)
    await wht.addAddress(buyer)
    const postWhitelisted = await wht.whitelisted(buyer)

    assert(!preWhitelisted, 'the buyer should start NOT whitelisted')
    assert(postWhitelisted, 'the buyer should be whitelisted')
  }

  await reg.updateContractAddress('BrickblockToken', bbk.address)
  await reg.updateContractAddress('AccessToken', act.address)
  await reg.updateContractAddress('ExchangeRates', exr.address)
  await reg.updateContractAddress('ExchangeRateProvider', exp.address)
  await reg.updateContractAddress('FeeManager', fmr.address)
  await reg.updateContractAddress('Whitelist', wht.address)
  await reg.updateContractAddress('PoaManager', pmr.address)
  await reg.updateContractAddress('PoaLogger', log.address)

  testApproveAndLockMany(bbk, act, bbkContributors, bbkTokenDistAmount)

  return {
    reg,
    act,
    bbk,
    exr,
    exp,
    fmr,
    wht,
    pmr,
    log,
  }
}

const testSetCurrencyRate = async (
  exr,
  exp,
  currencyType,
  rate,
  ratePenalty,
  config
) => {
  const callInterval = new BigNumber(30)
  const queryString = 'https://domain.com?currency=ETH'
  const callbackGasLimit = new BigNumber(1.5e5)
  await testSetCurrencySettings(
    exr,
    currencyType,
    callInterval,
    callbackGasLimit,
    queryString,
    ratePenalty,
    {
      from: config.from,
    }
  )

  await testFetchRate(exr, exp, currencyType, config)

  await testSetRate(exr, exp, rate, ratePenalty, false)
}

const testSetCurrencyRateWithDefaultValues = async (exr, exp) => {
  return testSetCurrencyRate(
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
}

const setupPoaProxyAndEcosystem = async () => {
  const { reg, act, bbk, exr, exp, fmr, wht, pmr, log } = await setupEcosystem()

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
  await testSetCurrencyRate(
    exr,
    exp,
    'USD',
    new BigNumber('350.11'),
    defaultFiatRatePenalty,
    {
      from: owner,
      value: 1e18,
    }
  )

  // deploy poa master in order to allow proxies to use it's code
  const poatm = await PoaToken.new()
  const poacm = await PoaCrowdsale.new()

  // add to registry for use by PoaManager and PoaToken proxies
  await reg.updateContractAddress('PoaTokenMaster', poatm.address)
  await reg.updateContractAddress('PoaCrowdsaleMaster', poacm.address)
  // add issuer to allow for adding a new token from PoaManager
  await pmr.addIssuer(issuer)

  // Poa PoaProxy contract
  const poaTx = await pmr.addNewToken(
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
    {
      from: issuer,
    }
  )

  // wrap the proxied PoA in PoaToken ABI to call as if regular PoA
  const poa = await IPoaTokenCrowdsale.at(poaTx.logs[0].args.token)

  return {
    reg,
    act,
    bbk,
    exr,
    exp,
    fmr,
    wht,
    pmr,
    poa,
    poatm,
    log,
  }
}

const testProxyInitialization = async (reg, pmr, args) => {
  const [
    name32,
    symbol32,
    fiatCurrency32,
    passedCustodian,
    totalSupply,
    startTimeForFundingPeriod,
    durationForFiatFundingPeriod,
    durationForEthFundingPeriod,
    durationForActivationPeriod,
    fundingGoal,
    config,
  ] = args

  // list issuer
  await pmr.addIssuer(issuer)

  // create new master poa contracts
  const poatm = await PoaToken.new()
  const poacm = await PoaCrowdsale.new()

  // add poa master to registry
  await reg.updateContractAddress('PoaTokenMaster', poatm.address)
  await reg.updateContractAddress('PoaCrowdsaleMaster', poacm.address)

  // Poa PoaProxy contract tx
  const poaTx = await pmr.addNewToken.apply(null, args)

  // wrap the proxied PoA in PoaToken ABI to call as if regular PoA
  const poa = await IPoaTokenCrowdsale.at(poaTx.logs[0].args.token)

  assert.equal(
    await poa.name(),
    name32,
    'name should match that given in constructor'
  )
  assert.equal(
    await poa.symbol(),
    symbol32,
    'symbol should match that given in constructor'
  )
  assert.equal(
    await poa.proofOfCustody(),
    '',
    'proofOfCustody should start uninitialized'
  )
  assert.equal(
    await poa.fiatCurrency(),
    fiatCurrency32,
    'fiatCurrency should match that given in constructor'
  )
  assert.equal(
    await poa.issuer(),
    config.from,
    'issuer should match sender of transaction'
  )
  assert.equal(
    await poa.custodian(),
    passedCustodian,
    'custodian should match custodian in constructor'
  )
  assert.equal(
    await poa.decimals(),
    new BigNumber(18).toString(),
    'decimals should be constant of 18'
  )
  assert.equal(
    await poa.feeRateInPermille(),
    new BigNumber(5).toString(),
    'fee rate should be a constant of 5'
  )
  assert.equal(
    await poa.startTimeForFundingPeriod(),
    startTimeForFundingPeriod,
    'startTimeForFundingPeriod should match that given in constructor'
  )
  assert.equal(
    await poa.durationForFiatFundingPeriod(),
    durationForFiatFundingPeriod.toString(),
    'durationForFiatFundingPeriod should match that given in constructor'
  )
  assert.equal(
    await poa.durationForEthFundingPeriod(),
    durationForEthFundingPeriod.toString(),
    'durationForEthFundingPeriod should match that given in constructor'
  )
  assert.equal(
    await poa.durationForActivationPeriod(),
    durationForActivationPeriod.toString(),
    'durationForActivationPeriod should match that given in constructor'
  )
  assert.equal(
    await poa.fundingGoalInCents(),
    fundingGoal.toString(),
    'fundingGoalInCents should match that given in constructor'
  )
  assert.equal(
    await poa.totalPerTokenPayout(),
    bigZero.toString(),
    'totalPerTokenPayout should start uninitialized'
  )
  assert.equal(
    await poa.fundedEthAmountInWei(),
    bigZero.toString(),
    'fundedEthAmountInWei should start uninitialized'
  )
  assert.equal(
    await poa.totalSupply(),
    totalSupply.toString(),
    'totalSupply should match that given in constructor'
  )
  assert.equal(
    await poa.balanceOf(poa.address),
    bigZero.toString(),
    'contract balance should be 0'
  )
  assert.equal(
    await poa.stage(),
    bigZero.toString(),
    'stage should start at 0 (Preview)'
  )
  assert.equal(
    await poa.registry(),
    reg.address,
    'registry address should match actual registry address'
  )
  assert.equal(await poa.owner(), pmr.address, 'the owner should be pmr')
  assert(await poa.paused(), 'contract should start paused')

  return poa
}

const testInitialization = async (exr, exp, reg, pmr) => {
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

  const defaultStartTime = await getDefaultStartTimeForFundingPeriod()

  const poa = await PoaToken.new()

  await reg.updateContractAddress('PoaManager', pmr.address)

  await poa.setupContract(
    defaultName,
    defaultSymbol,
    defaultFiatCurrency,
    issuer,
    custodian,
    reg.address,
    defaultTotalSupply,
    defaultStartTime,
    defaultFiatFundingDuration,
    defaultEthFundingDuration,
    defaultActivationDuration,
    defaultFundingGoal
  )

  const name = await poa.name()
  const symbol = await poa.symbol()
  const proofOfCustody = await poa.proofOfCustody()
  const fiatCurrency = await poa.fiatCurrency()
  const actualIssuer = await poa.issuer()
  const actualCustodian = await poa.custodian()
  const decimals = await poa.decimals()
  const feeRateInPermille = await poa.feeRateInPermille()
  const startTimeForFundingPeriod = await poa.startTimeForFundingPeriod()
  const durationForFiatFundingPeriod = await poa.durationForFiatFundingPeriod()
  const durationForEthFundingPeriod = await poa.durationForEthFundingPeriod()
  const fundingGoalInCents = await poa.fundingGoalInCents()
  const totalPerTokenPayout = await poa.totalPerTokenPayout()
  const fundedEthAmountInWei = await poa.fundedEthAmountInWei()
  const totalSupply = await poa.totalSupply()
  const contractBalance = await poa.balanceOf(poa.address)
  const stage = await poa.stage()
  const paused = await poa.paused()
  const registry = await poa.registry()
  const contractOwner = await poa.owner()

  assert.equal(name, defaultName, 'name should match that given in constructor')
  assert.equal(
    symbol,
    defaultSymbol,
    'symbol should match that given in constructor'
  )
  assert.equal(proofOfCustody, '', 'proofOfCustody should start uninitialized')
  assert.equal(
    fiatCurrency,
    defaultFiatCurrency,
    'fiatCurrency should match that given in constructor'
  )
  assert.equal(
    actualIssuer,
    issuer,
    'actualIssuer should match issuer in constructor'
  )
  assert.equal(
    actualCustodian,
    custodian,
    'actualCustodian should match custodian in constructor'
  )
  assert.equal(
    decimals.toString(),
    new BigNumber(18).toString(),
    'decimals should be constant of 18'
  )
  assert.equal(
    feeRateInPermille.toString(),
    new BigNumber(5).toString(),
    'fee rate should be a constant of 5'
  )
  assert.equal(
    startTimeForFundingPeriod.toString(),
    defaultStartTime.toString(),
    'startTimeForFundingPeriod should match that given in constructor'
  )
  assert.equal(
    durationForFiatFundingPeriod.toString(),
    defaultFiatFundingDuration.toString(),
    'durationForFiatFundingPeriod should match that given in constructor'
  )
  assert.equal(
    durationForEthFundingPeriod.toString(),
    defaultEthFundingDuration.toString(),
    'durationForEthFundingPeriod should match that given in constructor'
  )
  assert.equal(
    fundingGoalInCents.toString(),
    defaultFundingGoal.toString(),
    'fundingGoalInCents should match that given in constructor'
  )
  assert.equal(
    totalPerTokenPayout.toString(),
    bigZero.toString(),
    'totalPerTokenPayout should start uninitialized'
  )
  assert.equal(
    fundedEthAmountInWei.toString(),
    bigZero.toString(),
    'fundedEthAmountInWei should start uninitialized'
  )
  assert.equal(
    totalSupply.toString(),
    defaultTotalSupply.toString(),
    'totalSupply should match defaultTotalSupply'
  )
  assert.equal(
    contractBalance.toString(),
    bigZero.toString(),
    'contract balance should be 0'
  )
  assert.equal(
    stage.toString(),
    bigZero.toString(),
    'stage should start at 0 (PreFunding)'
  )
  assert.equal(
    reg.address,
    registry,
    'registry should match actual registry address'
  )
  assert.equal(contractOwner, pmr.address, 'the owner should be PoaManager')
  assert(paused, 'contract should start paused')

  return poa
}

const testWeiToFiatCents = async (poa, weiInput) => {
  const expectedFiat = weiInput
    .mul(defaultFiatRate.times(100))
    .div(1e18)
    .mul(1000 - defaultFiatRatePenalty.toNumber()) // take into account the fiat rete penalty. This computes 98% of the original fiat value
    .div(1000)
    .floor()

  const actualFiat = await poa.weiToFiatCents(weiInput)
  assert.equal(
    expectedFiat.toString(),
    actualFiat.toString(),
    'weiInput converted to actualFiat should match expectedFiat'
  )
}

const testUpdateName = async (poa, newName, config = {}) => {
  assert(!!config.from, "'from' must be defined in the config object")

  await poa.updateName(newName, config)
  const postName = await poa.name()

  assert.equal(newName, postName.toString(), 'name32 should be updated')
}

const testUpdateSymbol = async (poa, newSymbol, config = {}) => {
  assert(!!config.from, "'from' must be defined in the config object")

  await poa.updateSymbol(newSymbol, config)
  const postSymbol = await poa.symbol()

  assert.equal(newSymbol, postSymbol.toString(), 'symbol32 should be updated')
}

const testUpdateIssuerAddress = async (poa, newIssuerAddress, config = {}) => {
  assert(!!config.from, "'from' must be defined in the config object")

  await poa.updateIssuerAddress(newIssuerAddress, config)
  const postIssuerAddress = await poa.issuer()

  assert.equal(
    newIssuerAddress,
    postIssuerAddress.toString(),
    'issuer address should be updated'
  )
}

const testUpdateTotalSupply = async (poa, newTotalSupply, config = {}) => {
  assert(!!config.from, "'from' must be defined in the config object")

  await poa.updateTotalSupply(newTotalSupply, config)
  const postTotalSupply = await poa.totalSupply()

  assert.equal(
    newTotalSupply,
    postTotalSupply.toString(),
    'totalSupply should be updated'
  )
}

const testUpdateFiatCurrency = async (poa, newFiatCurrency, config = {}) => {
  assert(!!config.from, "'from' must be defined in the config object")

  await poa.updateFiatCurrency(newFiatCurrency, config)
  const postFiatCurrency = await poa.fiatCurrency()

  assert.equal(
    newFiatCurrency,
    postFiatCurrency,
    'fiatCurrency32 should be updated'
  )
}

const testUpdateFundingGoalInCents = async (
  poa,
  newFundingGoalInCents,
  config = {}
) => {
  assert(!!config.from, "'from' must be defined in the config object")

  await poa.updateFundingGoalInCents(newFundingGoalInCents, config)
  const postFundingGoalInCents = await poa.fundingGoalInCents()

  assert.equal(
    newFundingGoalInCents,
    postFundingGoalInCents.toString(),
    'fundingGoalInCents should be updated'
  )
}

const testUpdateStartTimeForFundingPeriod = async (
  poa,
  newStartTimeForFundingPeriod,
  config = {}
) => {
  assert(!!config.from, "'from' must be defined in the config object")

  await poa.updateStartTimeForFundingPeriod(
    newStartTimeForFundingPeriod,
    config
  )
  const postStartTimeForFundingPeriod = await poa.startTimeForFundingPeriod()

  assert.equal(
    newStartTimeForFundingPeriod,
    postStartTimeForFundingPeriod.toString(),
    'startTimeForFundingPeriod should be updated'
  )
}

const testUpdateDurationForFiatFundingPeriod = async (
  poa,
  newDurationForFiatFundingPeriod,
  config = {}
) => {
  assert(!!config.from, "'from' must be defined in the config object")

  await poa.updateDurationForFiatFundingPeriod(
    newDurationForFiatFundingPeriod,
    config
  )
  const postDurationForFiatFundingPeriod = await poa.durationForFiatFundingPeriod()

  assert.equal(
    newDurationForFiatFundingPeriod,
    postDurationForFiatFundingPeriod.toString(),
    'durationForEthFundingPeriod should be updated'
  )
}

const testUpdateDurationForEthFundingPeriod = async (
  poa,
  newDurationForEthFundingPeriod,
  config = {}
) => {
  assert(!!config.from, "'from' must be defined in the config object")

  await poa.updateDurationForEthFundingPeriod(
    newDurationForEthFundingPeriod,
    config
  )
  const postDurationForEthFundingPeriod = await poa.durationForEthFundingPeriod()

  assert.equal(
    newDurationForEthFundingPeriod,
    postDurationForEthFundingPeriod.toString(),
    'durationForEthFundingPeriod should be updated'
  )
}

const testUpdateDurationForActivationPeriod = async (
  poa,
  newDurationForActivationPeriod,
  config = {}
) => {
  assert(!!config.from, "'from' must be defined in the config object")

  await poa.updateDurationForActivationPeriod(
    newDurationForActivationPeriod,
    config
  )
  const postDurationForActivationPeriod = await poa.durationForActivationPeriod()

  assert.equal(
    newDurationForActivationPeriod,
    postDurationForActivationPeriod.toString(),
    'durationForActivationPeriod should be updated'
  )
}

const testFiatCentsToWei = async (poa, fiatCentInput) => {
  const expectedWei = fiatCentInput
    .mul(1e18)
    .div(defaultFiatRate.times(100))
    .mul(defaultFiatRate) // default rate
    .div(defaultPenalizedFiatRate) // penalized default rate (by default penalty of 2%)
    .floor() // round down to lower integer to simulate integer division in Solidity

  const actualWei = await poa.fiatCentsToWei(fiatCentInput)

  assert.equal(
    expectedWei.toString(),
    actualWei.toString(),
    'fiatCentInput converted to actualWei should match expectedWei'
  )
}

const testCalculateFee = async (poa, taxableValue) => {
  const feeRateInPermille = await poa.feeRateInPermille()
  const expectedFee = feeRateInPermille
    .mul(taxableValue)
    .div(1e3)
    .floor()

  const actualFee = await poa.calculateFee(taxableValue)

  assert.equal(
    actualFee.toString(),
    new BigNumber('5e15').toString(),
    'actualFee should be 5e15'
  )
  assert.equal(
    expectedFee.toString(),
    actualFee.toString(),
    'actualFee calculated from calculateFee should match expectedFee'
  )
}

const testStartPreFunding = async (poa, config = {}) => {
  assert(!!config.gasPrice, "'gasPrice' must be defined in the config object")
  assert(!!config.from, "'from' must be defined in the config object")
  const preStage = await poa.stage()

  await poa.startPreFunding(config)

  const postStage = await poa.stage()

  assert.equal(
    preStage.toString(),
    stages.Preview,
    'stage should start as Preview'
  )

  assert.equal(
    postStage.toString(),
    stages.PreFunding,
    'stage should end in PreFunding'
  )
}

const testStartFiatSale = async (poa, config = {}) => {
  assert(!!config.gasPrice, "'gasPrice' must be defined in the config object")
  assert(!!config.from, "'from' must be defined in the config object")
  const preStage = await poa.stage()

  await poa.startFiatSale(config)

  const postStage = await poa.stage()

  assert.equal(
    preStage.toString(),
    stages.PreFunding,
    'stage should start as PreFunding'
  )

  assert.equal(
    postStage.toString(),
    stages.FiatFunding,
    'stage should end in FiatFunding'
  )
}

const testStartEthSale = async (poa, config) => {
  const preStage = await poa.stage()

  await poa.startEthSale(config ? config : { from: owner })

  const postStage = await poa.stage()

  assert(
    preStage.toString() === stages.PreFunding ||
      preStage.toString() === stages.FiatFunding,
    'stage should start as PreFunding or FiatFunding'
  )

  assert.equal(
    postStage.toString(),
    stages.EthFunding,
    'stage should end in EthFunding'
  )
}

const getExpectedTokenAmount = async (poa, amountInCents) => {
  const precisionOfPercentCalc = await poa.precisionOfPercentCalc.call()
  const totalSupply = await poa.totalSupply()
  const fundingGoal = await poa.fundingGoalInCents()
  const percentOfFundingGoal = percentBigInt(
    amountInCents,
    fundingGoal,
    precisionOfPercentCalc
  )

  return totalSupply
    .mul(percentOfFundingGoal)
    .div(new BigNumber(10).pow(precisionOfPercentCalc))
}

const testBuyTokensWithFiat = async (poa, buyer, amountInCents, config) => {
  assert(!!config.gasPrice, 'gasPrice must be given')
  assert(!!config.from, 'from must be given')

  let { expectedTokenDifferenceTolerance } = config

  if (typeof config.expectedTokenDifferenceTolerance === 'undefined') {
    expectedTokenDifferenceTolerance = 0
  }

  const preInvestedTokenAmountPerUser = await poa.fundedFiatAmountPerUserInTokens(
    buyer
  )
  const preFundedAmountInTokens = await poa.fundedFiatAmountInTokens()
  const preFundedAmountInCents = await poa.fundedFiatAmountInCents()
  await poa.buyWithFiat(buyer, amountInCents, {
    from: config.from,
    gasPrice: config.gasPrice,
  })

  const postInvestedTokenAmountPerUser = await poa.fundedFiatAmountPerUserInTokens(
    buyer
  )

  const expectedFundedAmountInCents = preFundedAmountInCents.add(amountInCents)
  const postFundedAmountInTokens = await poa.fundedFiatAmountInTokens()
  const postFundedAmountInCents = await poa.fundedFiatAmountInCents()
  const expectedUserTokenAmount = await getExpectedTokenAmount(
    poa,
    amountInCents
  )
  const actualInvestedTokenAmountPerUser = postInvestedTokenAmountPerUser.sub(
    preInvestedTokenAmountPerUser
  )

  const actualFundedAmountInTokens = postFundedAmountInTokens.sub(
    preFundedAmountInTokens
  )

  assert.equal(
    expectedFundedAmountInCents.toString(),
    postFundedAmountInCents.toString(),
    'Funded Amount In Cents should match expected value'
  )

  assert(
    areInRange(
      actualFundedAmountInTokens,
      expectedUserTokenAmount,
      expectedTokenDifferenceTolerance
    ),
    `Token amount should match the expected value.
      expected: ${expectedUserTokenAmount.toString()},
      actual  : ${actualFundedAmountInTokens.toString()},
      tolerance: ${expectedTokenDifferenceTolerance.toString()}`
  )

  assert(
    areInRange(
      actualInvestedTokenAmountPerUser,
      expectedUserTokenAmount,
      expectedTokenDifferenceTolerance
    ),
    'Investor token amount should match the expected value'
  )
}

const testRemoveTokensWithFiat = async (poa, buyer, amountInCents, config) => {
  assert(!!config.gasPrice, 'gasPrice must be given')
  assert(!!config.from, 'from must be given')

  const preInvestedTokenAmountPerUser = await poa.fundedFiatAmountPerUserInTokens(
    buyer
  )
  const preFundedAmountInTokens = await poa.fundedFiatAmountInTokens()
  const preFundedAmountInCents = await poa.fundedFiatAmountInCents()
  await poa.removeFiat(buyer, amountInCents, config)

  const postInvestedTokenAmountPerUser = await poa.fundedFiatAmountPerUserInTokens(
    buyer
  )

  const expectedFundedAmountInCents = preFundedAmountInCents.sub(amountInCents)
  const postFundedAmountInTokens = await poa.fundedFiatAmountInTokens()
  const postFundedAmountInCents = await poa.fundedFiatAmountInCents()
  const expectedUserTokenAmount = await getExpectedTokenAmount(
    poa,
    amountInCents
  )

  assert.equal(
    expectedFundedAmountInCents.toString(),
    postFundedAmountInCents.toString(),
    'Funded Amount In Cents should match expected value'
  )

  assert.equal(
    expectedUserTokenAmount.toString(),
    preFundedAmountInTokens.sub(postFundedAmountInTokens).toString(),
    'Token amount should match the expected value'
  )

  assert.equal(
    preInvestedTokenAmountPerUser
      .sub(postInvestedTokenAmountPerUser)
      .toString(),
    expectedUserTokenAmount.toString(),
    'Investor token amount should match the expected value'
  )
}

const testIncrementOfBalanceWhenBuyTokensWithFiat = async (
  poa,
  buyer,
  amountInCents
) => {
  const preInvestedTokenAmountPerUser = await poa.fundedFiatAmountPerUserInTokens(
    buyer
  )
  const expectedTokenAmount = await getExpectedTokenAmount(poa, amountInCents)

  await testBuyTokensWithFiat(poa, buyer, amountInCents, {
    from: custodian,
    gasPrice,
  })

  const postInvestedTokenAmountPerUser = await poa.fundedFiatAmountPerUserInTokens(
    buyer
  )

  assert.equal(
    preInvestedTokenAmountPerUser.add(expectedTokenAmount).toString(),
    postInvestedTokenAmountPerUser.toString(),
    'Total invested token amount does not match with the expected.'
  )
}

const testBuyTokens = async (poa, config) => {
  assert(!!config.gasPrice, 'gasPrice must be given')
  assert(!!config.value, 'value must be given')
  assert(!!config.from, 'from must be given')

  const buyer = config.from
  const weiBuyAmount = new BigNumber(config.value)

  const preEthBalance = await getEtherBalance(buyer)
  const preTokenBalance = await poa.balanceOf(buyer)
  const preFundedAmount = await poa.fundedEthAmountInWei()
  const preUserWeiInvested = await poa.fundedEthAmountPerUserInWei(buyer)
  const tx = await poa.buyWithEth(config)
  const gasUsed = await getGasUsed(tx)
  const gasCost = new BigNumber(gasUsed).mul(config.gasPrice)

  const postEthBalance = await getEtherBalance(buyer)
  const postTokenBalance = await poa.balanceOf(buyer)
  const postFundedAmount = await poa.fundedEthAmountInWei()
  const postUserWeiInvested = await poa.fundedEthAmountPerUserInWei(buyer)

  const expectedPostEthBalance = preEthBalance.sub(weiBuyAmount).sub(gasCost)

  assert.equal(
    expectedPostEthBalance.toString(),
    postEthBalance.toString(),
    'postEth balance should match expected value'
  )
  assert.equal(
    bigZero.toString(),
    preTokenBalance.toString(),
    'token balance should be 0 before Active stage'
  )
  assert.equal(
    bigZero.toString(),
    postTokenBalance.toString(),
    'token balance should be 0 before Active stage even after buying'
  )
  assert.equal(
    postFundedAmount.sub(preFundedAmount).toString(),
    weiBuyAmount.toString(),
    'fiat fundedEthAmountInWei should be incremented by eth wei amount'
  )
  assert.equal(
    postUserWeiInvested.sub(preUserWeiInvested).toString(),
    weiBuyAmount.toString(),
    'userWeiInvested should be incremented for the buying user'
  )

  return postUserWeiInvested
}

const testBuyTokensMulti = async (poa, buyAmount) => {
  for (const buyer of whitelistedEthInvestors) {
    await testBuyTokens(poa, { from: buyer, value: buyAmount, gasPrice })
  }
}

const testBuyRemainingTokens = async (poa, config) => {
  assert(!!config.gasPrice, 'gasPrice must be given')
  assert(!!config.from, 'from must be given')

  const preUserWeiInvested = await poa.fundedEthAmountPerUserInWei(config.from)
  const fundingGoalInCents = await poa.fundingGoalInCents()
  const fundedFiatAmount = await poa.fundedFiatAmountInCents()
  const remainingBuyableEth = await getRemainingAmountInWeiDuringEthFunding(poa)
  config.value = remainingBuyableEth
  const buyer = config.from
  const weiBuyAmount = new BigNumber(config.value)
  const preStage = await poa.stage()

  const preEthBalance = await getEtherBalance(buyer)
  const preTokenBalance = await poa.balanceOf(buyer)
  const preFundedWei = await poa.fundedEthAmountInWei()
  const tx = await poa.buyWithEth(config)
  const gasUsed = await getGasUsed(tx)
  const gasCost = new BigNumber(gasUsed).mul(config.gasPrice)

  const postUserWeiInvested = await poa.fundedEthAmountPerUserInWei(config.from)
  const postEthBalance = await getEtherBalance(buyer)
  const postTokenBalance = await poa.balanceOf(buyer)
  const postFundedWei = await poa.fundedEthAmountInWei()

  const expectedPostEthBalance = preEthBalance.sub(weiBuyAmount).sub(gasCost)

  const postFundedFiatCents = (await poa.weiToFiatCents(postFundedWei)).add(
    fundedFiatAmount
  )
  const postStage = await poa.stage()

  assert.equal(
    postUserWeiInvested.sub(preUserWeiInvested).toString(),
    remainingBuyableEth.toString(),
    'fundedEthAmountPerUserInWei should be incremented by remainingBuyableEth'
  )
  assert.equal(
    expectedPostEthBalance.toString(),
    postEthBalance.toString(),
    'postEth balance should match expected value'
  )
  assert.equal(
    bigZero.toString(),
    preTokenBalance.toString(),
    'token balance should be 0 before Active stage'
  )
  assert.equal(
    bigZero.toString(),
    postTokenBalance.toString(),
    "token balance should be 0 even after buying all remaining and entering 'FundingSuccessful' stage"
  )
  assert.equal(
    postFundedWei.sub(preFundedWei).toString(),
    weiBuyAmount.toString(),
    'fiat fundedEthAmountInWei should be incremented by fiatBuyAmount'
  )
  assert(
    areInRange(fundingGoalInCents, postFundedFiatCents, 1),
    `fundedAmount in fiat cents should be within 1 cent of fundingGoalCents. fundingGoalInCents: ${fundingGoalInCents}, postFundedFiatCents: ${postFundedFiatCents}`
  )
  assert.equal(
    preStage.toString(),
    stages.EthFunding,
    'stage should be EthFunding'
  )
  assert.equal(
    postStage.toString(),
    stages.FundingSuccessful,
    "stage should be 'FundingSuccessful'"
  )

  return postUserWeiInvested
}

const testPayActivationFee = async (
  poa,
  fmr,
  { value, from = issuer } = {}
) => {
  const paidFeeAmount = value || (await poa.calculateTotalFee())
  const preIsActivationFeePaid = await poa.isActivationFeePaid.call()
  const preFeeManagerBalance = await getEtherBalance(fmr.address)

  const tx = await poa.payActivationFee({
    value: paidFeeAmount,
    from,
  })

  const postFeeManagerBalance = await getEtherBalance(fmr.address)

  const postIsActivationFeePaid = await poa.isActivationFeePaid.call()

  assert.equal(
    preIsActivationFeePaid,
    false,
    'isActivationFeePaid must be false before activation'
  )

  assert.equal(
    postIsActivationFeePaid,
    true,
    'isActivationFeePaid must be true after activation'
  )

  assert.equal(
    postFeeManagerBalance.sub(preFeeManagerBalance).toString(),
    paidFeeAmount.toString(),
    'feeManager ether balance should be incremented by paid fee'
  )

  return {
    tx,
    paidFeeAmount,
  }
}

const testActivate = async (poa, fmr, config) => {
  const contractBalance = await getEtherBalance(poa.address)
  const preStage = await poa.stage()
  const prePaused = await poa.paused()
  const preIssuerPayouts = await poa.currentPayout(issuer, true)

  await poa.activate(config)

  const postStage = await poa.stage()
  const postPaused = await poa.paused()
  const postIssuerPayouts = await poa.currentPayout(issuer, true)

  assert.equal(
    preStage.toString(),
    stages.FundingSuccessful,
    "preStage should be 'FundingSuccessful'"
  )
  assert.equal(
    postStage.toString(),
    stages.Active,
    "postStage should be 'Active'"
  )

  assert(prePaused, 'should be paused before activation')
  assert(!postPaused, 'should not be paused after activation')

  assert.equal(
    postIssuerPayouts.sub(preIssuerPayouts).toString(),
    contractBalance.toString(),
    'contract balance after fee has been paid should be claimable by issuer'
  )
}

const testIssuerClaim = async poa => {
  const preContractBalance = await getEtherBalance(poa.address)
  const preIssuerBalance = await getEtherBalance(issuer)

  const tx = await poa.claim({ from: issuer, gasPrice })

  const postContractBalance = await getEtherBalance(poa.address)
  const postIssuerBalance = await getEtherBalance(issuer)
  const gasUsed = await getGasUsed(tx)
  const expectedPostIssuerBalance = preIssuerBalance
    .add(preContractBalance)
    .sub(new BigNumber(gasUsed).mul(gasPrice))

  assert.equal(
    postIssuerBalance.toString(),
    expectedPostIssuerBalance.toString(),
    'postIssuerBalance should match expectedPostIssuerBalance'
  )
  assert.equal(
    postContractBalance.toString(),
    bigZero.toString(),
    'postContractBalance should be 0'
  )
}

const testPayout = async (poa, fmr, config) => {
  assert(config.from, "'from' not included in config!")
  assert(config.value, "'value' not included in config!")
  assert(config.gasPrice, "'gasPrice' not included in config!")
  const totalSupply = await poa.totalSupply()
  const payoutValue = new BigNumber(config.value)
  const _fee = await poa.calculateFee(payoutValue)
  const fee = _fee.add(
    payoutValue
      .sub(_fee)
      .mul(1e18)
      .mod(totalSupply)
      .div(1e18)
      .floor()
  )

  const preContractTotalTokenPayout = await poa.totalPerTokenPayout()
  const preIssuerEtherBalance = await getEtherBalance(issuer)
  const preCustodianEtherBalance = await getEtherBalance(custodian)
  const preContractEtherBalance = await getEtherBalance(poa.address)
  const preFeeManagerEtherBalance = await getEtherBalance(fmr.address)

  const tx = await poa.payout(config)
  const gasUsed = await getGasUsed(tx)

  const postContractTotalTokenPayout = await poa.totalPerTokenPayout()
  const currentExpectedTotalTokenPayout = payoutValue
    .sub(_fee)
    .mul(1e18)
    .div(totalSupply)
    .floor()
  const expectedContractTotalTokenPayout = preContractTotalTokenPayout.add(
    currentExpectedTotalTokenPayout
  )
  const postContractEtherBalance = await getEtherBalance(poa.address)
  const expectedContractEtherBalance = payoutValue.sub(fee)
  const postFeeManagerEtherBalance = await getEtherBalance(fmr.address)

  assert.equal(
    postContractTotalTokenPayout.toString(),
    expectedContractTotalTokenPayout.toString(),
    'totalPerTokenPayout should match the expected value'
  )

  if (config.from === issuer) {
    const actualIssuerEtherBalance = await getEtherBalance(issuer)
    const expectedIssuerEtherBalance = preIssuerEtherBalance
      .sub(gasPrice.mul(gasUsed))
      .sub(payoutValue)

    assert.equal(
      expectedIssuerEtherBalance.toString(),
      actualIssuerEtherBalance.toString(),
      "expected issuer's ether balance should match actual after payout"
    )
  } else if (config.from === custodian) {
    const actualCustodianEtherBalance = await getEtherBalance(custodian)
    const expectedCustodianEtherBalance = preCustodianEtherBalance
      .sub(gasPrice.mul(gasUsed))
      .sub(payoutValue)

    assert.equal(
      expectedCustodianEtherBalance.toString(),
      actualCustodianEtherBalance.toString(),
      "expected custodian's ether balance should match actual after payout"
    )
  } else {
    throw new Error(
      'Payouts can only be done by the issuer or custodian of this POA contract!'
    )
  }

  assert.equal(
    postContractEtherBalance.sub(preContractEtherBalance).toString(),
    expectedContractEtherBalance.toString(),
    "contract's ether balance should be incremented by the payoutValue minus fees"
  )

  assert.equal(
    postFeeManagerEtherBalance.sub(preFeeManagerEtherBalance).toString(),
    fee.toString(),
    'FeeManager ether balance should be incremented by fee'
  )
}

const testClaim = async (poa, config, isTerminated) => {
  const claimer = config.from
  const stage = await poa.stage()
  const preClaimerClaimAmount = await poa.currentPayout(claimer, true)

  const preClaimerEtherBalance = await getEtherBalance(claimer)
  const preContractEtherBalance = await getEtherBalance(poa.address)

  const tx = await poa.claim({
    from: claimer,
    gasPrice,
  })
  const gasUsed = tx.receipt.gasUsed || bigZero
  const gasCost = gasPrice.mul(gasUsed)

  const postClaimerEtherBalance = await getEtherBalance(claimer)
  const postContractEtherBalance = await getEtherBalance(poa.address)
  const postClaimerClaimAmount = await poa.currentPayout(claimer, true)

  const expectedClaimerEtherBalance = preClaimerEtherBalance
    .sub(gasCost)
    .add(preClaimerClaimAmount)

  assert.equal(
    expectedClaimerEtherBalance.toString(),
    postClaimerEtherBalance.toString(),
    'poaTokenHolder ether balance should match expected balance after claiming'
  )
  assert.equal(
    preContractEtherBalance.sub(postContractEtherBalance).toString(),
    preClaimerClaimAmount.toString(),
    'contract ether balance should be decremented by the claimerClaimAmount'
  )
  assert.equal(
    bigZero.toString(),
    postClaimerClaimAmount.toString(),
    'poaTokenHolder currentPayout should be zero after claiming'
  )
  assert.equal(
    stage.toString(),
    isTerminated ? new BigNumber(8).toString() : new BigNumber(7).toString(),
    `stage should be in ${isTerminated ? 8 : 7}, Active`
  )
}

const testClaimAllPayouts = async (poa, poaTokenHolders) => {
  const stage = await poa.stage()
  assert.equal(stage.toString(), stages.Active, 'stage should be in Active')

  let totalClaimAmount = bigZero

  for (const tokenHolder of poaTokenHolders) {
    const tokenHolderClaimAmount = await poa.currentPayout(tokenHolder, true)
    const preTokenHolderEtherBalance = await getEtherBalance(tokenHolder)
    const preContractEtherBalance = await getEtherBalance(poa.address)

    if (tokenHolderClaimAmount.greaterThan(0)) {
      const tx = await poa.claim({
        from: tokenHolder,
        gasPrice,
      })

      const gasUsed = tx.receipt.gasUsed || bigZero
      const gasCost = gasPrice.mul(gasUsed)
      const expectedTokenHolderEtherBalance = preTokenHolderEtherBalance
        .sub(gasCost)
        .add(tokenHolderClaimAmount)

      const postTokenHolderEtherBalance = await getEtherBalance(tokenHolder)
      const postContractEtherBalance = await getEtherBalance(poa.address)

      assert.equal(
        expectedTokenHolderEtherBalance.toString(),
        postTokenHolderEtherBalance.toString(),
        'poaTokenHolder ether balance should match expected balance after claiming'
      )
      assert.equal(
        preContractEtherBalance.sub(postContractEtherBalance).toString(),
        tokenHolderClaimAmount.toString(),
        'contract ether balance should be decremented by the tokenHolderClaimAmount'
      )
      totalClaimAmount = totalClaimAmount.add(tokenHolderClaimAmount)
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `⚠️ ${tokenHolder} has 0 claimable balances... this may happen due to current test setup, be sure that this is correct`
      )
    }
  }

  const finalContractEtherBalance = await getEtherBalance(poa.address)

  assert(
    totalClaimAmount.greaterThan(0),
    'total claim amount should be more than 0'
  )
  assert(
    areInRange(finalContractEtherBalance, bigZero, 1e2),
    `contract should have very small ether balance after all payouts have been claimed but ${finalContractEtherBalance} wei remain`
  )
}

const testFirstReclaim = async (poa, config, shouldBeFundingSuccessful) => {
  const preStage = await poa.stage()

  assert.equal(
    preStage.toString(),
    shouldBeFundingSuccessful ? stages.FundingSuccessful : stages.EthFunding,
    `contract should be in stage ${
      shouldBeFundingSuccessful ? 'EthFunding' : 'FundingSuccessful'
    } before reclaiming`
  )

  await testReclaim(poa, config, true)

  const postStage = await poa.stage()

  assert.equal(
    postStage.toNumber(),
    stages.TimedOut,
    'the contract should be in stage TimedOut after reclaiming'
  )
}

const testManualCheckForTimeout = async poa => {
  const preStage = await poa.stage()

  await poa.manualCheckForTimeout()

  const postStage = await poa.stage()

  assert(
    preStage.toString() === stages.Preview ||
      preStage.toString() === stages.PreFunding ||
      preStage.toString() === stages.FiatFunding ||
      preStage.toString() === stages.EthFunding ||
      preStage.toString() === stages.FundingSuccessful,
    `preStage maximum should be Stages.FundingSuccessful`
  )

  assert.equal(
    postStage.toString(),
    stages.TimedOut,
    'postStage should be TimedOut'
  )
}

const testCancelFunding = async (poa, from) => {
  const preStage = await poa.stage()

  await poa.cancelFunding({ from })

  const postStage = await poa.stage()

  assert(
    preStage.toString() === stages.Preview ||
      preStage.toString() === stages.PreFunding ||
      preStage.toString() === stages.FiatFunding,
    `preStage maximum should be Stages.FiatFunding`
  )

  assert.equal(
    postStage.toString(),
    stages.FundingCancelled,
    'Post stage should be FundingCancelled'
  )
}

const testReclaim = async (poa, config, first = false) => {
  const claimer = config.from

  const preTotalSupply = await poa.totalSupply()
  const preContractEtherBalance = await getEtherBalance(poa.address)
  const preClaimerTokenBalance = await poa.balanceOf(claimer)
  const preClaimerEtherBalance = await getEtherBalance(claimer)
  const preFundedAmountInWei = await poa.fundedEthAmountInWei()
  const preOutstandingEtherBalance = await poa.fundedEthAmountPerUserInWei(
    claimer
  )

  const tx = await poa.reclaim({
    from: claimer,
    gasPrice,
  })
  const gasUsed = await getGasUsed(tx)
  const gasCost = gasPrice.mul(gasUsed)

  const postTotalSupply = await poa.totalSupply()
  const postContractEtherBalance = await getEtherBalance(poa.address)
  const postClaimerTokenBalance = await poa.balanceOf(claimer)
  const postClaimerEtherBalance = await getEtherBalance(claimer)
  const postFundedAmountInWei = await poa.fundedEthAmountInWei()
  const postOutstandingEtherBalance = await poa.fundedEthAmountPerUserInWei(
    claimer
  )
  const expectedClaimerEtherBalance = preClaimerEtherBalance
    .sub(gasCost)
    .add(preOutstandingEtherBalance) // initialInvestAmount

  if (first) {
    assert.equal(
      preTotalSupply.toString(),
      defaultTotalSupply.toString(),
      'totalSupply should be unchanged and match defaultTotalSupply'
    )
    assert.equal(
      postTotalSupply.toString(),
      bigZero.toString(),
      'totalSupply should be 0 after first reclaim'
    )
  } else {
    assert.equal(
      preTotalSupply.toString(),
      bigZero.toString(),
      'totalSupply should start as 0 after previous reclaim'
    )
    assert.equal(
      postTotalSupply.toString(),
      bigZero.toString(),
      'totalSupply should be 0 after reclaiming'
    )
  }

  assert.equal(
    preFundedAmountInWei.sub(postFundedAmountInWei).toString(),
    preOutstandingEtherBalance.toString(),
    'fundedEthAmountInWei should be decremented by claimed ether amount'
  )
  assert.equal(
    preContractEtherBalance.sub(postContractEtherBalance).toString(),
    preOutstandingEtherBalance.toString(),
    'contract ether balance should be decremented by claimed outstanding balance'
  )
  assert.equal(
    preClaimerTokenBalance.toString(),
    bigZero.toString(),
    'claimer token balance should be 0 unless reaching EthFunding stage'
  )
  assert.equal(
    postClaimerTokenBalance.toString(),
    bigZero.toString(),
    'claimer token balance should be 0 unless reaching EthFunding stage'
  )
  assert.equal(
    postClaimerEtherBalance.toString(),
    expectedClaimerEtherBalance.toString(),
    'claimer should receive expected ether amount after reclaiming'
  )
  assert.equal(
    postOutstandingEtherBalance.toString(),
    bigZero.toString(),
    'claimer should have no outstanding balance after reclaiming'
  )
}

const testReclaimAll = async (poa, tokenBuyers) => {
  for (const tokenBuyer of tokenBuyers) {
    const claimableBalance = await poa.fundedEthAmountPerUserInWei(tokenBuyer)
    if (claimableBalance.greaterThan(0)) {
      await testReclaim(poa, { from: tokenBuyer })
    }
  }

  const finalContractTotalSupply = await poa.totalSupply()
  const finalContractEtherBalance = await getEtherBalance(poa.address)
  const finalFundedAmountInWei = await poa.fundedEthAmountInWei()

  assert.equal(
    finalContractTotalSupply.toString(),
    bigZero.toString(),
    'the final contract total supply should be 0 after all have reclaimed'
  )
  assert.equal(
    bigZero.toString(),
    finalContractEtherBalance.toString(),
    'finalContractEtherBalance should be 0 after all have reclaimed'
  )
  assert.equal(
    bigZero.toString(),
    finalFundedAmountInWei.toString(),
    'fundedEthAmountInWei should be 0 after all have reclaimed'
  )
}

const testPaused = async (poa, shouldBePaused) => {
  const paused = await poa.paused()
  assert(shouldBePaused ? paused : !paused, 'contract should be paused')
}

// start - onlyOwner functions

// NOTE: onlyOwner does a live check for 'PoaManager' from ContractRegistry, which is why we use
// PoaManager here to test "successful" calls

const testPause = async (poa, pmr, config, { callPoaDirectly }) => {
  // NOTE: this should always fail
  if (callPoaDirectly) return await poa.pause(config)

  await require('./pmr').testPauseToken(pmr, poa, config)
  await testPaused(poa, true)
}

const testUnpause = async (poa, pmr, config, { callPoaDirectly }) => {
  // NOTE: this should always fail
  if (callPoaDirectly) return await poa.unpause(config)

  await require('./pmr').testUnpauseToken(pmr, poa, config)
  await testPaused(poa, false)
}

// end - onlyOwner functions

// start - eitherCustodianOrOwner functions

const testTerminate = async (poa, pmr, config, { callPoaDirectly }) => {
  if (!callPoaDirectly) {
    return await require('./pmr').testTerminateToken(pmr, poa, config)
  }

  const preStage = await poa.stage()

  await poa.terminate(config)

  const postStage = await poa.stage()

  assert.equal(preStage.toString(), stages.Active, 'preStage should be Active')
  assert.equal(
    postStage.toString(),
    stages.Terminated,
    'postStage should be Terminated'
  )
}

// end - eitherCustodianOrOwner functions

const testFallback = async config => {
  await testWillThrow(sendTransaction, [web3, config])
}

const testUpdateProofOfCustody = async (poa, ipfsHash, config) => {
  const preIpfsHash = await poa.proofOfCustody()

  const tx = await poa.updateProofOfCustody(ipfsHash, config)

  const postIpfsHash = await poa.proofOfCustody()
  const expectedHash = ipfsHash.reduce(
    (acc, item) => acc.concat(web3.toAscii(item)),
    ''
  )

  assert(preIpfsHash != postIpfsHash, 'should not be same ipfsHash')
  assert.equal(
    postIpfsHash,
    expectedHash,
    'new ifpsHash should be set in contract'
  )

  return tx
}

const testTransfer = async (poa, to, value, args) => {
  assert(args.from, 'args.from not set!')
  const sender = args.from
  const receiver = to
  const transferAmount = value
  const preSenderBalance = await poa.balanceOf(sender)
  const preReceiverBalance = await poa.balanceOf(receiver)

  await poa.transfer(receiver, transferAmount, args)

  const postSenderBalance = await poa.balanceOf(sender)
  const postReceiverBalance = await poa.balanceOf(receiver)

  assert.equal(
    preSenderBalance.minus(postSenderBalance).toString(),
    transferAmount.toString(),
    'sender token balance should be decremented by the transferAmount'
  )
  assert.equal(
    postReceiverBalance.minus(preReceiverBalance).toString(),
    transferAmount.toString(),
    'receiver token balance should be incrementd by the transferAmount'
  )
}

const testApprove = async (poa, spender, value, args) => {
  assert(args.from, 'args.from not set!')
  const approver = args.from
  const preApproval = await poa.allowance(approver, spender)

  await poa.approve(spender, value, args)

  const postApproval = await poa.allowance(approver, spender)

  assert.equal(
    postApproval.minus(preApproval).toString(),
    value.toString(),
    'spender allowance for approver should be incremented by the value'
  )
}

const testTransferFrom = async (
  poa,
  allowanceOwner,
  receiver,
  value,
  config
) => {
  assert(!!config.from, 'config.from required!')
  const allowanceSpender = config.from

  const preOwnerTokenBalance = await poa.balanceOf(allowanceOwner)
  const preReceiverBalance = await poa.balanceOf(receiver)
  const preSpenderAllowance = await poa.allowance(
    allowanceOwner,
    allowanceSpender
  )

  await poa.transferFrom(allowanceOwner, receiver, value, config)

  const postOwnerTokenBalance = await poa.balanceOf(allowanceOwner)
  const postReceiverBalance = await poa.balanceOf(receiver)
  const postSpenderAllowance = await poa.allowance(
    allowanceOwner,
    allowanceSpender
  )

  assert.equal(
    preOwnerTokenBalance.minus(postOwnerTokenBalance).toString(),
    value.toString(),
    'the owner balance should be decremented by the transferFrom amount'
  )
  assert.equal(
    postReceiverBalance.minus(preReceiverBalance).toString(),
    value.toString(),
    'the spender balance should be incremented by the transferFrom amount'
  )
  assert.equal(
    preSpenderAllowance.minus(postSpenderAllowance).toString(),
    value.toString(),
    'the spender allowance should be decremented by the transferFrom amount'
  )
}

const testChangeCustodianAddress = async (poa, newAddress, config) => {
  await poa.changeCustodianAddress(newAddress, config)

  const postAddress = await poa.custodian()

  assert.equal(postAddress, newAddress, 'custodian should be set to newAddress')
}

const testCurrentPayout = async (poa, account, expectedPayout) => {
  const currentPayout = await poa.currentPayout(account, true)

  assert(
    areInRange(currentPayout, expectedPayout, 1),
    'currentPayout should match expectedPayout'
  )
}

const getAccountInformation = async (poa, address) => {
  const etherBalance = await getEtherBalance(address)
  const tokenBalance = await poa.balanceOf(address)
  const perTokenBalance = await poa.currentPayout(address, false)
  const unclaimedBalance = await poa.unclaimedPayoutTotals(address)
  const currentPayout = await poa.currentPayout(address, true)

  return {
    etherBalance,
    tokenBalance,
    perTokenBalance,
    unclaimedBalance,
    currentPayout,
  }
}

const testResetCurrencyRate = async (
  exr,
  exp,
  currencyType,
  rate,
  ratePenalty
) => {
  await testSetQueryId(exr, exp, currencyType)
  await testSetRate(exr, exp, rate, ratePenalty, false)
}

const testActiveBalances = async (poa, commitments) => {
  const totalSupply = await poa.totalSupply()
  const fundedEthAmountInWei = await poa.fundedEthAmountInWei()
  const fundedFiatAmountInTokens = await poa.fundedFiatAmountInTokens()
  const totalSupplyForEthInvestors = totalSupply.minus(fundedFiatAmountInTokens)
  let tokenBalanceTotal = bigZero

  for (const commitment of commitments) {
    const { address, amount } = commitment
    const tokenBalance = await poa.balanceOf(address)
    const expectedBalance = amount
      .mul(totalSupplyForEthInvestors)
      .div(fundedEthAmountInWei)
    tokenBalanceTotal = tokenBalanceTotal.add(tokenBalance)

    assert(
      areInRange(tokenBalance, expectedBalance, 1),
      'token balance should be within 1 wei of expectedBalance'
    )
  }

  assert(
    areInRange(
      tokenBalanceTotal,
      totalSupplyForEthInvestors,
      commitments.length
    ),
    'totalSupply should be within 1 wei of tokenBalanceTotal'
  )
}

const testProxyUnchanged = async (poa, first, state) => {
  if (first) {
    return {
      name: await poa.name(),
      symbol: await poa.symbol(),
      proofOfCustody: await poa.proofOfCustody(),
      fiatCurrency: await poa.fiatCurrency(),
      actualIssuer: await poa.issuer(),
      actualCustodian: await poa.custodian(),
      decimals: await poa.decimals(),
      feeRateInPermille: await poa.feeRateInPermille(),
      startTimeForFundingPeriod: await poa.startTimeForFundingPeriod(),
      durationForFiatFundingPeriod: await poa.durationForFiatFundingPeriod(),
      durationForEthFundingPeriod: await poa.durationForEthFundingPeriod(),
      fundingGoalInCents: await poa.fundingGoalInCents(),
      totalPerTokenPayout: await poa.totalPerTokenPayout(),
      fundedEthAmountInWei: await poa.fundedEthAmountInWei(),
      totalSupply: await poa.totalSupply(),
      contractBalance: await poa.balanceOf(await poa.address),
      stage: await poa.stage(),
      paused: await poa.paused(),
      registry: await poa.registry(),
      contractOwner: await poa.owner(),
    }
  } else {
    assert.deepEqual(
      {
        name: await poa.name(),
        symbol: await poa.symbol(),
        proofOfCustody: await poa.proofOfCustody(),
        fiatCurrency: await poa.fiatCurrency(),
        actualIssuer: await poa.issuer(),
        actualCustodian: await poa.custodian(),
        decimals: await poa.decimals(),
        feeRateInPermille: await poa.feeRateInPermille(),
        startTimeForFundingPeriod: await poa.startTimeForFundingPeriod(),
        durationForFiatFundingPeriod: await poa.durationForFiatFundingPeriod(),
        durationForEthFundingPeriod: await poa.durationForEthFundingPeriod(),
        fundingGoalInCents: await poa.fundingGoalInCents(),
        totalPerTokenPayout: await poa.totalPerTokenPayout(),
        fundedEthAmountInWei: await poa.fundedEthAmountInWei(),
        totalSupply: await poa.totalSupply(),
        contractBalance: await poa.balanceOf(await poa.address),
        stage: await poa.stage(),
        paused: await poa.paused(),
        registry: await poa.registry(),
        contractOwner: await poa.owner(),
      },
      state
    )
  }
}

const testPercent = async ({
  poa,
  totalAmount = new BigNumber(1e21),
  partOfTotalAmount = new BigNumber(8e20),
} = {}) => {
  const precisionOfPercentCalc = parseInt(
    (await poa.precisionOfPercentCalc.call()).toString()
  )
  const percentage = await poa.percent.call(
    partOfTotalAmount,
    totalAmount,
    precisionOfPercentCalc
  )
  const expectedPercentage = percentBigInt(
    partOfTotalAmount,
    totalAmount,
    precisionOfPercentCalc
  )

  assert.equal(
    percentage.toString(),
    expectedPercentage.toString(),
    'Percentage calculated by the contract is not the same with the expected'
  )
}

const getRemainingAmountInCentsDuringFiatFunding = async poa => {
  const fundingGoalInCents = await poa.fundingGoalInCents()
  const fundedFiatAmount = await poa.fundedFiatAmountInCents()
  const remainingAmount = fundingGoalInCents.sub(fundedFiatAmount)

  return remainingAmount
}

const getRemainingAmountInWeiDuringEthFunding = async poa => {
  const fundedEthAmountInWei = await poa.fundedEthAmountInWei()
  const fundingGoalInCents = await poa.fundingGoalInCents()
  const fundingGoalInWei = await poa.fiatCentsToWei(fundingGoalInCents)
  const fundedFiatAmount = await poa.fundedFiatAmountInCents()
  const fundedFiatAmountInWei = await poa.fiatCentsToWei(fundedFiatAmount)
  const remainingBuyableEth = fundingGoalInWei
    .sub(fundedEthAmountInWei)
    .sub(fundedFiatAmountInWei)

  return remainingBuyableEth
}

module.exports = {
  accounts,
  actRate,
  bbkBonusAddress,
  bbkContributors,
  bbkTokenDistAmount,
  issuer,
  custodian,
  defaultActivationDuration,
  defaultBuyAmount,
  defaultFiatCurrency,
  defaultFiatCurrency32,
  defaultFiatRate,
  defaultPenalizedFiatRate,
  defaultFiatRatePenalty,
  defaultFundingGoal,
  defaultFiatFundingDuration,
  defaultEthFundingDuration,
  defaultIpfsHash,
  defaultIpfsHashArray32,
  defaultName,
  defaultName32,
  defaultSymbol,
  defaultSymbol32,
  defaultTotalSupply,
  emptyBytes32,
  getAccountInformation,
  getDefaultStartTimeForFundingPeriod,
  getExpectedTokenAmount,
  getRemainingAmountInCentsDuringFiatFunding,
  getRemainingAmountInWeiDuringEthFunding,
  newIpfsHash,
  newIpfsHashArray32,
  owner,
  setupEcosystem,
  setupPoaProxyAndEcosystem,
  stages,
  testActivate,
  testActiveBalances,
  testApprove,
  testIssuerClaim,
  testBuyRemainingTokens,
  testBuyTokens,
  testBuyTokensMulti,
  testBuyTokensWithFiat,
  testCalculateFee,
  testCancelFunding,
  testChangeCustodianAddress,
  testClaim,
  testClaimAllPayouts,
  testCurrentPayout,
  testFallback,
  testFiatCentsToWei,
  testFirstReclaim,
  testIncrementOfBalanceWhenBuyTokensWithFiat,
  testInitialization,
  testPause,
  testPaused,
  testPayActivationFee,
  testPayout,
  testPercent,
  testProxyInitialization,
  testProxyUnchanged,
  testReclaim,
  testReclaimAll,
  testRemoveTokensWithFiat,
  testResetCurrencyRate,
  testSetCurrencyRate,
  testSetCurrencyRateWithDefaultValues,
  testManualCheckForTimeout,
  testStartPreFunding,
  testStartEthSale,
  testStartFiatSale,
  testTerminate,
  testTransfer,
  testTransferFrom,
  testUnpause,
  testUpdateIssuerAddress,
  testUpdateDurationForActivationPeriod,
  testUpdateDurationForEthFundingPeriod,
  testUpdateDurationForFiatFundingPeriod,
  testUpdateFiatCurrency,
  testUpdateFundingGoalInCents,
  testUpdateName,
  testUpdateProofOfCustody,
  testUpdateSymbol,
  testUpdateStartTimeForFundingPeriod,
  testUpdateTotalSupply,
  testWeiToFiatCents,
  timeTravelToFundingPeriod,
  timeTravelToEthFundingPeriod,
  timeTravelToFundingPeriodTimeout,
  timeTravelToActivationPeriodTimeout,
  whitelistedEthInvestors,
  whitelistedFiatInvestor,
}
