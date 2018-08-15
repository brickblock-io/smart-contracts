const {
  owner,
  broker,
  custodian,
  defaultName32,
  defaultSymbol32,
  defaultFiatCurrency32,
  defaultFiatCurrency,
  defaultFundingTimeout,
  defaultActivationTimeout,
  defaultFundingGoal,
  defaultFiatRate,
  getDefaultStartTime,
  setupEcosystem,
  testSetCurrencyRate,
  testProxyInitialization,
  defaultTotalSupply,
  emptyBytes32
} = require('../../helpers/poa')
const { testWillThrow, addressZero } = require('../../helpers/general.js')
const BigNumber = require('bignumber.js')

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

      const poa = await testProxyInitialization(reg, pmr, [
        defaultName32,
        defaultSymbol32,
        defaultFiatCurrency32,
        custodian,
        defaultTotalSupply,
        await getDefaultStartTime(),
        defaultFundingTimeout,
        defaultActivationTimeout,
        defaultFundingGoal,
        {
          from: broker
        }
      ])

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

    it('should start with the right values', async () => {
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

      await testProxyInitialization(reg, pmr, [
        defaultName32,
        defaultSymbol32,
        defaultFiatCurrency32,
        custodian,
        defaultTotalSupply,
        await getDefaultStartTime(),
        defaultFundingTimeout,
        defaultActivationTimeout,
        defaultFundingGoal,
        { from: broker }
      ])
    })

    it('should NOT setup more than once', async () => {
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

      await testProxyInitialization(reg, pmr, [
        defaultName32,
        defaultSymbol32,
        defaultFiatCurrency32,
        custodian,
        defaultTotalSupply,
        await getDefaultStartTime(),
        defaultFundingTimeout,
        defaultActivationTimeout,
        defaultFundingGoal,
        {
          from: broker
        }
      ])

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        [
          defaultName32,
          defaultSymbol32,
          defaultFiatCurrency32,
          custodian,
          defaultTotalSupply,
          await getDefaultStartTime(),
          defaultFundingTimeout,
          defaultActivationTimeout,
          defaultFundingGoal,
          {
            from: broker
          }
        ]
      ])
    })

    it('should NOT initialize with a NON ready fiatRate', async () => {
      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        [
          defaultName32,
          defaultSymbol32,
          defaultFiatCurrency32,
          custodian,
          defaultTotalSupply,
          await getDefaultStartTime(),
          defaultFundingTimeout,
          defaultActivationTimeout,
          defaultFundingGoal,
          { from: broker }
        ]
      ])
    })

    it('should NOT initialize when NOT sent from listed broker', async () => {
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

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        [
          defaultName32,
          defaultSymbol32,
          defaultFiatCurrency32,
          custodian,
          defaultTotalSupply,
          await getDefaultStartTime(),
          defaultFundingTimeout,
          defaultActivationTimeout,
          defaultFundingGoal,
          { from: custodian }
        ]
      ])
    })

    it('should NOT initialize with empty name', async () => {
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

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        [
          emptyBytes32,
          defaultSymbol32,
          defaultFiatCurrency32,
          custodian,
          defaultTotalSupply,
          await getDefaultStartTime(),
          defaultFundingTimeout,
          defaultActivationTimeout,
          defaultFundingGoal,
          { from: broker }
        ]
      ])
    })

    it('should NOT initialize with empty symbol', async () => {
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

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        [
          defaultName32,
          emptyBytes32,
          defaultFiatCurrency32,
          custodian,
          defaultTotalSupply,
          await getDefaultStartTime(),
          defaultFundingTimeout,
          defaultActivationTimeout,
          defaultFundingGoal,
          { from: broker }
        ]
      ])
    })

    it('should NOT initialize with empty fiat currency', async () => {
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

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        [
          defaultName32,
          defaultSymbol32,
          emptyBytes32,
          custodian,
          defaultTotalSupply,
          await getDefaultStartTime(),
          defaultFundingTimeout,
          defaultActivationTimeout,
          defaultFundingGoal,
          { from: broker }
        ]
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

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        [
          defaultName32,
          defaultSymbol32,
          defaultFiatCurrency32,
          addressZero,
          defaultTotalSupply,
          await getDefaultStartTime(),
          defaultFundingTimeout,
          defaultActivationTimeout,
          defaultFundingGoal,
          { from: broker }
        ]
      ])

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        [
          defaultName32,
          defaultSymbol32,
          defaultFiatCurrency32,
          null,
          defaultTotalSupply,
          await getDefaultStartTime(),
          defaultFundingTimeout,
          defaultActivationTimeout,
          defaultFundingGoal,
          { from: broker }
        ]
      ])
    })

    it('should NOT initialize with totalSupply < 1e18 or null', async () => {
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

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        [
          defaultName32,
          defaultSymbol32,
          defaultFiatCurrency32,
          custodian,
          9e17,
          await getDefaultStartTime(),
          defaultFundingTimeout,
          defaultActivationTimeout,
          defaultFundingGoal,
          { from: broker }
        ]
      ])

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        [
          defaultName32,
          defaultSymbol32,
          defaultFiatCurrency32,
          custodian,
          null,
          await getDefaultStartTime(),
          defaultFundingTimeout,
          defaultActivationTimeout,
          defaultFundingGoal,
          { from: broker }
        ]
      ])
    })

    it('should NOT initialize with startTimeForEthFundingPeriod before now', async () => {
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

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        [
          defaultName32,
          defaultSymbol32,
          defaultFiatCurrency32,
          custodian,
          defaultTotalSupply,
          // simulate day before
          new BigNumber(Date.now()).div(1000).sub(60 * 60 * 24),
          defaultFundingTimeout,
          defaultActivationTimeout,
          defaultFundingGoal,
          { from: broker }
        ]
      ])
    })

    it('should NOT initialize with durationForEthFundingPeriod less than 1 day', async () => {
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

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        [
          defaultName32,
          defaultSymbol32,
          defaultFiatCurrency32,
          custodian,
          defaultTotalSupply,
          await getDefaultStartTime(),
          // simulate 1 second less than a day
          new BigNumber(60)
            .mul(60)
            .mul(24)
            .sub(1),
          defaultActivationTimeout,
          defaultFundingGoal,
          { from: broker }
        ]
      ])
    })

    it('should NOT initialize with durationForActivationPeriod less than 7 days', async () => {
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

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        [
          defaultName32,
          defaultSymbol32,
          defaultFiatCurrency32,
          custodian,
          defaultTotalSupply,
          await getDefaultStartTime(),
          // simulate 1 second less than a day
          new BigNumber(60)
            .mul(60)
            .mul(24)
            .mul(7)
            .sub(1),
          new BigNumber(60)
            .mul(60)
            .mul(24)
            .mul(7)
            .sub(1),
          defaultFundingGoal,
          { from: broker }
        ]
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

      await testWillThrow(testProxyInitialization, [
        reg,
        pmr,
        [
          defaultName32,
          defaultSymbol32,
          defaultFiatCurrency32,
          custodian,
          defaultTotalSupply,
          await getDefaultStartTime(),
          defaultFundingTimeout,
          defaultActivationTimeout,
          0,
          { from: broker }
        ]
      ])
    })
  })
})
