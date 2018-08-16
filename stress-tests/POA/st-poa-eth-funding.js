const logger = require('../../scripts/lib/logger')
const BigNumber = require('bignumber.js')
const {
  getRandomBigInt,
  timeTravel,
  gasPrice
} = require('../../test/helpers/general')

const {
  determineNeededTimeTravel,
  setupPoaProxyAndEcosystem,
  testStartEthSale,
  broker,
  custodian,
  testUpdateProofOfCustody,
  defaultIpfsHashArray32,
  testPayActivationFee,
  testActivate,
  testBrokerClaim,
  testClaimAllPayouts,
  testPayout,
  getRemainingAmountInWeiDuringEthFunding,
  defaultFiatCurrency,
  defaultFiatRate,
  testBuyTokens
} = require('../../test/helpers/poa')

const {
  InvestmentRegistry,
  fundEthUntilRemainingTarget,
  getFundingGoal,
  displaySummary
} = require('../helpers/st-poa-helper')

describe('PoaToken Stress Tests - test eth funding only', () => {
  contract('PoaToken', accounts => {
    const investmentRegistry = new InvestmentRegistry()
    const ethInvestors = accounts.slice(4, accounts.length)
    let fundingGoal
    let paidActivationFee

    let fmr
    let poa
    let totalPayout = new BigNumber(0)

    before('setup contracts', async () => {
      fundingGoal = await getFundingGoal({
        defaultFiatRate,
        defaultfundingGoal: new BigNumber(1e8), // 1.000.000 EUR
        investors: ethInvestors
      })

      const contracts = await setupPoaProxyAndEcosystem({
        _fundingGoal: fundingGoal,
        _whitelistedPoaBuyers: ethInvestors
      })

      fmr = contracts.fmr
      poa = contracts.poa

      const neededTime = await determineNeededTimeTravel(poa)

      await timeTravel(neededTime)
      await testStartEthSale(poa, { gasPrice })
    })

    it('Should fund with random amounts with many investors', async () => {
      const target = new BigNumber(2e18)
      logger.info(
        `Funding with ETH investors until ${target
          .div(1e18)
          .toString()} ETH remains`
      )
      await fundEthUntilRemainingTarget(
        poa,
        target,
        gasPrice,
        ethInvestors,
        investmentRegistry
      )
      const remainingBuyableAmount = await getRemainingAmountInWeiDuringEthFunding(
        poa
      )

      logger.info('buying remaining tokens with eth', remainingBuyableAmount)

      await testBuyTokens(poa, {
        from: ethInvestors[0],
        value: remainingBuyableAmount,
        gasPrice
      })
    }).timeout(1000 * 60 * 20) // set timeout to 20 minutes

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

    it('should let Broker Claim', async () => {
      await testBrokerClaim(poa)
    })

    it('should payout many times', async () => {
      for (let i = 0; i < 10; i++) {
        const payout = getRandomBigInt(new BigNumber(1e18), new BigNumber(3e18))

        await testPayout(poa, fmr, {
          from: broker,
          value: payout,
          gasPrice
        })
        totalPayout = totalPayout.add(payout)
      }
    })

    it('should let investors claim', async () => {
      await testClaimAllPayouts(
        poa,
        investmentRegistry.getAllInvestorAddresses()
      )
    })

    it('should display summary data', async () => {
      await displaySummary({
        poa,
        fundingGoal,
        defaultFiatCurrency,
        defaultFiatRate,
        investmentRegistry,
        totalPayout,
        paidActivationFee
      })
    })
  })
})
