const BigNumber = require('bignumber.js')
const { testWillThrow } = require('../helpers/general')
const {
  setupContracts,
  testUninitializedSettings,
  testSetCurrencySettings,
  testSettingsExists,
  testFetchRate,
  testSetRate,
  testToggleRatesActive,
  testToUpperCase,
  testSelfDestruct,
  testGetRate,
  testSetQueryId,
  testSetRateRatesActiveFalse,
  testUpdatedCurrencySettings,
  testGetCurrencySettings
} = require('../helpers/exr')

describe('when performing owner only functions', () => {
  contract('ExchangeRates/ExchangeRatesProviderStub', accounts => {
    const owner = accounts[0]
    const notOwner = accounts[1]
    const callInterval = new BigNumber(60)
    const callbackGasLimit = new BigNumber(20e9)
    const queryString = 'https://domain.com/api/?base=ETH&to=USD'
    const queryType = 'USD'
    let exr
    let exp

    before('setup contracts', async () => {
      const contracts = await setupContracts()
      exr = contracts.exr
      exp = contracts.exp
    })

    it('should start with uninitialized settings', async () => {
      await testUninitializedSettings(exr)
    })

    it('should NOT set rate settings as NOT owner', async () => {
      await testWillThrow(testSetCurrencySettings, [
        exr,
        queryType,
        callInterval,
        callbackGasLimit,
        queryString,
        { from: notOwner }
      ])
    })

    it('should set rate settings', async () => {
      await testSetCurrencySettings(
        exr,
        queryType,
        callInterval,
        callbackGasLimit,
        queryString,
        { from: owner }
      )
    })

    it('should NOT getRate when rate is 0 (uninitialized or error)', async () => {
      await testWillThrow(exr.getRate, [queryType])
    })

    it('should NOT fetchRate when NOT owner', async () => {
      await testWillThrow(testFetchRate, [
        exr,
        exp,
        'USD',
        { from: notOwner, value: 1e18 }
      ])
    })

    it('should fetch rate', async () => {
      await testFetchRate(exr, exp, 'USD', { from: owner, value: 1e18 })
    })

    it('should have rates set by the exRatesProvider', async () => {
      await testSetRate(exr, exp, 100)
    })

    it('should stop rates when active', async () => {
      await testToggleRatesActive(exr, false, { from: owner })
    })

    it('should start rates when inactive', async () => {
      await testToggleRatesActive(exr, true, { from: owner })
    })

    it('should NOT toggle rates when NOT owner', async () => {
      await testWillThrow(testToggleRatesActive, [
        exr,
        true,
        { from: notOwner }
      ])
    })
  })
})

describe('when using utility functions', () => {
  contract('ExchangeRates', accounts => {
    const owner = accounts[0]
    let exr

    before('setup contracts', async () => {
      const contracts = await setupContracts()
      exr = contracts.exr
    })

    it('should return a string to uppercase', async () => {
      await testToUpperCase(exr, 'usd')
    })

    it('should return a string to uppercase, even if already uppercase', async () => {
      await testToUpperCase(exr, 'USD')
    })

    it('should get previously set currency settings', async () => {
      await testGetCurrencySettings(
        exr,
        'USD',
        30,
        100000,
        'https://domain.com/api/rates?currency=ETH',
        {
          from: owner
        }
      )
    })
  })
})

describe('when self destructing', async () => {
  contract('ExchangeRates/ExchangeRatesProviderStub', accounts => {
    const owner = accounts[0]
    const notOwner = accounts[1]
    let exr
    let exp

    beforeEach('setup contracts', async () => {
      const contracts = await setupContracts()
      exr = contracts.exr
      exp = contracts.exp
    })

    it('should selfDestruct ExchangeRateProvider', async () => {
      await testSelfDestruct(exr, exp, owner)
    })

    it('should NOT selfDestruct ExchangeRateProvider if NOT owner', async () => {
      await testWillThrow(testSelfDestruct, [exr, exp, notOwner])
    })
  })
})

describe('when testing events', async () => {
  contract('ExchangeRates/ExchangeRateProvider', accounts => {
    const owner = accounts[0]
    const callInterval = new BigNumber(60)
    const callbackGasLimit = new BigNumber(20e9)
    const queryString = 'https://domain.com/api/?base=ETH&to=USD'
    const queryType = 'USD'
    let exr

    beforeEach('setup contracts', async () => {
      const contracts = await setupContracts()
      exr = contracts.exr
    })

    it('should trigger QuerySentEvent if a query is sent with no min balance', async () => {
      await testSetCurrencySettings(
        exr,
        queryType,
        callInterval,
        callbackGasLimit,
        queryString,
        { from: owner }
      )
      await testSettingsExists(exr, queryType)
      const tx = await exr.fetchRate(queryType, { from: owner, value: 1e18 })
      const log = tx.logs[0].event
      assert.equal(
        log,
        'QuerySent',
        'event log even should match QuerySentEvent'
      )
    })

    it('should trigger QueryNoMinBalanceEvent if a query is sent with no min balance', async () => {
      await testSetCurrencySettings(
        exr,
        queryType,
        callInterval,
        callbackGasLimit,
        queryString,
        { from: owner }
      )
      await testSettingsExists(exr, queryType)
      const tx = await exr.fetchRate(queryType, { from: owner })
      const log = tx.logs[0].event
      assert.equal(
        log,
        'QueryNoMinBalance',
        'event log even should match QueryNoMinBalanceEvent'
      )
    })
  })
})

describe('when setting rate settings and fetching', async () => {
  contract('ExchangeRates/ExchangeRatesProviderStub', accounts => {
    const owner = accounts[0]
    const callInterval = new BigNumber(60)
    const callbackGasLimit = new BigNumber(20e9)
    const queryString = 'https://domain.com/api/?base=ETH&to=USD'
    const queryType = 'USD'
    let exr
    let exp
    let defaultRate

    before('setup contracts', async () => {
      const contracts = await setupContracts()
      exr = contracts.exr
      exp = contracts.exp
      defaultRate = 100
    })

    it('should start by setting and fetching rate from owner', async () => {
      await testSetCurrencySettings(
        exr,
        queryType,
        callInterval,
        callbackGasLimit,
        queryString,
        { from: owner }
      )
      await testFetchRate(exr, exp, queryType, { from: owner, value: 1e18 })
    })

    it('should set rate with simulated callback', async () => {
      await testSetRate(exr, exp, defaultRate)
    })

    it('should get the correct rate', async () => {
      await testGetRate(exr, defaultRate, queryType)
      defaultRate++
    })
  })
})

describe('when setting rate settings, fetching rates, and setting ratesActive to false', () => {
  contract('ExchangeRates/ExchangeRatesProviderStub', accounts => {
    const owner = accounts[0]
    const callInterval = new BigNumber(60)
    const callbackGasLimit = new BigNumber(20e9)
    const queryString = 'https://domain.com/api/?base=ETH&to=USD'
    const queryType = 'USD'
    let exr
    let exp
    let defaultRate

    before('setup contracts', async () => {
      const contracts = await setupContracts()
      exr = contracts.exr
      exp = contracts.exp
      defaultRate = 50
    })

    it('should start by setting and fetching rate from owner', async () => {
      await testSetCurrencySettings(
        exr,
        queryType,
        callInterval,
        callbackGasLimit,
        queryString,
        { from: owner }
      )
      await testFetchRate(exr, exp, queryType, { from: owner, value: 1e18 })
    })

    it('should set rate with simulated callback', async () => {
      await testSetRate(exr, exp, defaultRate)
    })

    it('should get the correct rate', async () => {
      await testGetRate(exr, defaultRate, queryType)
      defaultRate++
    })

    it('should toggle ratesActive', async () => {
      await testToggleRatesActive(exr, true, { from: owner })
    })

    it('should simulate a recurisve call where ratesActive is false', async () => {
      await testSetQueryId(exr, exp, queryType)
      await testSetRateRatesActiveFalse(exr, exp, defaultRate)
    })
  })
})

describe('when setting rate settings then changing them later', async () => {
  contract('ExchangeRates/ExchangeRatesProviderStub', accounts => {
    const owner = accounts[0]
    const callInterval = new BigNumber(60)
    const callbackGasLimit = new BigNumber(20e9)
    const queryString = 'https://domain.com/api/?base=ETH&to=USD'
    const queryType = 'USD'
    let exr
    let exp
    let defaultRate
    let updatedCallInterval
    let updatedCallbackGasLimit
    let updatedQueryString

    before('setup contracts', async () => {
      const contracts = await setupContracts()
      exr = contracts.exr
      exp = contracts.exp
      defaultRate = 33
    })

    it('should start by setting and fetching rate from owner', async () => {
      await testSetCurrencySettings(
        exr,
        queryType,
        callInterval,
        callbackGasLimit,
        queryString,
        { from: owner }
      )
      await testFetchRate(exr, exp, queryType, { from: owner, value: 1e18 })
    })

    it('should set rate with simulated callback', async () => {
      await testSetRate(exr, exp, defaultRate)
    })

    it('should get the correct rate', async () => {
      await testGetRate(exr, defaultRate, queryType)
      defaultRate++
    })

    it('should update the settings while rate queries are already in progress', async () => {
      updatedCallInterval = callInterval.add(20)
      updatedCallbackGasLimit = callbackGasLimit.add(500)
      updatedQueryString = 'https://otherdomain.com/api/?base=ETH&to=USD'
      await testSetCurrencySettings(
        exr,
        queryType,
        updatedCallInterval,
        updatedCallbackGasLimit,
        updatedQueryString,
        { from: owner }
      )
    })

    it('should set rate with simulated callback', async () => {
      await testSetQueryId(exr, exp, queryType)
      await testSetRate(exr, exp, defaultRate)
    })

    it('should have the correct pending values in test stub', async () => {
      await testUpdatedCurrencySettings(
        exr,
        exp,
        updatedCallInterval,
        updatedCallbackGasLimit,
        updatedQueryString
      )
    })

    it('should get the correct rate', async () => {
      await testGetRate(exr, defaultRate, queryType)
      defaultRate++
    })

    it('should set rate with simulated callback', async () => {
      await testSetQueryId(exr, exp, queryType)
      await testSetRate(exr, exp, defaultRate)
    })

    it('should get the correct rate', async () => {
      await testGetRate(exr, defaultRate, queryType)
    })
  })
})
