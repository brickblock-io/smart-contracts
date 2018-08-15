const logger = require('../../scripts/lib/logger')
const BigNumber = require('bignumber.js')
const { table } = require('table')
const {
  getRandomBigInt,
  timeTravel,
  gasPrice,
  testWillThrow
} = require('../../test/helpers/general')
const chalk = require('chalk')

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
  testBuyRemainingTokens,
  defaultFiatCurrency
} = require('../../test/helpers/poa')

const {
  InvestmentRegistry,
  fundFiatUntilRemainingTarget,
  fundEthUntilRemainingTarget
} = require('../helpers/st-poa-helper')

describe('POAToken Stress Tests - test eth funding only', () => {
  contract('PoaToken', accounts => {
    const investors = accounts.slice(4, accounts.length)
    const ethInvestorEnds = Math.floor(accounts.length / 4)
    const ethInvestors = investors.slice(0, ethInvestorEnds)
    const fiatInvestors = investors.slice(ethInvestorEnds, accounts.length)

    logger.debug(ethInvestors)
    logger.debug(fiatInvestors)

    const fundingGoal = new BigNumber(1e8) // 1.000.000 EUR
    const investmentRegistry = new InvestmentRegistry()

    let fmr
    let poa

    let totalPayout = new BigNumber(0)

    before('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem({
        _fundingGoal: fundingGoal,
        _whitelistedPoaBuyers: ethInvestors
      })

      fmr = contracts.fmr
      poa = contracts.poa

      const neededTime = await determineNeededTimeTravel(poa)

      await timeTravel(neededTime)
    })

    it('Should fund fiat with random amounts with many investors', async () => {
      await testStartFiatSale(poa, { from: broker, gasPrice })
      await fundFiatUntilRemainingTarget(
        poa,
        fundingGoal
          .div(100)
          .mul(50)
          .floor(),
        custodian,
        gasPrice,
        fiatInvestors,
        investmentRegistry
      )
    })

    it('Should fund eth with random amounts with many investors', async () => {
      await testStartEthSale(poa, { gasPrice })
      await fundEthUntilRemainingTarget(
        poa,
        fundingGoal
          .div(100)
          .mul(2)
          .floor(),
        gasPrice,
        ethInvestors,
        investmentRegistry
      )

      logger.info('buying remaining tokens with eth')

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

    it('should display summary data', async () => {
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
      data.push([
        chalk.yellow(
          `Total funded amount during FIAT in ${defaultFiatCurrency}`
        ),
        (await poa.fundedFiatAmountInCents()).div(100).toString()
      ])
      data.push([
        chalk.yellow(
          `Total funded amount during ETH in ${defaultFiatCurrency}`
        ),
        (await poa.fundedEthAmountInWei()).div(1e18).toString()
      ])
      // eslint-disable-next-line
      console.log(table(data))
    })
  })
})
