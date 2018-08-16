const BigNumber = require('bignumber.js')
const chalk = require('chalk')
const { table } = require('table')
const logger = require('../../scripts/lib/logger')
const {
  getExpectedTokenAmount,
  getRemainingAmountInWeiDuringEthFunding,
  getRemainingAmountInCentsDuringFiatFunding,
  testBuyTokens,
  testBuyTokensWithFiat
} = require('../../test/helpers/poa')
const {
  getRandomBigInt,
  getEtherBalance
} = require('../../test/helpers/general')

class InvestmentRegistry {
  constructor() {
    this.fiatInvestors = {}
    this.ethInvestors = {}
  }

  async addFiatInvestor(poaToken, address, amountInCents) {
    const investor = this.fiatInvestors[address]
    const tokens = await getExpectedTokenAmount(poaToken, amountInCents)
    if (investor) {
      investor.amountInCents = investor.amountInCents.plus(amountInCents)
      investor.tokens = investor.tokens.plus(tokens)
      investor.investmentCount++
    } else {
      this.fiatInvestors[address] = {
        amountInCents,
        tokens,
        investmentCount: 1
      }
    }
  }

  addEthInvestor(address, amountInWei) {
    const investor = this.ethInvestors[address]

    if (investor) {
      investor.amountInWei = investor.amountInWei.plus(amountInWei)
      investor.investmentCount++
    } else {
      this.ethInvestors[address] = {
        amountInWei,
        investmentCount: 1
      }
    }
  }

  getAllInvestorAddresses() {
    return [
      ...Object.keys(this.fiatInvestors),
      ...Object.keys(this.ethInvestors)
    ]
  }

  fiatInvestorsCount() {
    return Object.keys(this.fiatInvestors).length
  }

  ethInvestorsCount() {
    return Object.keys(this.ethInvestors).length
  }

  allInvestorsCount() {
    return this.fiatInvestorsCount + this.ethInvestorsCount
  }

  getInvestmentCount(investors) {
    let count = 0

    for (const investorAddress in investors) {
      if (investors.hasOwnProperty(investorAddress)) {
        const investor = investors[investorAddress]
        count += investor.investmentCount
      }
    }

    return count
  }

  getFiatInvestmentCount() {
    return this.getInvestmentCount(this.fiatInvestors)
  }

  getEthInvestmentCount() {
    return this.getInvestmentCount(this.ethInvestors)
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

    if (
      randomAmount.lt(remainingFundableAmount) &&
      remainingFundableAmount.gt(target)
    ) {
      await testBuyTokensWithFiat(poa, investor, randomAmount, {
        from: _custodian,
        gasPrice: _gasPrice,
        expectedTokenDifferenceTolerance: 200000
      })

      remainingFundableAmount = await getRemainingAmountInCentsDuringFiatFunding(
        poa
      )

      investmentRegistry.addFiatInvestor(poa, investor, randomAmount)

      logger.trace('invested in fiat', investor, randomAmount)
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

  logger.info('Fiat funding target reached stepping out')
}

const fundEthUntilRemainingTarget = async (
  poa,
  targetAsWei,
  gasPrice,
  investors,
  investmentRegistry
) => {
  logger.debug(1)
  let remainingFundableAmount = await getRemainingAmountInWeiDuringEthFunding(
    poa
  )
  logger.debug(2)
  for (let index = 0; index < investors.length; index++) {
    const investor = investors[index]
    let maxAmount = new BigNumber(1e19) // 10 Eth
    const minAmount = new BigNumber(1e18) // 1 Eth

    if (maxAmount.gt(remainingFundableAmount)) {
      maxAmount = remainingFundableAmount
    }

    const randomAmount = getRandomBigInt(minAmount, maxAmount)
    logger.debug('amount', randomAmount)
    if (remainingFundableAmount.lte(targetAsWei)) {
      logger.debug(
        'Target achived stepping out!',
        remainingFundableAmount,
        targetAsWei
      )
      return
    }

    logger.debug('investing with ETH', randomAmount)
    await testBuyTokens(poa, {
      from: investor,
      value: randomAmount,
      gasPrice: gasPrice
    })

    remainingFundableAmount = await getRemainingAmountInWeiDuringEthFunding(poa)
    investmentRegistry.addEthInvestor(investor, randomAmount)
  }

  if (remainingFundableAmount.gt(targetAsWei)) {
    logger.debug('target not reached looping again')
    await fundEthUntilRemainingTarget(
      poa,
      targetAsWei,
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

const displaySummary = async ({
  poa,
  fundingGoal,
  defaultFiatCurrency,
  investmentRegistry,
  totalPayout,
  paidActivationFee
}) => {
  const fundingGoalFormatted = fundingGoal
    .div(100)
    .toNumber()
    .toLocaleString('en-US', {
      style: 'currency',
      currency: defaultFiatCurrency
    })
  const data = [[chalk.yellow('Funding Goal'), fundingGoalFormatted]]

  // FIAT Data
  data.push([chalk.cyan('During FIAT funding Period'), ''])

  data.push([
    chalk.yellow(`Total funded amount during FIAT`),
    (await poa.fundedFiatAmountInCents())
      .div(100)
      .toNumber()
      .toLocaleString('en-US', {
        style: 'currency',
        currency: defaultFiatCurrency
      })
  ])

  data.push([
    chalk.yellow('Total FIAT Investors'),
    investmentRegistry.fiatInvestorsCount()
  ])
  data.push([
    chalk.yellow('Total FIAT Investment Count'),
    investmentRegistry.getFiatInvestmentCount()
  ])

  // Eth Data
  data.push([chalk.cyan('During ETH Funding Period'), ''])

  data.push([
    chalk.yellow(`Total funded amount during ETH Funding`),
    (await poa.fundedEthAmountInWei())
      .div(1e18)
      .toNumber()
      .toLocaleString('en-US', {
        style: 'currency',
        currency: 'ETH'
      })
  ])
  data.push([
    chalk.yellow('Total ETH Investors'),
    investmentRegistry.ethInvestorsCount()
  ])
  data.push([
    chalk.yellow('Total ETH Investment Count'),
    investmentRegistry.getEthInvestmentCount()
  ])
  // Payouts
  data.push([
    chalk.yellow('Paid Activation Fee'),
    paidActivationFee
      .div(1e18)
      .toNumber()
      .toLocaleString('en-US', {
        style: 'currency',
        currency: 'ETH'
      })
  ])

  data.push([
    chalk.yellow('Total Payout'),
    totalPayout
      .div(1e18)
      .toNumber()
      .toLocaleString('en-US', {
        style: 'currency',
        currency: 'ETH'
      })
  ])
  // eslint-disable-next-line
  console.log(table(data))
}

const getFundingGoal = async ({
  defaultFiatRate,
  defaultfundingGoal,
  investors
}) => {
  const totalAvailableCap = await calculateSumBalanceOfAccounts(investors)

  let fundingGoal

  const totalAvailableCapInCents = totalAvailableCap
    .div(1e18)
    .mul(defaultFiatRate)
    .floor()
  if (defaultfundingGoal.gt(totalAvailableCapInCents)) {
    logger.info(
      `Default funding goal (${defaultfundingGoal
        .div(100)
        .toString()}) is higher than the total cap in given accounts. Will adjust it accordingly`
    )
    // set a bit lower than total available cap
    fundingGoal = totalAvailableCapInCents
      .sub(totalAvailableCapInCents.div(5))
      .floor()
  } else {
    fundingGoal = defaultfundingGoal
  }

  logger.debug('Funding goal', defaultfundingGoal.div(100).toString())

  return fundingGoal
}

module.exports = {
  InvestmentRegistry,
  fundEthUntilRemainingTarget,
  fundFiatUntilRemainingTarget,
  calculateSumBalanceOfAccounts,
  displaySummary,
  getFundingGoal
}
