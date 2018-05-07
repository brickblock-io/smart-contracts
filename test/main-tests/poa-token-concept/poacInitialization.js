const PoaTokenConcept = artifacts.require('PoaTokenConcept')
const {
  owner,
  broker,
  custodian,
  defaultName,
  defaultSymbol,
  defaultFiatCurrency,
  defaultFundingTimeout,
  defaultActivationTimeout,
  defaultFundingGoal,
  defaultFiatRate,
  getDefaultStartTime,
  setupEcosystem,
  testSetCurrencyRate,
  testInitialization
} = require('../helpers/poac')
const { testWillThrow, addressZero } = require('../helpers/general.js')
const BigNumber = require('bignumber.js')

describe('when initializing PoaTokenConcept', () => {
  contract('PoaTokenConcept', () => {
    let reg
    let exr
    let exp

    beforeEach('setup contracts', async () => {
      const contracts = await setupEcosystem()

      reg = contracts.reg
      exr = contracts.exr
      exp = contracts.exp
    })

    it('should start with the right values', async () => {
      await testInitialization(exr, exp, reg)
    })

    it('should NOT initialize with a NON ready fiatRate', async () => {
      await testWillThrow(PoaTokenConcept.new, [
        defaultName,
        defaultSymbol,
        defaultFiatCurrency,
        broker,
        custodian,
        reg.address,
        await getDefaultStartTime(),
        defaultFundingTimeout,
        defaultActivationTimeout,
        defaultFundingGoal
      ])
    })

    it('should NOT initialize with < 3 character ascii char name', async () => {
      await testSetCurrencyRate(
        exr,
        exp,
        defaultFiatCurrency,
        defaultFiatRate,
        {
          from: owner,
          value: 1e18
        }
      )

      await testWillThrow(PoaTokenConcept.new, [
        'is',
        defaultSymbol,
        defaultFiatCurrency,
        broker,
        custodian,
        reg.address,
        await getDefaultStartTime(),
        defaultFundingTimeout,
        defaultActivationTimeout,
        defaultFundingGoal
      ])
    })

    it('should NOT initialize with < 3 character ascii char symbol', async () => {
      await testSetCurrencyRate(
        exr,
        exp,
        defaultFiatCurrency,
        defaultFiatRate,
        {
          from: owner,
          value: 1e18
        }
      )

      await testWillThrow(PoaTokenConcept.new, [
        defaultName,
        'US',
        defaultFiatCurrency,
        broker,
        custodian,
        reg.address,
        await getDefaultStartTime(),
        defaultFundingTimeout,
        defaultActivationTimeout,
        defaultFundingGoal
      ])
    })

    it('should NOT initialize with < 3 character ascii char fiatCurrency', async () => {
      await testSetCurrencyRate(
        exr,
        exp,
        defaultFiatCurrency,
        defaultFiatRate,
        {
          from: owner,
          value: 1e18
        }
      )

      await testWillThrow(PoaTokenConcept.new, [
        defaultName,
        defaultSymbol,
        'US',
        broker,
        custodian,
        reg.address,
        await getDefaultStartTime(),
        defaultFundingTimeout,
        defaultActivationTimeout,
        defaultFundingGoal
      ])
    })

    it('should NOT initialize with address(0) or null for broker', async () => {
      await testSetCurrencyRate(
        exr,
        exp,
        defaultFiatCurrency,
        defaultFiatRate,
        {
          from: owner,
          value: 1e18
        }
      )

      await testWillThrow(PoaTokenConcept.new, [
        defaultName,
        defaultSymbol,
        defaultFiatCurrency,
        addressZero,
        custodian,
        reg.address,
        await getDefaultStartTime(),
        defaultFundingTimeout,
        defaultActivationTimeout,
        defaultFundingGoal
      ])

      await testWillThrow(PoaTokenConcept.new, [
        defaultName,
        defaultSymbol,
        defaultFiatCurrency,
        null,
        custodian,
        reg.address,
        await getDefaultStartTime(),
        defaultFundingTimeout,
        defaultActivationTimeout,
        defaultFundingGoal
      ])
    })

    it('should NOT initialize with address(0) or null for custodian', async () => {
      await testSetCurrencyRate(
        exr,
        exp,
        defaultFiatCurrency,
        defaultFiatRate,
        {
          from: owner,
          value: 1e18
        }
      )

      await testWillThrow(PoaTokenConcept.new, [
        defaultName,
        defaultSymbol,
        defaultFiatCurrency,
        broker,
        addressZero,
        reg.address,
        await getDefaultStartTime(),
        defaultFundingTimeout,
        defaultActivationTimeout,
        defaultFundingGoal
      ])

      await testWillThrow(PoaTokenConcept.new, [
        defaultName,
        defaultSymbol,
        defaultFiatCurrency,
        broker,
        null,
        reg.address,
        await getDefaultStartTime(),
        defaultFundingTimeout,
        defaultActivationTimeout,
        defaultFundingGoal
      ])
    })

    it('should NOT initialize with address(0) or null for registry', async () => {
      await testSetCurrencyRate(
        exr,
        exp,
        defaultFiatCurrency,
        defaultFiatRate,
        {
          from: owner,
          value: 1e18
        }
      )

      await testWillThrow(PoaTokenConcept.new, [
        defaultName,
        defaultSymbol,
        defaultFiatCurrency,
        broker,
        custodian,
        addressZero,
        await getDefaultStartTime(),
        defaultFundingTimeout,
        defaultActivationTimeout,
        defaultFundingGoal
      ])

      await testWillThrow(PoaTokenConcept.new, [
        defaultName,
        defaultSymbol,
        defaultFiatCurrency,
        broker,
        custodian,
        null,
        await getDefaultStartTime(),
        defaultFundingTimeout,
        defaultActivationTimeout,
        defaultFundingGoal
      ])
    })

    it('should NOT initialize with startTime before now', async () => {
      await testSetCurrencyRate(
        exr,
        exp,
        defaultFiatCurrency,
        defaultFiatRate,
        {
          from: owner,
          value: 1e18
        }
      )

      await testWillThrow(PoaTokenConcept.new, [
        defaultName,
        defaultSymbol,
        defaultFiatCurrency,
        broker,
        custodian,
        reg.address,
        // simulate day before
        new BigNumber(Date.now()).div(1000).sub(60 * 60 * 24),
        defaultFundingTimeout,
        defaultActivationTimeout,
        defaultFundingGoal
      ])
    })

    it('should NOT initialize with fundingTimeout less than 1 day', async () => {
      await testSetCurrencyRate(
        exr,
        exp,
        defaultFiatCurrency,
        defaultFiatRate,
        {
          from: owner,
          value: 1e18
        }
      )

      await testWillThrow(PoaTokenConcept.new, [
        defaultName,
        defaultSymbol,
        defaultFiatCurrency,
        broker,
        custodian,
        reg.address,
        await getDefaultStartTime(),
        // simulate 1 second less than a day
        new BigNumber(60)
          .mul(60)
          .mul(24)
          .sub(1),
        defaultFundingGoal
      ])
    })

    it('should NOT initialize with activationTimeout less than 7 days', async () => {
      await testSetCurrencyRate(
        exr,
        exp,
        defaultFiatCurrency,
        defaultFiatRate,
        {
          from: owner,
          value: 1e18
        }
      )

      await testWillThrow(PoaTokenConcept.new, [
        defaultName,
        defaultSymbol,
        defaultFiatCurrency,
        broker,
        custodian,
        reg.address,
        await getDefaultStartTime(),
        // simulate 1 second less than a day
        new BigNumber(60)
          .mul(60)
          .mul(24)
          .mul(7)
          .sub(1),
        defaultFundingGoal
      ])
    })

    it('should NOT initialize with fundingGoal less than 1', async () => {
      await testSetCurrencyRate(
        exr,
        exp,
        defaultFiatCurrency,
        defaultFiatRate,
        {
          from: owner,
          value: 1e18
        }
      )

      await testWillThrow(PoaTokenConcept.new, [
        defaultName,
        defaultSymbol,
        defaultFiatCurrency,
        broker,
        custodian,
        reg.address,
        await getDefaultStartTime(),
        defaultFundingTimeout,
        defaultActivationTimeout,
        0
      ])
    })
  })
})
