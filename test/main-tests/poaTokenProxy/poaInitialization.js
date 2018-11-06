const {
  broker,
  custodian,
  defaultFiatCurrency32,
  defaultFundingGoal,
  defaultFiatFundingDuration,
  defaultEthFundingDuration,
  defaultActivationDuration,
  defaultName32,
  defaultSymbol32,
  defaultTotalSupply,
  emptyBytes32,
  getDefaultStartTimeForFundingPeriod,
  setupEcosystem,
  testProxyInitialization,
  testSetCurrencyRateWithDefaultValues
} = require('../../helpers/poa')
const { testWillThrow, addressZero } = require('../../helpers/general.js')
const BigNumber = require('bignumber.js')

const makeProxyInitializationArguments = async (customValues = {}) => [
  customValues.name32 || defaultName32,
  customValues.symbol32 || defaultSymbol32,
  customValues.fiatCurrency32 || defaultFiatCurrency32,
  customValues.custodian || custodian,
  customValues.totalSupply || defaultTotalSupply,
  customValues.startTimeForFundingPeriod ||
    (await getDefaultStartTimeForFundingPeriod()),
  customValues.durationForFiatFundingPeriod || defaultFiatFundingDuration,
  customValues.durationForEthFundingPeriod || defaultEthFundingDuration,
  customValues.durationForActivationPeriod || defaultActivationDuration,
  customValues.fundingGoal || defaultFundingGoal,
  {
    from: customValues.from || broker
  }
]

describe('when initializing PoaToken', () => {
  contract('PoaTokenProxy', () => {
    let reg
    let exr
    let exp
    let pmr

    beforeEach('setup contracts', async () => {
      const contracts = await setupEcosystem()

      reg = contracts.reg
      exr = contracts.exr
      exp = contracts.exp
      pmr = contracts.pmr
    })

    it('should get the correct contract addresses', async () => {
      await testSetCurrencyRateWithDefaultValues(exr, exp)

      const poa = await testProxyInitialization(
        reg,
        pmr,
        await makeProxyInitializationArguments()
      )

      const pmrAddr = await poa.getContractAddress('PoaManager')
      const exrAddr = await poa.getContractAddress('ExchangeRates')

      assert.equal(
        pmrAddr,
        pmr.address,
        'pmr address returned from getContractAddress should match actual pmr address'
      )

      assert.equal(
        exrAddr,
        exr.address,
        'exr address returned from getContractAddress should match actual exr address'
      )
    })

    it('should NOT setup more than once', async () => {
      await testSetCurrencyRateWithDefaultValues(exr, exp)

      await testProxyInitialization(
        reg,
        pmr,
        await makeProxyInitializationArguments()
      )

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        await makeProxyInitializationArguments()
      ])
    })

    it('should NOT initialize with a NON ready fiatRate', async () => {
      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        await makeProxyInitializationArguments()
      ])
    })

    it('should NOT initialize when NOT sent from listed broker', async () => {
      await testSetCurrencyRateWithDefaultValues(exr, exp)

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        await makeProxyInitializationArguments({
          from: custodian
        })
      ])
    })

    it('should NOT initialize with empty name', async () => {
      await testSetCurrencyRateWithDefaultValues(exr, exp)

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        await makeProxyInitializationArguments({
          name32: emptyBytes32
        })
      ])
    })

    it('should NOT initialize with empty symbol', async () => {
      await testSetCurrencyRateWithDefaultValues(exr, exp)

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        await makeProxyInitializationArguments({
          symbol32: emptyBytes32
        })
      ])
    })

    it('should NOT initialize with empty fiat currency', async () => {
      await testSetCurrencyRateWithDefaultValues(exr, exp)

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        await makeProxyInitializationArguments({
          fiatCurrency32: emptyBytes32
        })
      ])
    })

    it('should NOT initialize with address(0) or null for custodian', async () => {
      await testSetCurrencyRateWithDefaultValues(exr, exp)

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        await makeProxyInitializationArguments({
          custodian: addressZero
        })
      ])

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        await makeProxyInitializationArguments({
          custodian: null
        })
      ])
    })

    it('should NOT initialize with totalSupply < 1e18 or null', async () => {
      await testSetCurrencyRateWithDefaultValues(exr, exp)

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        await makeProxyInitializationArguments({
          totalSupply: 9e17
        })
      ])

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        await makeProxyInitializationArguments({
          totalSupply: null
        })
      ])
    })

    it('should NOT initialize with startTimeForFundingPeriod before now', async () => {
      await testSetCurrencyRateWithDefaultValues(exr, exp)

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        await makeProxyInitializationArguments({
          // simulate day before
          startTimeForFundingPeriod: new BigNumber(Date.now())
            .div(1000)
            .sub(60 * 60 * 24)
        })
      ])
    })

    it('should NOT initialize with durationForFiatFundingPeriod less than 3 days', async () => {
      await testSetCurrencyRateWithDefaultValues(exr, exp)

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        await makeProxyInitializationArguments({
          // simulate 1 second less than 3 days
          durationForFiatFundingPeriod: new BigNumber(60 * 60 * 24 * 3 - 1)
        })
      ])
    })

    it('should NOT initialize with durationForEthFundingPeriod less than 1 day', async () => {
      await testSetCurrencyRateWithDefaultValues(exr, exp)

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        await makeProxyInitializationArguments({
          // simulate 1 second less than a day
          durationForEthFundingPeriod: new BigNumber(60 * 60 * 24 - 1)
        })
      ])
    })

    it('should NOT initialize with durationForActivationPeriod less than 7 days', async () => {
      await testSetCurrencyRateWithDefaultValues(exr, exp)

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        await makeProxyInitializationArguments({
          // simulate 1 second less than 7 days
          durationForActivationPeriod: new BigNumber(60 * 60 * 24 * 7 - 1)
        })
      ])
    })

    it('should NOT initialize with fundingGoal less than 1', async () => {
      await testSetCurrencyRateWithDefaultValues(exr, exp)

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        await makeProxyInitializationArguments({
          fundingGoal: new BigNumber(0)
        })
      ])
    })
  })
})
