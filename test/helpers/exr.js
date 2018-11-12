const assert = require('assert')
const BigNumber = require('bignumber.js')
const ExchangeRates = artifacts.require('ExchangeRates')
const ExchangeRateProvider = artifacts.require(
  './stubs/ExchangeRateProviderStub'
)
const Registry = artifacts.require('ContractRegistry')
const {
  sendTransaction,
  getEtherBalance,
  getGasUsed,
  waitForTxToBeMined,
} = require('./general')

const trimBytes = string => string.replace(/\0/g, '')

const setupContracts = async () => {
  const reg = await Registry.new()
  const exr = await ExchangeRates.new(reg.address)
  const exp = await ExchangeRateProvider.new(reg.address)
  await reg.updateContractAddress('ExchangeRates', exr.address)
  await reg.updateContractAddress('ExchangeRateProvider', exp.address)

  return {
    reg,
    exr,
    exp,
  }
}

const testUninitializedSettings = async exr => {
  const [
    preCallInterval,
    preCallbackGasLimit,
    preQueryString,
    preRatePenalty,
  ] = await exr.getCurrencySettings('USD')

  assert.equal(
    preCallInterval.toString(),
    new BigNumber(0).toString(),
    'callInterval should start uninitialized'
  )
  assert.equal(
    preCallbackGasLimit.toString(),
    new BigNumber(0).toString(),
    'callbackGasLimit should start uninitialized'
  )
  assert.equal(preQueryString, '', 'queryString should start uninitialized')
  assert.equal(
    preRatePenalty.toString(),
    new BigNumber(0).toString(),
    'ratePenalty should start uninitialized'
  )
}

const testSetCurrencySettings = async (
  exr,
  queryType,
  callInterval,
  callbackGasLimit,
  queryString,
  ratePenalty,
  config
) => {
  const [
    preCallInterval,
    preCallbackGasLimit,
    preQueryString,
    preRatePenalty,
  ] = await exr.getCurrencySettings(queryType)

  await exr.setCurrencySettings(
    queryType,
    queryString,
    callInterval,
    callbackGasLimit,
    ratePenalty,
    config
  )

  const [
    postCallInterval,
    postCallbackGasLimit,
    postQueryString,
    postRatePenalty,
  ] = await exr.getCurrencySettings(queryType)

  assert(
    preCallInterval.toString() != postCallInterval.toString(),
    'postCallInterval should not match uninitialized value'
  )
  assert(
    preCallbackGasLimit.toString() != postCallbackGasLimit.toString(),
    'postCallbackGasLimit should not match uninitialized value'
  )
  assert(
    preQueryString != postQueryString,
    'postQueryString should not match uninitialized value'
  )
  assert(
    preRatePenalty != postRatePenalty,
    'postRatePenalty should not match uninitialized value'
  )

  assert.equal(
    postCallInterval.toString(),
    callInterval.toString(),
    'the postCallInterval should match the set value'
  )
  assert.equal(
    postCallbackGasLimit.toString(),
    callbackGasLimit.toString(),
    'the postCallbackGasLimit should match the set value'
  )
  assert.equal(
    postQueryString,
    queryString,
    'the postQueryString should match the set value'
  )
  assert.equal(
    postRatePenalty.toString(),
    ratePenalty.toString(),
    'the postRatePenalty should match the set value'
  )
}

const testSettingsExists = async (exr, queryType) => {
  const [
    callInterval,
    callbackGasLimit,
    queryString,
    ratePenalty,
  ] = await exr.getCurrencySettings(queryType)
  assert(callbackGasLimit.greaterThan(0), 'callbackGasLimit uninitialized')
  assert(queryString !== '', 'queryString uninitialized')
  if (callInterval.equals(0)) {
    // eslint-disable-next-line
    console.log('callInterval set to 0, are you sure this should be like this?')
  }

  if (ratePenalty.equals(0)) {
    // eslint-disable-next-line
    console.log('ratePenalty set to 0, are you sure this should be like this?')
  }
}

const testFetchRate = async (exr, exp, queryType, config) => {
  await testSettingsExists(exr, queryType)
  await exr.fetchRate(queryType, config)
  const pendingQueryId = await exp.pendingTestQueryId()
  const queryTypeByPendingQueryId = await exr.queryTypes(pendingQueryId)

  assert.equal(
    queryType,
    queryTypeByPendingQueryId,
    'the queryType found by pendingQueryId should match given queryType'
  )
}

const testSetRate = async (
  exr,
  exp,
  rate,
  ratePenalty,
  isAfterClearRateIntervals
) => {
  const bigRate = new BigNumber(rate)
  const penalizedRate = bigRate.times(1000 - ratePenalty).dividedBy(1000)
  const prePendingQueryId = await exp.pendingTestQueryId()
  const queryType = await exr.queryTypes(prePendingQueryId)
  await exp.simulate__callback(prePendingQueryId, bigRate.toString())
  const postPendingQueryId = await exp.pendingTestQueryId()
  const actualRate = await exr.getRate(queryType)
  const actualRate32 = await exr.getRate32(
    web3.sha3(web3.toHex(queryType), { encoding: 'hex' })
  )
  // check on recursive callback settings
  const [
    callInterval,
    callbackGasLimit,
    queryString,
    actualRatePenalty,
  ] = await exr.getCurrencySettings(queryType)

  const shouldCallAgainWithQuery = await exp.shouldCallAgainWithQuery()
  const shouldCallAgainIn = await exp.shouldCallAgainIn()
  const shouldCallAgainWithGas = await exp.shouldCallAgainWithGas()
  if (isAfterClearRateIntervals) {
    assert(
      shouldCallAgainIn.greaterThan(0),
      'shouldCallAgainIn should NOT be cleared until next call'
    )
    assert(
      shouldCallAgainWithQuery.length > 0,
      'queryString should NOT be cleared until next call'
    )
    assert(
      shouldCallAgainWithGas.greaterThan(0),
      'callbackGasLimit should be cleared NOT be cleared until next call'
    )
    assert.equal(
      callInterval.toString(),
      new BigNumber(0).toString(),
      'callInterval be be cleared'
    )
  } else {
    assert.equal(
      shouldCallAgainIn.toString(),
      callInterval.toString(),
      'callInterval in settings should match shouldCallAgainIn'
    )
    assert.equal(
      shouldCallAgainWithQuery,
      queryString,
      'queryString should match shouldCallAgainWithQuery'
    )
    assert.equal(
      shouldCallAgainWithGas.toString(),
      callbackGasLimit.toString(),
      'callbackGasLimit should match shouldCallAgainWithGas'
    )
  }

  if (shouldCallAgainIn.greaterThan(0)) {
    assert(
      postPendingQueryId != prePendingQueryId,
      'prePendingQueryId should not equal postPendingQueryId'
    )
  } else {
    assert.equal(
      postPendingQueryId,
      '0x' + '00'.repeat(32),
      'the pending query id should be empty after callback completed'
    )
  }

  assert.equal(
    // toFixed(0, 1) simulates rounding down of integer divisions in Solidity
    penalizedRate.times(100).toFixed(0, 1),
    actualRate.toString(),
    'the rate on exr should match the penalized rate'
  )
  assert.equal(
    ratePenalty.toString(),
    actualRatePenalty.toString(),
    'the rate penalty on exr should match the set rate penalty'
  )
  assert.equal(
    actualRate.toString(),
    actualRate32.toString(),
    'rates using getRate and getRate32 should match'
  )
}

const testGetRate = async (exr, rate, queryType, ratePenalty) => {
  const bigRate = new BigNumber(rate)
  const penalizedRate = bigRate.times(1000 - ratePenalty).dividedBy(1000)
  const actualRate = await exr.getRate(queryType)
  assert.equal(
    penalizedRate.times(100).toFixed(0, 1),
    actualRate.toString(),
    'the rate should match the expected penalized rate'
  )
}

const testToggleRatesActive = async (exr, shouldBeActive, config) => {
  const preRatesActive = await exr.ratesActive()
  await exr.toggleRatesActive(config)
  const postRatesActive = await exr.ratesActive()

  if (shouldBeActive) {
    assert(shouldBeActive, 'ratesActive should be true')
  } else {
    assert(!shouldBeActive, 'ratesActive should NOT be true')
  }

  assert(preRatesActive != postRatesActive, 'preRatesActive should be toggled')
}

const testToUpperCase = async (exr, stringInput) => {
  const uppercase = await exr.toUpperCase(stringInput)

  assert.equal(
    stringInput.toUpperCase(),
    uppercase,
    'the returned string should be uppercase'
  )
}

const testToBytes32Array = async (exr, stringInput) => {
  const bytes32ArrayOutput = await exr.toBytes32Array(stringInput)
  const bytesArrayToString = bytes32ArrayOutput.reduce(
    (string, item) => trimBytes(string.concat(web3.toAscii(item))),
    ''
  )

  assert.equal(
    stringInput,
    bytesArrayToString,
    'the bytes32 array returned should convert back to the same string'
  )
}

const testSelfDestruct = async (exr, exp, caller) => {
  assert(
    caller != web3.eth.accounts[9],
    'please pick another account... cannot use this account for this test'
  )
  const funder = web3.eth.accounts[9]
  const preCallerBalance = await getEtherBalance(caller)
  const preCode = await web3.eth.getCode(exp.address)
  const gasPrice = web3.eth.gasPrice
  const initialTxHash = await sendTransaction(web3, {
    from: funder,
    to: exp.address,
    value: 1e18,
  })
  await waitForTxToBeMined(initialTxHash)
  const preKillContractBalance = await getEtherBalance(exp.address)
  const tx = await exr.killProvider(caller, { from: caller, gasPrice })
  const gasUsed = await getGasUsed(tx)
  const gasPaid = new BigNumber(gasUsed).mul(gasPrice)
  const expectedOwnerBalance = preCallerBalance.add(1e18).sub(gasPaid)
  const postCallerBalance = await getEtherBalance(caller)
  const postCode = await web3.eth.getCode(exp.address)

  assert(
    preCode !== '0x0' && preCode !== '0x',
    'the contract should have code at address before selfdestruct'
  )
  assert(
    postCode === '0x0' || postCode === '0x',
    'the contract should NOT have any code after selfDestruct'
  )

  assert.equal(
    preKillContractBalance.toString(),
    new BigNumber(1e18).toString(),
    'the balance of the contract should be 1e18'
  )
  assert.equal(
    expectedOwnerBalance.toString(),
    postCallerBalance.toString(),
    'the owner balance should match the expected balance after self destruction'
  )
}

// FIXME: This test is flaky in CI, temporarily added some debug console.logs
/* eslint-disable no-console */
const testSetQueryId = async (exr, exp, queryType) => {
  // create a dummy queryId
  // this test has been giving us random trouble for a long time...
  // trying different Date method and crossing fingers...
  const now = new Date().getTime().toString()
  console.log('const now =', now)
  const queryId = web3.sha3(web3.toHex(now), { encoding: 'hex' })
  console.log('const queryId =', queryId)

  await exp.setQueryId(queryId, queryType)
  const postQueryType = await exr.queryTypes(queryId)
  console.log('const postQueryType =', postQueryType)
  assert.equal(
    queryType,
    postQueryType,
    'the queryType should match the value set through queryId'
  )
  return queryId
}
/* eslint-enable no-console */

const testSetRateRatesActiveFalse = async (exr, exp, rate, ratePenalty) => {
  const bigRate = new BigNumber(rate)
  const penalizedRate = bigRate.times(1000 - ratePenalty).dividedBy(1000)
  const prePendingQueryId = await exp.pendingTestQueryId()
  const queryType = await exr.queryTypes(prePendingQueryId)

  const [
    // eslint-disable-next-line no-unused-vars
    preCallInterval,
    preCallbackGasLimit,
    preQueryString,
    preRatePenalty,
  ] = await exr.getCurrencySettings(queryType)

  await exp.simulate__callback(prePendingQueryId, bigRate.toString())
  const postPendingQueryId = await exp.pendingTestQueryId()
  const actualRate = await exr.getRate(queryType)

  // check on recursive callback settings
  const [
    postCallInterval,
    postCallbackGasLimit,
    postQueryString,
    postRatePenalty,
  ] = await exr.getCurrencySettings(queryType)

  const shouldCallAgainWithQuery = await exp.shouldCallAgainWithQuery()
  const shouldCallAgainIn = await exp.shouldCallAgainIn()
  const shouldCallAgainWithGas = await exp.shouldCallAgainWithGas()

  assert.equal(
    preCallInterval.toString(),
    postCallInterval.toString(),
    'callInterval in exchange rates settings should remain unchanged'
  )
  assert.equal(
    postCallbackGasLimit.toString(),
    preCallbackGasLimit.toString(),
    'the callback gas limit should remain unchanged'
  )
  assert.equal(
    postQueryString,
    preQueryString,
    'the query string should remain unchanged'
  )
  assert.equal(
    postRatePenalty.toString(),
    preRatePenalty.toString(),
    'the rate penalty should remain unchanged'
  )
  assert.equal(
    shouldCallAgainIn.toString(),
    new BigNumber(0).toString(),
    'shouldCallAgainIn in provider should be 0'
  )
  assert.equal(
    shouldCallAgainWithQuery,
    '',
    'shouldCallAgainWithQuery should be empty'
  )
  assert.equal(
    shouldCallAgainWithGas.toString(),
    new BigNumber(0).toString(),
    'shouldCallAgainWithGas be 0'
  )
  assert(queryType !== '', 'queryTypeBytes should not be empty')

  assert.equal(
    postPendingQueryId,
    '0x' + '00'.repeat(32),
    'the pending query id should be empty after callback completed'
  )
  assert.equal(
    penalizedRate.times(100).toFixed(0, 1),
    actualRate.toString(),
    'the rate on exr should match the set penalized rate'
  )
}

const testUpdatedCurrencySettings = async (
  exr,
  exp,
  updatedCallInterval,
  updatedCallbackGasLimit,
  updatedQueryString
) => {
  const shouldCallAgainIn = await exp.shouldCallAgainIn()
  const shouldCallAgainWithGas = await exp.shouldCallAgainWithGas()
  const shouldCallAgainWithQuery = await exp.shouldCallAgainWithQuery()

  assert.equal(
    updatedCallInterval.toString(),
    shouldCallAgainIn.toString(),
    'updated on exr call interval should match shouldCallAgainIn on exp'
  )
  assert.equal(
    updatedCallbackGasLimit.toString(),
    shouldCallAgainWithGas.toString(),
    'updated callback gas limit on exr should match shouldCallAgainWithGas on exp'
  )
  assert.equal(
    updatedQueryString,
    shouldCallAgainWithQuery,
    'updated query string on exr should match shouldCallAgainWithQueryString on exp'
  )
}

const testGetCurrencySettings = async (
  exr,
  queryTypeString,
  callInterval,
  callbackGasLimit,
  queryString,
  ratePenalty,
  config
) => {
  await testSetCurrencySettings(
    exr,
    queryTypeString,
    callInterval,
    callbackGasLimit,
    queryString,
    ratePenalty,
    config
  )

  const [
    actualCallInterval,
    actualCallbackGasLimit,
    actualQueryString,
    actualRatePenalty,
  ] = await exr.getCurrencySettings(queryTypeString)

  assert.equal(
    callInterval.toString(),
    actualCallInterval.toString(),
    'callInteval should match returned actualCallInterval'
  )
  assert.equal(
    callbackGasLimit.toString(),
    actualCallbackGasLimit.toString(),
    'callbackGasLimit should match returned actualCallbackGasLimit'
  )
  assert.equal(
    queryString,
    actualQueryString,
    'queryString should match returned actualQueryString'
  )
  assert.equal(
    ratePenalty.toString(),
    actualRatePenalty.toString(),
    'ratePenalty should match returned actualRatePenalty'
  )
}

module.exports = {
  setupContracts,
  testUninitializedSettings,
  testSetCurrencySettings,
  testFetchRate,
  testSettingsExists,
  testSetRate,
  testToggleRatesActive,
  testToUpperCase,
  testToBytes32Array,
  testSelfDestruct,
  testGetRate,
  testSetQueryId,
  testSetRateRatesActiveFalse,
  testUpdatedCurrencySettings,
  testGetCurrencySettings,
}
