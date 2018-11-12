const BigNumber = require('bignumber.js')
const chalk = require('chalk')
const { table } = require('table')
const logger = require('../../scripts/lib/logger')
const {
  getExpectedTokenAmount,
  getRemainingAmountInWeiDuringEthFunding,
  getRemainingAmountInCentsDuringFiatFunding,
  testBuyTokens,
  testBuyTokensWithFiat,
  testResetCurrencyRate,
} = require('../../test/helpers/poa')
const {
  getRandomInt,
  getRandomBigInt,
  getEtherBalance,
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
        investmentCount: 1,
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
        investmentCount: 1,
      }
    }
  }

  getFiatInvestorAddresses() {
    return Object.keys(this.fiatInvestors)
  }

  getEthInvestorAddresses() {
    return Object.keys(this.ethInvestors)
  }

  getAllInvestorAddresses() {
    return [
      ...this.getFiatInvestorAddresses(),
      ...this.getEthInvestorAddresses(),
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
        expectedTokenDifferenceTolerance: 100000,
      })

      remainingFundableAmount = await getRemainingAmountInCentsDuringFiatFunding(
        poa
      )

      investmentRegistry.addFiatInvestor(poa, investor, randomAmount)

      logger.debug('invested in fiat:', randomAmount.toString())
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

const setRandomRate = async (
  poa,
  exr,
  exp,
  { fluctuationLimitPerCent = 10 } = {}
) => {
  const currentRate = await poa.getFiatRate()
  const isMinus = getRandomInt(0, 10) < 5
  const randomRateChange = getRandomBigInt(
    new BigNumber(1),
    new BigNumber(fluctuationLimitPerCent)
  )
  const diff = currentRate.div(100).times(randomRateChange)
  const newRate = isMinus
    ? currentRate
        .minus(diff)
        .div(100)
        .toNumber()
        .toFixed(2)
    : currentRate
        .plus(diff)
        .div(100)
        .toNumber()
        .toFixed(2)

  logger.debug('old rate', currentRate.toString())
  logger.info('Setting new rate', newRate.toString())
  const expBalance = await getEtherBalance(exp.address)
  logger.debug('ExchangRateProvider Balance', expBalance.div(1e18).toString())
  await testResetCurrencyRate(exr, exp, 'EUR', newRate)
  return newRate
}

const fundEthUntilRemainingTarget = async (
  poa,
  exr,
  exp,
  targetInFiatCents,
  gasPrice,
  investors,
  investmentRegistry
) => {
  let targetInWei
  let remainingFundableAmount = await getRemainingAmountInWeiDuringEthFunding(
    poa
  )
  for (let index = 0; index < investors.length; index++) {
    const investor = investors[index]
    let maxAmount = new BigNumber(1e19) // 10 Eth
    const minAmount = new BigNumber(1e18) // 1 Eth

    const newRate = await setRandomRate(poa, exr, exp)
    targetInWei = targetInFiatCents.mul(newRate)
    remainingFundableAmount = await getRemainingAmountInWeiDuringEthFunding(poa)

    if (maxAmount.gt(remainingFundableAmount)) {
      maxAmount = remainingFundableAmount
    }

    const randomAmount = getRandomBigInt(minAmount, maxAmount)
    if (remainingFundableAmount.lte(targetInWei)) {
      logger.debug(
        'Target achived stepping out!',
        remainingFundableAmount.div(1e18).toString(),
        targetInWei.div(1e18).toString()
      )
      return
    }

    logger.debug('investing with ETH', randomAmount.div(1e18).toString())
    await testBuyTokens(poa, {
      from: investor,
      value: randomAmount,
      gasPrice: gasPrice,
    })

    remainingFundableAmount = await getRemainingAmountInWeiDuringEthFunding(poa)
    investmentRegistry.addEthInvestor(investor, randomAmount)
  }

  if (remainingFundableAmount.gt(targetInWei)) {
    logger.debug('target not reached looping again')
    await fundEthUntilRemainingTarget(
      poa,
      exr,
      exp,
      targetInFiatCents,
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
  currency,
  investmentRegistry,
  totalPayout,
  paidActivationFee,
}) => {
  const fundingGoalFormatted = fundingGoal
    .div(100)
    .toNumber()
    .toLocaleString('en-US', {
      style: 'currency',
      currency,
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
        currency,
      }),
  ])

  data.push([
    chalk.yellow('Total FIAT Investors'),
    investmentRegistry.fiatInvestorsCount(),
  ])
  data.push([
    chalk.yellow('Total FIAT Investment Count'),
    investmentRegistry.getFiatInvestmentCount(),
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
        currency: 'ETH',
      }),
  ])
  data.push([
    chalk.yellow('Total ETH Investors'),
    investmentRegistry.ethInvestorsCount(),
  ])
  data.push([
    chalk.yellow('Total ETH Investment Count'),
    investmentRegistry.getEthInvestmentCount(),
  ])
  // Payouts
  data.push([
    chalk.yellow('Paid Activation Fee'),
    paidActivationFee
      .div(1e18)
      .toNumber()
      .toLocaleString('en-US', {
        style: 'currency',
        currency: 'ETH',
      }),
  ])

  data.push([
    chalk.yellow('Total Payout'),
    totalPayout
      .div(1e18)
      .toNumber()
      .toLocaleString('en-US', {
        style: 'currency',
        currency: 'ETH',
      }),
  ])
  // eslint-disable-next-line
  console.log(table(data))
}

const getFundingGoal = async ({
  defaultFiatRate,
  defaultfundingGoal,
  investors,
}) => {
  const totalAvailableCapInWei = await calculateSumBalanceOfAccounts(investors)

  let fundingGoal

  logger.info('defaultFiatRate', defaultFiatRate.toString())
  logger.debug('totalAvailableCap', totalAvailableCapInWei.toString())
  const totalAvailableCapInCents = totalAvailableCapInWei
    .div(1e16) //shortcut for div(1e18).mul(100)
    .mul(defaultFiatRate)
    .floor()
  logger.debug('totalAvailableCapInCents', totalAvailableCapInCents.toString())

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
  getFundingGoal,
}
