const logger = require('scripts/lib/logger')
const BigNumber = require('bignumber.js')
const {
  getRandomBigInt,
  gasPrice,
  testWillThrow
} = require('test/helpers/general')
const { timeTravel } = require('helpers')
const {
  determineNeededTimeTravel,
  setupPoaProxyAndEcosystem,
  testStartFiatSale,
  broker,
  custodian,
  testBuyTokensWithFiat,
  getRemainingAmountInCentsDuringFiatFunding,
  testUpdateProofOfCustody,
  defaultIpfsHashArray32,
  testPayActivationFee,
  testActivate,
  testBrokerClaim,
  testClaimAllPayouts,
  testPayout,
  defaultFiatCurrency,
  defaultFiatRate
} = require('test/helpers/poa')

const {
  InvestmentRegistry,
  fundFiatUntilRemainingTarget,
  displaySummary,
  getFundingGoal
} = require('../helpers/st-poa-helper')

describe('PoaToken Stress Tests - test fiat funding only', () => {
  contract('PoaToken', accounts => {
    const fiatInvestors = accounts.slice(4, accounts.length)
    const investmentRegistry = new InvestmentRegistry()
    let paidActivationFee
    let fundingGoal
    let fmr
    let poa
    let totalPayout = new BigNumber(0)

    before('setup contracts', async () => {
      fundingGoal = await getFundingGoal({
        defaultFiatRate,
        defaultfundingGoal: new BigNumber(1e8), // 1.000.000 EUR
        investors: fiatInvestors
      })
      const contracts = await setupPoaProxyAndEcosystem({
        _fundingGoal: fundingGoal
      })

      fmr = contracts.fmr
      poa = contracts.poa

      const neededTime = await determineNeededTimeTravel(poa)

      await timeTravel(neededTime)
      await testStartFiatSale(poa, { from: broker, gasPrice })
    })

    it('should fund with random amounts with many investors', async () => {
      await fundFiatUntilRemainingTarget(
        poa,
        fundingGoal
          .div(100)
          .mul(2)
          .floor(),
        custodian,
        gasPrice,
        fiatInvestors,
        investmentRegistry
      )

      const remainingFundableAmount = await getRemainingAmountInCentsDuringFiatFunding(
        poa
      )

      logger.info(
        `Remaining fundable amount: ${remainingFundableAmount.toString()}`,
        {
          scope: 'Fiat funding'
        }
      )

      await testBuyTokensWithFiat(
        poa,
        fiatInvestors[0],
        remainingFundableAmount,
        {
          from: custodian,
          gasPrice,
          expectedTokenDifferenceTolerance: 100000
        }
      )
    })

    it('should activate', async () => {
      const res = await testPayActivationFee(poa, fmr)

      paidActivationFee = res.paidFeeAmount

      await testUpdateProofOfCustody(poa, defaultIpfsHashArray32, {
        from: custodian
      })

      await testActivate(poa, fmr, {
        from: custodian
      })
    })

    it('should payout many times', async () => {
      for (let i = 0; i < 10; i++) {
        const payout = getRandomBigInt(new BigNumber(1e18), new BigNumber(3e18))
        await testPayout(poa, fmr, {
          from: broker,
          value: getRandomBigInt(new BigNumber(1e18), new BigNumber(3e18)),
          gasPrice
        })
        totalPayout = totalPayout.add(payout)
      }
    })

    it('should NOT let broker claim, because there are no ETH funders', async () => {
      await testWillThrow(testBrokerClaim, [poa])
    })

    it('should let investors claim', async () => {
      await testClaimAllPayouts(
        poa,
        investmentRegistry.getFiatInvestorAddresses()
      )
    })

    after('should display summary data', async () => {
      await displaySummary({
        poa,
        fundingGoal,
        currency: defaultFiatCurrency,
        defaultFiatRate,
        investmentRegistry,
        totalPayout,
        paidActivationFee
      })
    })
  })
})
