const logger = require('scripts/lib/logger')
const BigNumber = require('bignumber.js')
const { getRandomBigInt, gasPrice } = require('test/helpers/general')
const { timeTravel } = require('helpers')
const {
  determineNeededTimeTravel,
  setupPoaProxyAndEcosystem,
  testStartFiatSale,
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
  defaultFiatCurrency,
  defaultFiatRate,
  testBuyTokens,
  getRemainingAmountInWeiDuringEthFunding
} = require('test/helpers/poa')

const {
  InvestmentRegistry,
  fundFiatUntilRemainingTarget,
  fundEthUntilRemainingTarget,
  getFundingGoal,
  displaySummary
} = require('../helpers/st-poa-helper')

describe('PoaToken Stress Tests - test fiat & eth funding only', () => {
  contract('PoaToken', accounts => {
    const investors = accounts.slice(4, accounts.length)
    const fiatInvestorEnds = Math.floor(accounts.length / 4)
    const fiatInvestors = investors.slice(0, fiatInvestorEnds)
    const ethInvestors = investors.slice(fiatInvestorEnds, accounts.length)
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
    })

    it('should fund fiat with random amounts with many investors', async () => {
      const target = fundingGoal
        .div(100)
        .mul(50) // 50% should remain for eth funding
        .floor()

      logger.info(
        `Funding with fiat investors until ${target
          .div(100)
          .toString()} ${defaultFiatCurrency} remains`
      )

      await testStartFiatSale(poa, { from: broker, gasPrice })
      await fundFiatUntilRemainingTarget(
        poa,
        target,
        custodian,
        gasPrice,
        fiatInvestors,
        investmentRegistry
      )

      logger.info('Fiat Funding finished')
    })

    it('should fund eth with random amounts with many investors', async () => {
      const target = new BigNumber(2e18)
      logger.info(
        `Funding with ETH investors until ${target
          .div(1e18)
          .toString()} ETH remains`
      )
      await testStartEthSale(poa, { gasPrice })
      await fundEthUntilRemainingTarget(
        poa,
        target,
        gasPrice,
        ethInvestors,
        investmentRegistry
      )

      let remainingBuyableAmount = await getRemainingAmountInWeiDuringEthFunding(
        poa
      )
      logger.info(
        'buying remaining tokens with eth',
        remainingBuyableAmount.toString()
      )

      await testBuyTokens(poa, {
        from: ethInvestors[0],
        value: remainingBuyableAmount,
        gasPrice
      })

      remainingBuyableAmount = await getRemainingAmountInWeiDuringEthFunding(
        poa
      )
      logger.info('Eth funding finished')
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
        // A random amount between 1 ETH and 3 ETH
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

    after('should display summary data', async () => {
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
