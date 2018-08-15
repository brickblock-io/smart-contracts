const BigNumber = require('bignumber.js')
const logger = require('../../scripts/lib/logger')
const {
  getExpectedTokenAmount,
  getRemainingAmountInWeiDuringEthFunding,
  getRemainingAmountInCentsDuringFiatFunding,
  testBuyTokens,
  testBuyTokensWithFiat
} = require('../../test/helpers/poa')
const { getRandomBigInt, getEtherBalance } = require('../../test/helpers/general')

class InvestmentRegistry {
  constructor() {
    this.investors = {}
  }

  async add(poaToken, address, amountInCents) {
    const investor = this.investors[address]
    const tokens = await getExpectedTokenAmount(poaToken, amountInCents)
    if (investor) {
      investor.amountInCents = investor.amountInCents.plus(amountInCents)
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

  get length() {
    return Object.keys(this.investors).length
  }

  getInvestorAddresses() {
    return Object.keys(this.investors)
  }
}

const fundFiatUntilRemainingTarget = async (
  poa,
  target,
  _custodian,
  _gasPrice,
  investors,
  investmentRegistry
) => {
  let remainingFundableAmount = await getRemainingAmountInCentsDuringFiatFunding(
    poa
  )

  for (let index = 0; index < investors.length; index++) {
    const investor = investors[index]
    const randomAmount = getRandomBigInt(100000, new BigNumber(10000000))

    if (randomAmount.lt(remainingFundableAmount)) {
      await testBuyTokensWithFiat(poa, investor, randomAmount, {
        from: _custodian,
        gasPrice: _gasPrice
      })

      remainingFundableAmount = await getRemainingAmountInCentsDuringFiatFunding(
        poa
      )

      investmentRegistry.add(poa, investor, randomAmount)

      logger.trace('invested in cents', investor, randomAmount)
    }
  }

  if (remainingFundableAmount.gt(target)) {
    await fundFiatUntilRemainingTarget(
      poa,
      target,
      _custodian,
      _gasPrice,
      investors,
      investmentRegistry
    )
  }
}

const fundEthUntilRemainingTarget = async (
  poa,
  target,
  gasPrice,
  investors,
  investmentRegistry
) => {
  let remainingFundableAmount = await getRemainingAmountInWeiDuringEthFunding(
    poa
  )

  for (let index = 0; index < investors.length; index++) {
    const investor = investors[index]
    let maxAmount = new BigNumber(1e19) // 10 Eth
    let minAmount = new BigNumber(1e18) // 1 Eth

    if (maxAmount.gt(remainingFundableAmount)) {
      maxAmount = remainingFundableAmount
    }

    const randomAmount = getRandomBigInt(minAmount, maxAmount)

    await testBuyTokens(poa, {
      from: investor,
      value: randomAmount,
      gasPrice: gasPrice
    })

    remainingFundableAmount = await getRemainingAmountInWeiDuringEthFunding(poa)
    logger.debug('remainingFundableAmount', remainingFundableAmount)
    investmentRegistry.add(poa, investor, randomAmount)

    if (remainingFundableAmount.lte(target)) {
      logger.debug('returning', remainingFundableAmount, target)
      return
    }
  }

  logger.debug('target', target)
  if (remainingFundableAmount.gt(target)) {
    logger.debug('going in again')
    await fundEthUntilRemainingTarget(
      poa,
      target,
      gasPrice,
      investors,
      investmentRegistry
    )
  }
}

const calculateSumBalanceOfAccounts = async accounts => {
  let total = new BigNumber(0)

  for (let index = 0; index < accounts.length; index++) {
    const account = accounts[index]
    total = total.add(await getEtherBalance(account))
  }

  return total
}

module.exports = {
  InvestmentRegistry,
  fundEthUntilRemainingTarget,
  fundFiatUntilRemainingTarget,
  calculateSumBalanceOfAccounts
}
