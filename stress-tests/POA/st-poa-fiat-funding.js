const logger = require('../../scripts/lib/logger')
const BigNumber = require('bignumber.js')
const { table } = require('table')
const {
  getEtherBalance,
  getRandomBigInt,
  getRandomInt,
  timeTravel,
  gasPrice
} = require('../../test/helpers/general')
const chalk = require('chalk')

const {
  determineNeededTimeTravel,
  setupPoaProxyAndEcosystem,
  testStartFiatSale,
  broker,
  custodian,
  testBuyTokensWithFiat,
  getRemainingAmountInCents,
  getExpectedTokenAmount
} = require('../../test/helpers/poa')

describe('POAToken Stress Tests', () => {
  describe('test fiat funding only', () => {
    contract('PoaToken', accounts => {
      const fiatInvestors = accounts.slice(4, 7)
      const ethInvestors = accounts.slice(7, accounts.length)
      const tokenDistAmount = new BigNumber(1e24)
      const actRate = new BigNumber(1000)

      const fundingGoal = new BigNumber(1e8) // 1000

      let bbk
      let act
      let fmr
      let poa

      before('setup contracts', async () => {
        const contracts = await setupPoaProxyAndEcosystem({
          _fundingGoal: fundingGoal
        })
        bbk = contracts.bbk
        act = contracts.act
        fmr = contracts.fmr
        poa = contracts.poa

        const neededTime = await determineNeededTimeTravel(poa)

        await timeTravel(neededTime)
        await testStartFiatSale(poa, { from: broker, gasPrice })
      })

      it('Should fund -> payout -> claim with random amounts with many contributors', async () => {
        const fundingCount = 0

        class InvestmentRegistry {
          constructor() {
            this.investors = {}
          }

          async add(poaToken, address, amountInCents) {
            const investor = this.investors[address]
            const tokens = await getExpectedTokenAmount(poaToken, amountInCents)
            if (investor) {
              investor.amountInCents = investor.amountInCents.plus(
                amountInCents
              )
              investor.tokens = investor.tokens.plus(tokens)
            } else {
              this.investors[address] = {
                amountInCents,
                tokens
              }
            }
          }

          list() {
            return this.investors
          }
        }


        const investmentRegistry = new InvestmentRegistry()

        const fundUntilRemainingTarget = async (
          target,
          _custodian,
          _gasPrice,
          investors
        ) => {
          let remainingFundableAmount
          for (let index = 0; index < investors.length; index++) {
            const investor = investors[index]
            const randomAmount = getRandomBigInt(
              100000,
              new BigNumber(10000000)
            )
            remainingFundableAmount = await getRemainingAmountInCents(poa)

            if (randomAmount.lt(remainingFundableAmount)) {
              await testBuyTokensWithFiat(poa, investor, randomAmount, {
                from: _custodian,
                gasPrice: _gasPrice
              })

              investmentRegistry.add(poa, investor, randomAmount)
            } else {
              remainingFundableAmount = await getRemainingAmountInCents(poa)
              break
            }
          }

          if (remainingFundableAmount.gt(target)) {
            await fundUntilRemainingTarget(
              target,
              _custodian,
              _gasPrice,
              fiatInvestors
            )
          }
        }

        await fundUntilRemainingTarget(
          fundingGoal
            .div(100)
            .mul(2)
            .floor(),
          custodian,
          gasPrice,
          fiatInvestors
        )
        logger.info('investmentRegistry', investmentRegistry.list())
        logger.trace(
          `Remaining fundable amount: ${(await getRemainingAmountInCents(poa))
            .div(100)
            .toString()}`,
          {
            scope: 'Fiat funding'
          }
        )
      })
    })
  })
})
