const logger = require('../../scripts/lib/logger')
const BigNumber = require('bignumber.js')
const { table } = require('table')
const {
  getRandomBigInt,
  timeTravel,
  gasPrice
} = require('../../test/helpers/general')
const chalk = require('chalk')

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
  testBuyRemainingTokens,
  defaultFiatCurrency,
  defaultFiatRate
} = require('../../test/helpers/poa')

const {
  InvestmentRegistry,
  fundEthUntilRemainingTarget,
  calculateSumBalanceOfAccounts
} = require('../helpers/st-poa-helper')

describe('POAToken Stress Tests - test eth funding only', () => {
  contract('PoaToken', accounts => {
    let ethInvestors
    let fundingGoal = new BigNumber(1e8)
    const investmentRegistry = new InvestmentRegistry()

    let fmr
    let poa

    let totalPayout = new BigNumber(0)

    before('setup contracts', async () => {
      ethInvestors = accounts.slice(4, accounts.length)
      const totalAvailableCap = await calculateSumBalanceOfAccounts(
        ethInvestors
      )
      const totalAvailableCapInCents = totalAvailableCap
        .div(1e18)
        .mul(defaultFiatRate)
        .floor()
      if (fundingGoal.gt(totalAvailableCapInCents)) {
        // set a bit lower than total available cap
        fundingGoal = totalAvailableCapInCents
          .sub(totalAvailableCapInCents.div(5))
          .floor()
      }

      logger.info('funding goal', fundingGoal.div(100).toString())

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
      await fundEthUntilRemainingTarget(
        poa,
        fundingGoal
          .div(100)
          .mul(2)
          .mul(defaultFiatRate)
          .floor(),
        gasPrice,
        ethInvestors,
        investmentRegistry
      )

      const remainingFundableAmount = await getRemainingAmountInWeiDuringEthFunding(
        poa
      )

      logger.info(
        `Remaining fundable amount: ${remainingFundableAmount.toString()}`,
        {
          scope: 'Eth funding'
        }
      )

      await testBuyRemainingTokens(poa, {
        from: ethInvestors[0],
        gasPrice
      })
    }).timeout(1000 * 60 * 20) // set timeout to 20 minutes

    it('should activate', async () => {
      await testPayActivationFee(poa, fmr)

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
          value: getRandomBigInt(new BigNumber(1e18), new BigNumber(3e18)),
          gasPrice
        })
        totalPayout = totalPayout.add(payout)
      }
    })

    it('should let investors claim', async () => {
      await testClaimAllPayouts(poa, investmentRegistry.getInvestorAddresses())
    })

    it('should display summary data', () => {
      const data = [
        [
          'Funding Goal',
          `${fundingGoal.div(100).toString()} ${defaultFiatCurrency}`
        ]
      ]

      data.push([chalk.yellow('Total Investors'), investmentRegistry.length])
      data.push([
        chalk.yellow('Total Payout'),
        `${totalPayout.div(1e18).toString()} ETH`
      ])

      // eslint-disable-next-line
      console.log(table(data))
    })
  })
})
