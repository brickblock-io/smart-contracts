const AccessToken = artifacts.require('BrickblockAccessToken')
const ContractRegistry = artifacts.require('BrickblockContractRegistry')
const ExchangeRateProvider = artifacts.require('ExchangeRateProviderStub')
const ExchangeRates = artifacts.require('ExchangeRates')
const FeeManager = artifacts.require('BrickblockFeeManager')
const Logger = artifacts.require('BrickblockLogger')
const PoaManager = artifacts.require('PoaManager')
const PoaManagerStub = artifacts.require('PoaManagerStub')
const PoaToken = artifacts.require('PoaToken')
const Whitelist = artifacts.require('BrickblockWhitelist')

const assert = require('assert')
const {
  areInRange,
  bigZero,
  gasPrice,
  getEtherBalance,
  getGasUsed,
  sendTransaction,
  testWillThrow,
  timeTravel,
  waitForEvent
} = require('./general')
const { finalizedBBK } = require('./bbk')
const { testApproveAndLockMany } = require('./act')
const {
  testSetCurrencySettings,
  testFetchRate,
  testSetRate,
  testSetQueryId
} = require('./exr')
const BigNumber = require('bignumber.js')

const accounts = web3.eth.accounts
const owner = accounts[0]
const broker = accounts[1]
const custodian = accounts[2]
const bbkBonusAddress = accounts[3]
const bbkContributors = accounts.slice(4, 6)
// overlap with bbkContributors... need more than 2 buyer accounts
const whitelistedPoaBuyers = accounts.slice(4, 9)
const bbkTokenDistAmount = new BigNumber(1e18)
const actRate = new BigNumber(1e3)
const defaultName = 'TestPoa'
const defaultSymbol = 'TPA'
const defaultFiatCurrency = 'EUR'
const defaultFundingTimeout = new BigNumber(60 * 60 * 24)
const defaultActivationTimeout = new BigNumber(60 * 60 * 24 * 7)
const defaultFundingGoal = new BigNumber(5e5)
const defaultTotalSupply = new BigNumber(1e23)
const defaultFiatRate = new BigNumber(33333)
const defaultIpfsHash = 'QmSUfCtXgb59G9tczrz2WuHNAbecV55KRBGXBbZkou5RtE'
const defaultBuyAmount = new BigNumber(1e18)
const getDefaultStartTime = async () => {
  const currentBlock = await web3.eth.getBlock(web3.eth.blockNumber)
  const blockTime = new BigNumber(currentBlock.timestamp)
  const realTime = new BigNumber(Date.now()).div(1000).floor()

  return blockTime.greaterThan(realTime) ? blockTime.add(60) : realTime.add(60)
}

const determineNeededTimeTravel = async poa => {
  const startTime = await poa.startTime()
  const currentBlock = await web3.eth.getBlock(web3.eth.blockNumber)
  const blockNow = new BigNumber(currentBlock.timestamp)
  return blockNow.greaterThan(startTime)
    ? 0
    : startTime
        .sub(blockNow)
        .add(1)
        .toNumber()
}

// sets up all contracts needed in the ecosystem for poa to function
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

  if (actRate.greaterThan(0)) {
    await exr.setActRate(actRate)
    const postActRate = await exr.getRate('ACT')

    assert.equal(
      postActRate.toString(),
      actRate.toString(),
      'ACT rate should be set'
    )
  }

  const exp = await ExchangeRateProvider.new(reg.address)
  const fmr = await FeeManager.new(reg.address)
  const wht = await Whitelist.new(reg.address)
  const pmr = await PoaManager.new(reg.address)
  const log = await Logger.new(reg.address)

  for (const buyer of whitelistedPoaBuyers) {
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
  await reg.updateContractAddress('Logger', log.address)

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
    log
  }
}

const testSetCurrencyRate = async (exr, exp, currencyType, rate, config) => {
  const callInterval = new BigNumber(30)
  const queryString = 'https://domain.com?currency=ETH'
  const callbackGasLimit = new BigNumber(1.5e5)
  await testSetCurrencySettings(
    exr,
    currencyType,
    callInterval,
    callbackGasLimit,
    queryString,
    {
      from: config.from
    }
  )

  await testFetchRate(exr, exp, currencyType, config)

  await testSetRate(exr, exp, rate, false)
}

const setupPoaAndEcosystem = async () => {
  const { reg, act, bbk, exr, exp, fmr, wht, pmr, log } = await setupEcosystem()

  await testSetCurrencyRate(exr, exp, defaultFiatCurrency, defaultFiatRate, {
    from: owner,
    value: 1e18
  })

  const poa = await PoaToken.new()

  await pmr.setupPoaToken(
    poa.address,
    defaultName,
    defaultSymbol,
    defaultFiatCurrency,
    broker,
    custodian,
    defaultTotalSupply,
    await getDefaultStartTime(),
    defaultFundingTimeout,
    defaultActivationTimeout,
    defaultFundingGoal
  )

  // we change the PoaManager to owner address in registry in order to "trick"
  // the only owner function so that testing is easier registry address
  // in the contract remains the same
  await reg.updateContractAddress('PoaManager', owner)

  return {
    act,
    bbk,
    exp,
    exr,
    fmr,
    log,
    pmr,
    poa,
    reg,
    wht
  }
}

const setupPoaProxyAndEcosystem = async () => {
  const { reg, act, bbk, exr, exp, fmr, wht, pmr, log } = await setupEcosystem()

  await testSetCurrencyRate(exr, exp, defaultFiatCurrency, defaultFiatRate, {
    from: owner,
    value: 1e18
  })

  // deploy poa master in order to allow proxies to use it's code
  const poam = await PoaToken.new()
  // add to registry for use by PoaManager and PoaToken proxies
  await reg.updateContractAddress('PoaTokenMaster', poam.address)

  // add broker to allow for adding a new token from PoaManager
  await pmr.addBroker(broker)

  // Poa Proxy contract
  const poaTx = await pmr.addToken(
    defaultName,
    defaultSymbol,
    defaultFiatCurrency,
    custodian,
    defaultTotalSupply,
    await getDefaultStartTime(),
    defaultFundingTimeout,
    defaultActivationTimeout,
    defaultFundingGoal,
    {
      from: broker
    }
  )

  // wrap the proxied PoA in PoaToken ABI to call as if regular PoA
  const poa = await PoaToken.at(poaTx.logs[0].args.token)
  // trick the proxyPoa into thinking that PoaManager is owner
  // this makes it easier to test with a regular account
  // PoaManager only functions are tested in PoaManager tests as
  // actual PoaManager as well
  await reg.updateContractAddress('PoaManager', owner)
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
    poam,
    log
  }
}

const testProxyInitialization = async (reg, pmr, args) => {
  // list broker
  await pmr.addBroker(broker)
  // create new master poa
  const poam = await PoaToken.new()
  // add poa master to registry
  await reg.updateContractAddress('PoaTokenMaster', poam.address)

  const defaultStartTime = await getDefaultStartTime()

  // Poa Proxy contract tx
  const poaTx = await pmr.addToken.apply(null, args)

  // wrap the proxied PoA in PoaToken ABI to call as if regular PoA
  const poa = await PoaToken.at(poaTx.logs[0].args.token)

  const name = await poa.name()
  const symbol = await poa.symbol()
  const proofOfCustody = await poa.proofOfCustody()
  const fiatCurrency = await poa.fiatCurrency()
  const actualBroker = await poa.broker()
  const actualCustodian = await poa.custodian()
  const decimals = await poa.decimals()
  const feeRate = await poa.feeRate()
  const startTime = await poa.startTime()
  const fundingTimeout = await poa.fundingTimeout()
  const fundingGoalInCents = await poa.fundingGoalInCents()
  const totalPerTokenPayout = await poa.totalPerTokenPayout()
  const fundedAmountInWei = await poa.fundedAmountInWei()
  const totalSupply = await poa.totalSupply()
  const contractBalance = await poa.balanceOf(poa.address)
  const stage = await poa.stage()
  const paused = await poa.paused()
  const whitelistTransfers = await poa.whitelistTransfers()
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
    actualBroker,
    broker,
    'actualBroker should match broker in constructor'
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
    feeRate.toString(),
    new BigNumber(5).toString(),
    'fee rate should be a constant of 5'
  )
  assert.equal(
    fundingTimeout.toString(),
    defaultFundingTimeout.toString(),
    'fundingTimeout should match that given in constructor'
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
    fundedAmountInWei.toString(),
    bigZero.toString(),
    'fundedAmountInWei should start uninitialized'
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
  assert.equal(contractOwner, pmr.address, 'the owner should be pmr')
  assert(paused, 'contract should start paused')
  assert(
    !whitelistTransfers,
    'contract should start not requiring whitelisted for transfers'
  )
  assert(
    areInRange(startTime, defaultStartTime, 1),
    'startTime should match startTime given in constructor'
  )

  return poa
}

const testInitialization = async (exr, exp, reg) => {
  await testSetCurrencyRate(exr, exp, defaultFiatCurrency, defaultFiatRate, {
    from: owner,
    value: 1e18
  })

  const defaultStartTime = await getDefaultStartTime()

  // poa needs registry returned from creating contract
  // this stub allows for that without having to deploy through proxy
  const pmrs = await PoaManagerStub.new(reg.address)
  reg.updateContractAddress('PoaManager', pmrs.address)

  const poa = await PoaToken.new()

  await pmrs.setupPoaToken(
    poa.address,
    defaultName,
    defaultSymbol,
    defaultFiatCurrency,
    broker,
    custodian,
    defaultTotalSupply,
    defaultStartTime,
    defaultFundingTimeout,
    defaultActivationTimeout,
    defaultFundingGoal
  )

  const name = await poa.name()
  const symbol = await poa.symbol()
  const proofOfCustody = await poa.proofOfCustody()
  const fiatCurrency = await poa.fiatCurrency()
  const actualBroker = await poa.broker()
  const actualCustodian = await poa.custodian()
  const decimals = await poa.decimals()
  const feeRate = await poa.feeRate()
  const startTime = await poa.startTime()
  const fundingTimeout = await poa.fundingTimeout()
  const fundingGoalInCents = await poa.fundingGoalInCents()
  const totalPerTokenPayout = await poa.totalPerTokenPayout()
  const fundedAmountInWei = await poa.fundedAmountInWei()
  const totalSupply = await poa.totalSupply()
  const contractBalance = await poa.balanceOf(poa.address)
  const stage = await poa.stage()
  const paused = await poa.paused()
  const whitelistTransfers = await poa.whitelistTransfers()
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
    actualBroker,
    broker,
    'actualBroker should match broker in constructor'
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
    feeRate.toString(),
    new BigNumber(5).toString(),
    'fee rate should be a constant of 5'
  )
  assert.equal(
    startTime.toString(),
    defaultStartTime.toString(),
    'startTime should match startTime given in constructor'
  )
  assert.equal(
    fundingTimeout.toString(),
    defaultFundingTimeout.toString(),
    'fundingTimeout should match that given in constructor'
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
    fundedAmountInWei.toString(),
    bigZero.toString(),
    'fundedAmountInWei should start uninitialized'
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
  assert.equal(
    contractOwner,
    pmrs.address,
    'the owner should be PoaManagerStub'
  )
  assert(paused, 'contract should start paused')
  assert(
    !whitelistTransfers,
    'contract should start not requiring whitelisted for transfers'
  )

  return poa
}

const testWeiToFiatCents = async (poa, weiInput) => {
  const expectedFiat = weiInput
    .mul(defaultFiatRate)
    .div(1e18)
    .floor()

  const actualFiat = await poa.weiToFiatCents(weiInput)

  assert.equal(
    expectedFiat.toString(),
    actualFiat.toString(),
    'weiInput converted to actualFiat should match expectedFiat'
  )
}

const testFiatCentsToWei = async (poa, fiatCentInput) => {
  const expectedWei = fiatCentInput
    .mul(1e18)
    .div(defaultFiatRate)
    .floor()

  const actualWei = await poa.fiatCentsToWei(fiatCentInput)

  assert.equal(
    expectedWei.toString(),
    actualWei.toString(),
    'fiatCentInput converted to actualWei should match expectedWei'
  )
}

const testCalculateFee = async (poa, taxableValue) => {
  const feeRate = await poa.feeRate()
  const expectedFee = feeRate
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

const testStartSale = async (poa, config) => {
  const preStage = await poa.stage()

  await poa.startSale(config ? config : { from: owner })

  const postStage = await poa.stage()

  assert.equal(
    preStage.toString(),
    bigZero.toString(),
    'stage should start as 0, PreFunding'
  )
  assert.equal(
    postStage.toString(),
    new BigNumber(1).toString(),
    'stage should start as 1, Funding'
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
  const preFundedAmount = await poa.fundedAmountInWei()
  const preUserWeiInvested = await poa.investmentAmountPerUserInWei(buyer)
  const BuyEvent = poa.BuyEvent()
  const tx = await poa.buy(config)
  const { args: triggeredEvent } = await waitForEvent(BuyEvent)
  const gasUsed = await getGasUsed(tx)
  const gasCost = new BigNumber(gasUsed).mul(config.gasPrice)

  const postEthBalance = await getEtherBalance(buyer)
  const postTokenBalance = await poa.balanceOf(buyer)
  const postFundedAmount = await poa.fundedAmountInWei()
  const postUserWeiInvested = await poa.investmentAmountPerUserInWei(buyer)

  const expectedPostEthBalance = preEthBalance.sub(weiBuyAmount).sub(gasCost)

  assert.equal(
    triggeredEvent.buyer,
    config.from,
    'buy event buyer should be equal to config.from'
  )
  assert.equal(
    triggeredEvent.amount.toString(),
    config.value.toString(),
    'buy event amount should be equal to config.value'
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
    'token balance should be 0 before Active stage even after buying'
  )
  assert.equal(
    postFundedAmount.sub(preFundedAmount).toString(),
    weiBuyAmount.toString(),
    'fiat fundedAmountInWei should be incremented by eth wei amount'
  )
  assert.equal(
    postUserWeiInvested.sub(preUserWeiInvested).toString(),
    weiBuyAmount.toString(),
    'userWeiInvested should be incremented for the buying user'
  )

  return postUserWeiInvested
}

const testBuyTokensMulti = async (poa, buyAmount) => {
  for (const buyer of whitelistedPoaBuyers) {
    await testBuyTokens(poa, { from: buyer, value: buyAmount, gasPrice })
  }
}

const testBuyRemainingTokens = async (poa, config) => {
  assert(!!config.gasPrice, 'gasPrice must be given')
  assert(!!config.from, 'from must be given')

  const preUserWeiInvested = await poa.investmentAmountPerUserInWei(config.from)
  const fundedAmountInWei = await poa.fundedAmountInWei()
  const fundingGoalInCents = await poa.fundingGoalInCents()
  const fundingGoalWei = await poa.fiatCentsToWei(fundingGoalInCents)
  const remainingBuyableEth = fundingGoalWei.sub(fundedAmountInWei)

  config.value = remainingBuyableEth
  const buyer = config.from
  const weiBuyAmount = new BigNumber(config.value)
  const preStage = await poa.stage()

  const preEthBalance = await getEtherBalance(buyer)
  const preTokenBalance = await poa.balanceOf(buyer)
  const preFundedWei = await poa.fundedAmountInWei()
  const tx = await poa.buy(config)
  const gasUsed = await getGasUsed(tx)
  const gasCost = new BigNumber(gasUsed).mul(config.gasPrice)

  const postUserWeiInvested = await poa.investmentAmountPerUserInWei(
    config.from
  )
  const postEthBalance = await getEtherBalance(buyer)
  const postTokenBalance = await poa.balanceOf(buyer)
  const postFundedWei = await poa.fundedAmountInWei()

  const expectedPostEthBalance = preEthBalance.sub(weiBuyAmount).sub(gasCost)
  const postFundedFiatCents = await poa.weiToFiatCents(postFundedWei)
  const postStage = await poa.stage()

  assert.equal(
    postUserWeiInvested.sub(preUserWeiInvested).toString(),
    remainingBuyableEth.toString(),
    'investmentAmountPerUserInWei should be incremented by remainingBuyableEth'
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
    'token balance should be 0 even after buying all remaining and entering Pending stage'
  )
  assert.equal(
    postFundedWei.sub(preFundedWei).toString(),
    weiBuyAmount.toString(),
    'fiat fundedAmountInWei should be incremented by fiatBuyAmount'
  )
  assert(
    areInRange(fundingGoalInCents, postFundedFiatCents, 1),
    'fundedAmount in fiat cents should be within 1 cent of fundingGoalCents'
  )
  assert.equal(
    preStage.toString(),
    new BigNumber(1).toString(),
    'stage should be 1, Funding'
  )
  assert.equal(
    postStage.toString(),
    new BigNumber(2).toString(),
    'stage should be 2, Pending'
  )

  return postUserWeiInvested
}

const testActivate = async (poa, fmr, ipfsHash, config) => {
  const contractBalance = await getEtherBalance(poa.address)
  const calculatedFee = await poa.calculateFee(contractBalance)

  const preFeeManagerBalance = await getEtherBalance(fmr.address)
  const preStage = await poa.stage()
  const preCustody = await poa.proofOfCustody()
  const prePaused = await poa.paused()
  const preBrokerPayouts = await poa.currentPayout(broker, true)
  await poa.activate(ipfsHash, config)
  const postFeeManagerBalance = await getEtherBalance(fmr.address)
  const postStage = await poa.stage()
  const postCustody = await poa.proofOfCustody()
  const postPaused = await poa.paused()
  const postBrokerPayouts = await poa.currentPayout(broker, true)

  assert.equal(
    postFeeManagerBalance.sub(preFeeManagerBalance).toString(),
    calculatedFee.toString(),
    'feeManager ether balance should be incremented by paid fee'
  )
  assert.equal(
    preStage.toString(),
    new BigNumber(2),
    'preStage should be 2, Pending'
  )
  assert.equal(
    postStage.toString(),
    new BigNumber(4),
    'postStage should be 4, Active'
  )
  assert.equal(preCustody, '', 'proofOfCustody should start empty')
  assert.equal(
    postCustody,
    ipfsHash,
    'proofOfCustody should be set to ipfsHash'
  )
  assert(prePaused, 'should be paused before activation')
  assert(!postPaused, 'should not be paused after activation')
  assert.equal(
    postBrokerPayouts.sub(preBrokerPayouts).toString(),
    contractBalance.sub(calculatedFee).toString(),
    'contract balance after fee has been paid should be claimable by broker'
  )
}

const testBrokerClaim = async poa => {
  const preContractBalance = await getEtherBalance(poa.address)
  const preBrokerBalance = await getEtherBalance(broker)

  const tx = await poa.claim({ from: broker, gasPrice })

  const postContractBalance = await getEtherBalance(poa.address)
  const postBrokerBalance = await getEtherBalance(broker)
  const gasUsed = await getGasUsed(tx)
  const expectedPostBrokerBalance = preBrokerBalance
    .add(preContractBalance)
    .sub(new BigNumber(gasUsed).mul(gasPrice))

  assert.equal(
    postBrokerBalance.toString(),
    expectedPostBrokerBalance.toString(),
    'postBrokerBalance should match expectedPostBrokerBalance'
  )
  assert.equal(
    postContractBalance.toString(),
    bigZero.toString(),
    'postContractBalance should be 0'
  )
}

const testPayout = async (poa, fmr, config) => {
  assert(config.from, 'from not included in config!')
  assert(config.value, 'value not included in config!')
  assert(config.gasPrice, 'gasPrice not included in config!')
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
  const postCustodianEtherBalance = await getEtherBalance(custodian)
  const expectedCustodianEtherBalance = preCustodianEtherBalance
    .sub(gasPrice.mul(gasUsed))
    .sub(payoutValue)
  const postContractEtherBalance = await getEtherBalance(poa.address)
  const expectedContractEtherBalance = payoutValue.sub(fee)
  const postFeeManagerEtherBalance = await getEtherBalance(fmr.address)

  assert.equal(
    postContractTotalTokenPayout.toString(),
    expectedContractTotalTokenPayout.toString(),
    'totalPerTokenPayout should match the expected value'
  )
  assert.equal(
    expectedCustodianEtherBalance.toString(),
    postCustodianEtherBalance.toString(),
    'expected custodian ether balance should match actual after payout'
  )
  assert.equal(
    postContractEtherBalance.sub(preContractEtherBalance).toString(),
    expectedContractEtherBalance.toString(),
    'contact ether balance should be incremented by the payoutValue sub fees'
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
    gasPrice
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
    isTerminated ? new BigNumber(5).toString() : new BigNumber(4).toString(),
    `stage should be in ${isTerminated ? 5 : 4}, Active`
  )
}

const testClaimAllPayouts = async (poa, poaTokenHolders) => {
  const stage = await poa.stage()
  assert.equal(
    stage.toString(),
    new BigNumber(4).toString(),
    'stage should be in 4, Active'
  )

  let totalClaimAmount = bigZero

  for (const tokenHolder of poaTokenHolders) {
    const tokenHolderClaimAmount = await poa.currentPayout(tokenHolder, true)
    const preTokenHolderEtherBalance = await getEtherBalance(tokenHolder)
    const preContractEtherBalance = await getEtherBalance(poa.address)

    if (tokenHolderClaimAmount.greaterThan(0)) {
      const tx = await poa.claim({
        from: tokenHolder,
        gasPrice
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

const testFirstReclaim = async (poa, config, shouldBePending) => {
  const preStage = await poa.stage()

  assert.equal(
    preStage.toString(),
    shouldBePending ? new BigNumber(2).toString() : new BigNumber(1).toString(),
    `contract should be in stage ${
      shouldBePending ? '1 (funding)' : ' 2 (pending)'
    } before reclaiming`
  )

  await testReclaim(poa, config, true)

  const postStage = await poa.stage()

  assert.equal(
    postStage.toNumber(),
    3,
    'the contract should be in stage 2 (failed) after reclaiming'
  )
}

const fundingTimeoutContract = async poa => {
  const fundingTimeout = await poa.fundingTimeout()
  await timeTravel(fundingTimeout.toNumber())
}

const activationTimeoutContract = async poa => {
  const activationTimeout = await poa.activationTimeout()
  const fundingTimeout = await poa.fundingTimeout()
  await timeTravel(fundingTimeout.add(activationTimeout).toNumber())
}

const testSetFailed = async (poa, shouldBePending) => {
  const preStage = await poa.stage()

  await poa.setFailed()

  const postStage = await poa.stage()

  assert.equal(
    preStage.toString(),
    shouldBePending ? new BigNumber(2).toString() : new BigNumber(1).toString(),
    `preStage should be ${shouldBePending ? '2, Pending' : '1 Funding'}`
  )

  assert.equal(
    postStage.toString(),
    new BigNumber(3).toString(),
    'postStage should be 3, Failed'
  )
}

const testReclaim = async (poa, config, first = false) => {
  const claimer = config.from

  const preTotalSupply = await poa.totalSupply()
  const preContractEtherBalance = await getEtherBalance(poa.address)
  const preClaimerTokenBalance = await poa.balanceOf(claimer)
  const preClaimerEtherBalance = await getEtherBalance(claimer)
  const preFundedAmountInWei = await poa.fundedAmountInWei()
  const preOutstandingEtherBalance = await poa.investmentAmountPerUserInWei(
    claimer
  )

  const tx = await poa.reclaim({
    from: claimer,
    gasPrice
  })
  const gasUsed = await getGasUsed(tx)
  const gasCost = gasPrice.mul(gasUsed)

  const postTotalSupply = await poa.totalSupply()
  const postContractEtherBalance = await getEtherBalance(poa.address)
  const postClaimerTokenBalance = await poa.balanceOf(claimer)
  const postClaimerEtherBalance = await getEtherBalance(claimer)
  const postFundedAmountInWei = await poa.fundedAmountInWei()
  const postOutstandingEtherBalance = await poa.investmentAmountPerUserInWei(
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
    'fundedAmountInWei should be decremented by claimed ether amount'
  )
  assert.equal(
    preContractEtherBalance.sub(postContractEtherBalance).toString(),
    preOutstandingEtherBalance.toString(),
    'contract ether balance should be decremented by claimed outstanding balance'
  )
  assert.equal(
    preClaimerTokenBalance.toString(),
    bigZero.toString(),
    'claimer token balance should be 0 unless reaching  Funding stage'
  )
  assert.equal(
    postClaimerTokenBalance.toString(),
    bigZero.toString(),
    'claimer token balance should be 0 unless reaching Funding stage'
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
    const claimableBalance = await poa.investmentAmountPerUserInWei(tokenBuyer)
    if (claimableBalance.greaterThan(0)) {
      await testReclaim(poa, { from: tokenBuyer })
    }
  }

  const finalContractTotalSupply = await poa.totalSupply()
  const finalContractEtherBalance = await getEtherBalance(poa.address)
  const finalFundedAmountInWei = await poa.fundedAmountInWei()

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
    'fundedAmountInWei should be 0 after all have reclaimed'
  )
}

const testPaused = async (poa, shouldBePaused) => {
  const paused = await poa.paused()
  assert(shouldBePaused ? paused : !paused, 'contract should be paused')
}

const testPause = async (poa, config) => {
  await poa.pause(config)
  await testPaused(poa, true)
}

const testUnpause = async (poa, config) => {
  await poa.unpause(config)
  await testPaused(poa, false)
}

const testFallback = async config => {
  await testWillThrow(sendTransaction, [web3, config])
}

const testUpdateProofOfCustody = async (poa, ipfsHash, config) => {
  const preIpfsHash = await poa.proofOfCustody()

  await poa.updateProofOfCustody(ipfsHash, config)

  const postIpfsHash = await poa.proofOfCustody()

  assert(preIpfsHash != postIpfsHash, 'should not be same ipfsHash')
  assert.equal(postIpfsHash, ipfsHash, 'new ifpsHash should be set in contract')
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

const testTerminate = async (poa, config) => {
  const preStage = await poa.stage()

  await poa.terminate(config)

  const postStage = await poa.stage()

  assert.equal(
    preStage.toString(),
    new BigNumber(4).toString(),
    'preStage should be 4, Active'
  )
  assert.equal(
    postStage.toString(),
    new BigNumber(5).toString(),
    'postStage should be 5, Terminated'
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
    currentPayout
  }
}

const testResetCurrencyRate = async (exr, exp, currencyType, rate) => {
  await testSetQueryId(exr, exp, currencyType)
  await testSetRate(exr, exp, rate, false)
}

const testActiveBalances = async (poa, commitments) => {
  const totalSupply = await poa.totalSupply()
  const fundedAmountInWei = await poa.fundedAmountInWei()
  let tokenBalanceTotal = bigZero

  for (const commitment of commitments) {
    const { address, amount } = commitment
    const tokenBalance = await poa.balanceOf(address)
    const expectedBalance = amount.mul(totalSupply).div(fundedAmountInWei)
    tokenBalanceTotal = tokenBalanceTotal.add(tokenBalance)

    assert(
      areInRange(tokenBalance, expectedBalance, 1),
      'token balance should be within 1 wei of expectedBalance'
    )
  }

  assert(
    areInRange(tokenBalanceTotal, totalSupply, commitments.length),
    'totalSupply should be within 1 wei of tokenBalanceTotal'
  )
}

const testToggleWhitelistTransfers = async (poa, config) => {
  const preWhitelistTransfers = await poa.whitelistTransfers()

  await poa.toggleWhitelistTransfers(config)

  const postWhitelistTransfers = await poa.whitelistTransfers()

  assert(
    preWhitelistTransfers != postWhitelistTransfers,
    'whitelistTransfers should be toggled'
  )

  return postWhitelistTransfers
}

const testProxyUnchanged = async (poa, first, state) => {
  if (first) {
    return {
      name: await poa.name(),
      symbol: await poa.symbol(),
      proofOfCustody: await poa.proofOfCustody(),
      fiatCurrency: await poa.fiatCurrency(),
      actualBroker: await poa.broker(),
      actualCustodian: await poa.custodian(),
      decimals: await poa.decimals(),
      feeRate: await poa.feeRate(),
      startTime: await poa.startTime(),
      fundingTimeout: await poa.fundingTimeout(),
      fundingGoalInCents: await poa.fundingGoalInCents(),
      totalPerTokenPayout: await poa.totalPerTokenPayout(),
      fundedAmountInWei: await poa.fundedAmountInWei(),
      totalSupply: await poa.totalSupply(),
      contractBalance: await poa.balanceOf(await poa.address),
      stage: await poa.stage(),
      paused: await poa.paused(),
      whitelistTransfers: await poa.whitelistTransfers(),
      registry: await poa.registry(),
      contractOwner: await poa.owner()
    }
  } else {
    assert.deepEqual(
      {
        name: await poa.name(),
        symbol: await poa.symbol(),
        proofOfCustody: await poa.proofOfCustody(),
        fiatCurrency: await poa.fiatCurrency(),
        actualBroker: await poa.broker(),
        actualCustodian: await poa.custodian(),
        decimals: await poa.decimals(),
        feeRate: await poa.feeRate(),
        startTime: await poa.startTime(),
        fundingTimeout: await poa.fundingTimeout(),
        fundingGoalInCents: await poa.fundingGoalInCents(),
        totalPerTokenPayout: await poa.totalPerTokenPayout(),
        fundedAmountInWei: await poa.fundedAmountInWei(),
        totalSupply: await poa.totalSupply(),
        contractBalance: await poa.balanceOf(await poa.address),
        stage: await poa.stage(),
        paused: await poa.paused(),
        whitelistTransfers: await poa.whitelistTransfers(),
        registry: await poa.registry(),
        contractOwner: await poa.owner()
      },
      state
    )
  }
}

module.exports = {
  accounts,
  activationTimeoutContract,
  actRate,
  bbkBonusAddress,
  bbkContributors,
  bbkTokenDistAmount,
  broker,
  custodian,
  defaultActivationTimeout,
  defaultBuyAmount,
  defaultFiatCurrency,
  defaultFiatRate,
  defaultFundingGoal,
  defaultFundingTimeout,
  defaultIpfsHash,
  defaultName,
  defaultSymbol,
  defaultTotalSupply,
  determineNeededTimeTravel,
  fundingTimeoutContract,
  getAccountInformation,
  getDefaultStartTime,
  owner,
  setupEcosystem,
  setupPoaAndEcosystem,
  setupPoaProxyAndEcosystem,
  testActivate,
  testActiveBalances,
  testApprove,
  testBrokerClaim,
  testBuyRemainingTokens,
  testBuyTokens,
  testBuyTokensMulti,
  testCalculateFee,
  testChangeCustodianAddress,
  testClaim,
  testClaimAllPayouts,
  testCurrentPayout,
  testFallback,
  testFiatCentsToWei,
  testFirstReclaim,
  testInitialization,
  testPause,
  testPaused,
  testPayout,
  testProxyInitialization,
  testProxyUnchanged,
  testReclaim,
  testReclaimAll,
  testResetCurrencyRate,
  testSetCurrencyRate,
  testSetFailed,
  testStartSale,
  testTerminate,
  testToggleWhitelistTransfers,
  testTransfer,
  testTransferFrom,
  testUnpause,
  testUpdateProofOfCustody,
  testWeiToFiatCents,
  timeTravel,
  whitelistedPoaBuyers
}
