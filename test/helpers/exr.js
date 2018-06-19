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
  waitForTxToBeMined
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
    exp
  }
}

const testUninitializedSettings = async exr => {
  const [
    preCallInterval,
    preCallbackGasLimit,
    preQueryString
  ] = await exr.getCurrencySettings('USD')

  assert.equal(
    preCallInterval.toString(),
    new BigNumber(0).toString(),
    'callInterval should start uninitialized'
  )
  assert.equal(
    preCallbackGasLimit.toString(),
    new BigNumber(0).toString(),
    'callbackGAsLimit should start uninitialized'
  )
  assert.equal(preQueryString, '', 'queryString should start uninitialized')
}

const testSetCurrencySettings = async (
  exr,
  queryType,
  callInterval,
  callbackGasLimit,
  queryString,
  config
) => {
  const [
    preCallInterval,
    preCallbackGasLimit,
    preQueryString
  ] = await exr.getCurrencySettings(queryType)

  await exr.setCurrencySettings(
    queryType,
    queryString,
    callInterval,
    callbackGasLimit,
    config
  )

  const [
    postCallInterval,
    postCallbackGasLimit,
    postQueryString
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
}

const testSettingsExists = async (exr, queryType) => {
  const [
    callInterval,
    callbackGasLimit,
    queryString
  ] = await exr.getCurrencySettings(queryType)
  assert(callbackGasLimit.greaterThan(0), 'callbackGasLimit uninitialized')
  assert(queryString !== '', 'queryString uninitialized')
  if (callInterval.equals(0)) {
    // eslint-disable-next-line
    console.log('callInterval set to 0, are you sure this should be like this?')
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

const testSetRate = async (exr, exp, rate, isAfterClearRateIntervals) => {
  const bigRate = new BigNumber(rate)
  const prePendingQueryId = await exp.pendingTestQueryId()
  const queryType = await exr.queryTypes(prePendingQueryId)
  await exp.simulate__callback(prePendingQueryId, bigRate.toString())
  const postPendingQueryId = await exp.pendingTestQueryId()
  const actualRate = await exr.getRate(queryType)
  // check on recursive callback settings
  const [
    callInterval,
    callbackGasLimit,
    queryString
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
    bigRate.toString(),
    actualRate.toString(),
    'the rate on exr should match the rate set'
  )
}

const testGetRate = async (exr, rate, queryType) => {
  const bigRate = new BigNumber(rate)
  const actualRate = await exr.getRate(queryType)
  assert.equal(
    bigRate.toString(),
    actualRate.toString(),
    'the rate should match the expected rate'
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
    value: 1e18
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

const testSetRateClearIntervals = async (exr, exp, rate) => {
  const bigRate = new BigNumber(rate)
  const prePendingQueryId = await exp.pendingTestQueryId()
  const queryType = await exr.queryTypes(prePendingQueryId)

  const [
    // eslint-disable-next-line no-unused-vars
    preCallInterval,
    preCallbackGasLimit,
    preQueryString
  ] = await exr.getCurrencySettings(queryType)

  await exp.simulate__callback(prePendingQueryId, bigRate.toString())
  const postPendingQueryId = await exp.pendingTestQueryId()
  const actualRate = await exr.getRate(queryType)

  // check on recursive callback settings
  const [
    postCallInterval,
    postCallbackGasLimit,
    postQueryString
  ] = await exr.getCurrencySettings(queryType)

  const shouldCallAgainWithQuery = await exp.shouldCallAgainWithQuery()
  const shouldCallAgainIn = await exp.shouldCallAgainIn()
  const shouldCallAgainWithGas = await exp.shouldCallAgainWithGas()

  assert.equal(
    postCallInterval.toString(),
    new BigNumber(0).toString(),
    'callInterval in exchange rates settings should be 0'
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
    bigRate.toString(),
    actualRate.toString(),
    'the rate on exr should match the rate set'
  )
}

const testSetQueryId = async (exr, exp, queryType) => {
  // create a dummy queryId
  const queryId = web3.sha3(web3.toHex(Date.now()), { encoding: 'hex' })
  await exp.setQueryId(queryId, queryType)
  const postQueryType = await exr.queryTypes(queryId)
  assert.equal(
    queryType,
    postQueryType,
    'the queryType should match the value set through queryId'
  )
  return queryId
}

const testSetRateRatesActiveFalse = async (exr, exp, rate) => {
  const bigRate = new BigNumber(rate)
  const prePendingQueryId = await exp.pendingTestQueryId()
  const queryType = await exr.queryTypes(prePendingQueryId)

  const [
    // eslint-disable-next-line no-unused-vars
    preCallInterval,
    preCallbackGasLimit,
    preQueryString
  ] = await exr.getCurrencySettings(queryType)

  await exp.simulate__callback(prePendingQueryId, bigRate.toString())
  const postPendingQueryId = await exp.pendingTestQueryId()
  const actualRate = await exr.getRate(queryType)

  // check on recursive callback settings
  const [
    postCallInterval,
    postCallbackGasLimit,
    postQueryString
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
    bigRate.toString(),
    actualRate.toString(),
    'the rate on exr should match the rate set'
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
  config
) => {
  await testSetCurrencySettings(
    exr,
    queryTypeString,
    callInterval,
    callbackGasLimit,
    queryString,
    config
  )

  const [
    actualCallInterval,
    actualCallbackGasLimit,
    actualQueryString
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
  testSetRateClearIntervals,
  testSetQueryId,
  testSetRateRatesActiveFalse,
  testUpdatedCurrencySettings,
  testGetCurrencySettings
}
