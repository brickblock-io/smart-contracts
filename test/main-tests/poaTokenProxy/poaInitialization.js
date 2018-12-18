const {
  issuer,
  custodian,
  defaultFiatCurrency,
  defaultFundingGoal,
  defaultFiatFundingDuration,
  defaultEthFundingDuration,
  defaultActivationDuration,
  defaultName,
  defaultSymbol,
  defaultTotalSupply,
  emptyBytes32,
  getDefaultStartTimeForFundingPeriod,
  setupEcosystem,
  testProxyInitialization,
  testSetCurrencyRateWithDefaultValues,
} = require('../../helpers/poa')
const { testWillThrow, addressZero } = require('../../helpers/general.js')
const BigNumber = require('bignumber.js')

const makeProxyInitializationArguments = async (customValues = {}) => [
  customValues.name || defaultName,
  customValues.symbol || defaultSymbol,
  customValues.fiatCurrency || defaultFiatCurrency,
  customValues.custodian || custodian,
  customValues.totalSupply || defaultTotalSupply,
  customValues.startTimeForFundingPeriod ||
    (await getDefaultStartTimeForFundingPeriod()),
  customValues.durationForFiatFundingPeriod || defaultFiatFundingDuration,
  customValues.durationForEthFundingPeriod || defaultEthFundingDuration,
  customValues.durationForActivationPeriod || defaultActivationDuration,
  customValues.fundingGoal || defaultFundingGoal,
  {
    from: customValues.from || issuer,
  },
]

describe('when initializing PoaToken', () => {
  contract('PoaTokenProxy', () => {
    let reg
    let exr
    let exp
    let pmr

    const timestampOfOneDayAgo = new BigNumber(Date.now())
      .div(1000)
      .sub(60 * 60 * 24)
    const zeroDuration = new BigNumber(0)
    const invalidFiatFundingPeriod = defaultFiatFundingDuration.minus(1)
    const invalidEthFundingPeriod = defaultEthFundingDuration.minus(1)
    const invalidActivationPeriod = defaultActivationDuration.minus(1)

    beforeEach('setup contracts', async () => {
      const contracts = await setupEcosystem()

      reg = contracts.reg
      exr = contracts.exr
      exp = contracts.exp
      pmr = contracts.pmr
    })

    it('should NOT initialize with a NON ready fiatRate', async () => {
      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        await makeProxyInitializationArguments(),
      ])
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

    describe('when initial currency rate is set', () => {
      beforeEach('set currency rate', async () => {
        await testSetCurrencyRateWithDefaultValues(exr, exp)
      })

      it('should NOT setup more than once', async () => {
        await testProxyInitialization(
          reg,
          pmr,
          await makeProxyInitializationArguments()
        )

        await testWillThrow(testProxyInitialization, [
          reg,
          pmr,
          await makeProxyInitializationArguments(),
        ])
      })

      it('should NOT initialize when NOT sent from listed issuer', async () => {
        await testWillThrow(testProxyInitialization, [
          reg,
          pmr,
          await makeProxyInitializationArguments({
            from: custodian,
          }),
        ])
      })

      it('should NOT initialize with empty name', async () => {
        await testWillThrow(testProxyInitialization, [
          reg,
          pmr,
          await makeProxyInitializationArguments({
            name: emptyBytes32,
          }),
        ])
      })

      it('should NOT initialize with empty symbol', async () => {
        await testWillThrow(testProxyInitialization, [
          reg,
          pmr,
          await makeProxyInitializationArguments({
            symbol: emptyBytes32,
          }),
        ])
      })

      it('should NOT initialize with empty fiat currency', async () => {
        await testWillThrow(testProxyInitialization, [
          reg,
          pmr,
          await makeProxyInitializationArguments({
            fiatCurrency: emptyBytes32,
          }),
        ])
      })

      it('should NOT initialize with address(0) or null for custodian', async () => {
        await testWillThrow(testProxyInitialization, [
          reg,
          pmr,
          await makeProxyInitializationArguments({
            custodian: addressZero,
          }),
        ])

        // broken right now as `null` is always overwritten with a default
        await testWillThrow(testProxyInitialization, [
          reg,
          pmr,
          await makeProxyInitializationArguments({
            custodian: null,
          }),
        ])
      })

      it('should NOT initialize with totalSupply < 1e18 or null', async () => {
        await testWillThrow(testProxyInitialization, [
          reg,
          pmr,
          await makeProxyInitializationArguments({
            totalSupply: 9e17,
          }),
        ])

        // broken right now as `null` is always overwritten with a default
        await testWillThrow(testProxyInitialization, [
          reg,
          pmr,
          await makeProxyInitializationArguments({
            totalSupply: null,
          }),
        ])
      })

      it('should NOT initialize with startTimeForFundingPeriod before now', async () => {
        await testWillThrow(testProxyInitialization, [
          reg,
          pmr,
          await makeProxyInitializationArguments({
            startTimeForFundingPeriod: timestampOfOneDayAgo,
          }),
        ])
      })

      it('should NOT initialize with durationForFiatFundingPeriod less than 3 days', async () => {
        await testWillThrow(testProxyInitialization, [
          reg,
          pmr,
          await makeProxyInitializationArguments({
            durationForFiatFundingPeriod: invalidFiatFundingPeriod,
          }),
        ])
      })

      it('should NOT initialize with durationForEthFundingPeriod less than 1 day', async () => {
        await testWillThrow(testProxyInitialization, [
          reg,
          pmr,
          await makeProxyInitializationArguments({
            durationForEthFundingPeriod: invalidEthFundingPeriod,
          }),
        ])
      })

      it('should NOT initialize with both durations being 0', async () => {
        await testWillThrow(testProxyInitialization, [
          reg,
          pmr,
          await makeProxyInitializationArguments({
            durationForFiatFundingPeriod: zeroDuration,
            durationForEthFundingPeriod: zeroDuration,
          }),
        ])
      })

      it('should NOT initialize with durationForActivationPeriod less than 7 days', async () => {
        await testWillThrow(testProxyInitialization, [
          reg,
          pmr,
          await makeProxyInitializationArguments({
            durationForActivationPeriod: invalidActivationPeriod,
          }),
        ])
      })

      it('should NOT initialize with fundingGoal less than 1', async () => {
        await testWillThrow(testProxyInitialization, [
          reg,
          pmr,
          await makeProxyInitializationArguments({
            fundingGoal: new BigNumber(0),
          }),
        ])
      })
    })

    it('should initialize with fiat-only funding', async () => {
      await testSetCurrencyRateWithDefaultValues(exr, exp)

      await testProxyInitialization(
        reg,
        pmr,
        await makeProxyInitializationArguments({
          durationForFiatFundingPeriod: defaultFiatFundingDuration,
          durationForEthFundingPeriod: zeroDuration,
        })
      )
    })

    it('should initialize with crypto-only funding', async () => {
      await testSetCurrencyRateWithDefaultValues(exr, exp)

      await testProxyInitialization(
        reg,
        pmr,
        await makeProxyInitializationArguments({
          durationForFiatFundingPeriod: zeroDuration,
          durationForEthFundingPeriod: defaultEthFundingDuration,
        })
      )
    })
  })
})
