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

const oneWeekInSec = 7 * 24 * 60 * 60
const twoWeeksInSec = 2 * oneWeekInSec
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
  durationForFiatFundingPeriod: oneWeekInSec,
  durationForEthFundingPeriod: oneWeekInSec,
  durationForActivationPeriod: twoWeeksInSec,
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
  {
    fiatCurrency,
    custodian,
    totalSupply,
    startTimeForFundingPeriod,
    durationForFiatFundingPeriod,
    durationForEthFundingPeriod,
    durationForActivationPeriod,
    fundingGoalInCents,
  },
  PoaManager,
  transactionConfig,
  web3
) => async ({ name, symbol }) => {
  console.log(chalk.cyan('Deploying PoaToken for stage', name))

  // we always deploy through the PoaManager
  const transactionReceipt = await PoaManager.addToken(
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
    }),
    EthFunding: deployWithPoaManager({
      name: 'eth-funding',
      symbol: 'eth-funding',
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
      'TimedOut',
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
      'TimedOut',
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
  console.log(chalk.cyan('PoaToken stage EthFunding complete'))

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

      console.log('YO MAN, payActivationFee')
      try {
        await PoaContract.payActivationFee(
          makeTransactionConfig({
            from: accounts.issuer,
            value: await PoaContract.calculateTotalFee(),
          })
        )
      } catch (error) {
        console.log('WOAAH', error.reason)
      }

      console.log('YO MAN, activate')
      await PoaContract.activate(
        makeTransactionConfig({ from: accounts.custodian })
      )
    })
  )
  console.log(chalk.cyan('PoaToken stage Active complete'))

  // TimedOut: ending stage for a POA; can be called by anyone
  await timeTravelForDuration(poaBaseConfig.durationForEthFundingPeriod, web3)
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
