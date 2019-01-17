/* eslint-disable no-console */

// Utils
const chalk = require('chalk')
const contract = require('truffle-contract')
const migrationHelpers = require('../migrations/helpers')
const {
  makeTransactionConfig,
  resolvePromiseMap,
} = require('../helpers/general')
const { timeTravel } = require('../helpers/time-travel')

// Contracts
const IPoaTokenCrowdsale = require('../build/contracts/IPoaTokenCrowdsale.json')

const oneWeekInSeconds = 7 * 24 * 60 * 60
const oneHundredThousandEuroInCents = 10000000
const oneHundredThousandTokensInWei = 100000e18

const defaultPoaConfig = (accounts, exchangeRateInfo) => ({
  name: 'default-name',
  symbol: 'default-symbol',
  fiatCurrency: exchangeRateInfo.fiatCurrency,
  custodian: accounts.custodian,
  totalSupply: oneHundredThousandTokensInWei,
  // startTimeForFundingPeriod needs a little offset so that it isn't too close to `block.timestamp` which would fail
  startTimeForFundingPeriod: migrationHelpers.general.unixTimeWithOffsetInSec(
    30
  ),
  durationForFiatFundingPeriod: oneWeekInSeconds,
  durationForEthFundingPeriod: oneWeekInSeconds,
  durationForActivationPeriod: oneWeekInSeconds,
  fundingGoalInCents: oneHundredThousandEuroInCents,
})

const defaultIpfsHashArray = web3 => {
  const defaultIpfsHash = 'QmSUfCtXgb59G9tczrz2WuHNAbecV55KRBGXBbZkou5RtE'
  return [
    web3.toHex(defaultIpfsHash.slice(0, 32)),
    web3.toHex(defaultIpfsHash.slice(32)),
  ]
}

const timeTravelForDuration = async (time, web3) => {
  // timeTravel expects to run in truffle test suite context, where there is a global web3 object
  global.web3 = web3

  await timeTravel(time)

  // clean up the global object
  delete global.web3
}

const readPoaAddressFromTransactionLogs = logs =>
  logs.find(log => log.event === 'TokenAdded').args.token

const deployPoa = (
  basePoaConfig,
  PoaManager,
  transactionConfig,
  web3
) => async customPoaConfig => {
  const {
    name,
    symbol,
    fiatCurrency,
    custodian,
    totalSupply,
    startTimeForFundingPeriod,
    durationForFiatFundingPeriod,
    durationForEthFundingPeriod,
    durationForActivationPeriod,
    fundingGoalInCents,
  } = { ...basePoaConfig, ...customPoaConfig }

  console.log(chalk.cyan('Deploying PoaToken for stage', name))

  // we always deploy through the PoaManager
  const transactionReceipt = await PoaManager.addNewToken(
    name,
    symbol,
    fiatCurrency,
    custodian,
    totalSupply,
    startTimeForFundingPeriod,
    durationForFiatFundingPeriod,
    durationForEthFundingPeriod,
    durationForActivationPeriod,
    fundingGoalInCents,
    transactionConfig
  )

  const tokenAddress = readPoaAddressFromTransactionLogs(
    transactionReceipt.logs
  )

  console.log(chalk.cyan('Deployed PoaToken for desired stage', name))

  const Contract = contract(IPoaTokenCrowdsale)
  await Contract.setProvider(web3.currentProvider)
  return Contract.at(tokenAddress)
}

const deployPoaTokensInEveryStage = async (
  accounts,
  PoaManager,
  exchangeRateInfo,
  web3
) => {
  console.log(chalk.cyan('START Deploying PoaTokens in all stages'))

  const poaBaseConfig = defaultPoaConfig(accounts, exchangeRateInfo)
  const deployWithPoaManager = deployPoa(
    poaBaseConfig,
    PoaManager,
    makeTransactionConfig({ from: accounts.issuer }),
    web3
  )

  const poaTokens = await resolvePromiseMap({
    Preview: deployWithPoaManager({
      name: 'preview',
      symbol: 'preview',
    }),
    PreFunding: deployWithPoaManager({
      name: 'pre-funding',
      symbol: 'pre-funding',
    }),
    FiatFunding: deployWithPoaManager({
      name: 'fiat-funding',
      symbol: 'fiat-funding',
      // ensuring this Contract stays in a valid time after all the time travels, so FiatFunding can be interacted with
      durationForFiatFundingPeriod: 10 * oneWeekInSeconds,
    }),
    EthFunding: deployWithPoaManager({
      name: 'eth-funding',
      symbol: 'eth-funding',
      // ensuring this Contract stays in a valid time after all the time travels, so EthFunding can be interacted with
      durationForEthFundingPeriod: 10 * oneWeekInSeconds,
    }),
    FundingSuccessful: deployWithPoaManager({
      name: 'funding-successful',
      symbol: 'funding-successful',
    }),
    FundingCancelled: deployWithPoaManager({
      name: 'funding-cancelled',
      symbol: 'funding-cancelled',
    }),
    TimedOut: deployWithPoaManager({
      name: 'timed-out',
      symbol: 'timed-out',
    }),
    Active: deployWithPoaManager({
      name: 'active',
      symbol: 'active',
    }),
    Terminated: deployWithPoaManager({
      name: 'terminated',
      symbol: 'terminated',
    }),
  })

  // list all PoaTokens in the PoaManager
  await Promise.all(
    Object.keys(poaTokens).map(key =>
      PoaManager.listToken(
        poaTokens[key].address,
        makeTransactionConfig({ from: accounts.owner })
      )
    )
  )

  // Preview: no further action required, all contracts start in this stage
  console.log(chalk.cyan('PoaToken stage Preview complete'))

  // PreFunding: blocking stage; must be called by `issuer`
  await Promise.all(
    [
      'PreFunding',
      'FiatFunding',
      'EthFunding',
      'FundingSuccessful',
      'FundingCancelled',
      'Active',
      'Terminated',
    ].map(key =>
      poaTokens[key].startPreFunding(
        makeTransactionConfig({ from: accounts.issuer })
      )
    )
  )
  console.log(chalk.cyan('PoaToken stage PreFunding complete'))

  // FiatFunding: first of the funding stages; can be called by anyone
  await timeTravelForDuration(
    Math.floor(poaBaseConfig.startTimeForFundingPeriod - Date.now() / 1000),
    web3
  )
  // NOTE: making these in FiatFunding stage so we dont run out of ETH when funding
  await Promise.all(
    [
      'FiatFunding',
      'FundingSuccessful',
      'FundingCancelled',
      'Active',
      'Terminated',
    ].map(key =>
      poaTokens[key].startFiatSale(
        makeTransactionConfig({ from: accounts.anyone })
      )
    )
  )
  console.log(chalk.cyan('PoaToken stage FiatFunding complete'))

  // EthFunding: second of the funding stages; can be called by anyone
  await timeTravelForDuration(poaBaseConfig.durationForFiatFundingPeriod, web3)
  await poaTokens['EthFunding'].startEthSale(
    makeTransactionConfig({ from: accounts.anyone })
  )
  console.log(chalk.cyan('PoaToken stage EthFunding complete'))

  // FundingSuccessful: blocking stage; fundingGoal must be reached; must be called by custodian
  await Promise.all(
    ['FundingSuccessful', 'Active', 'Terminated'].map(key => {
      poaTokens[key].buyWithFiat(
        accounts.fiatInvestor,
        poaBaseConfig.fundingGoalInCents,
        makeTransactionConfig({ from: accounts.custodian })
      )
    })
  )
  console.log(chalk.cyan('PoaToken stage FundingSuccessful complete'))

  // FundingCancelled: ending stage for a POA; must be called by custodian
  await poaTokens['FundingCancelled'].cancelFunding(
    makeTransactionConfig({ from: accounts.custodian })
  )
  console.log(chalk.cyan('PoaToken stage FundingCancelled complete'))

  // Active: blocking stage; action required from custodian, anyone can `payActivationFee`
  await Promise.all(
    ['Active', 'Terminated'].map(async key => {
      const PoaContract = poaTokens[key]

      await PoaContract.updateProofOfCustody(
        defaultIpfsHashArray(web3),
        makeTransactionConfig({ from: accounts.custodian })
      )

      await PoaContract.payActivationFee(
        makeTransactionConfig({
          from: accounts.issuer,
          value: (await PoaContract.calculateTotalFee()).toString(),
        })
      )

      await PoaContract.activate(
        makeTransactionConfig({ from: accounts.custodian })
      )
    })
  )
  console.log(chalk.cyan('PoaToken stage Active complete'))

  // TimedOut: ending stage for a POA; can be called by anyone
  await timeTravelForDuration(poaBaseConfig.durationForEthFundingPeriod, web3)
  // NOTE: TimedOut can be reached even when no funding period was ever started
  await poaTokens['TimedOut'].manualCheckForTimeout(
    makeTransactionConfig({ from: accounts.anyone })
  )
  console.log(chalk.cyan('PoaToken stage TimedOut complete'))

  // Terminated: ending stage for a POA; must be called by custodian or owner
  await poaTokens['Terminated'].terminate(
    makeTransactionConfig({ from: accounts.custodian })
  )
  console.log(chalk.cyan('PoaToken stage Terminated complete'))

  console.log(chalk.cyan('DONE Deploying PoaTokens in all stages'))
}

module.exports = deployPoaTokensInEveryStage
