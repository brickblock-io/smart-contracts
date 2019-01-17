/* eslint-disable no-console */
const chalk = require('chalk')

const {
  oneHundredThousandEuroInCents,
  oneHundredThousandTokensInWei,
  oneWeekInSec,
  twoWeeksInSec,
} = require('./constants')
const { unixTimeWithOffsetInSec } = require('./general.js')

const addIssuer = async (
  poaManager,
  params = {
    issuer: '',
  },
  txConfig
) => {
  const { issuer } = params

  console.log(
    chalk.cyan(
      '\n--------------------------------------------------------------'
    )
  )
  console.log(chalk.gray(`Checking if issuer "${issuer}" exist…\n`))
  const isRegisteredIssuer = await poaManager.isRegisteredIssuer(
    issuer,
    txConfig
  )
  if (isRegisteredIssuer) {
    console.log(chalk.gray(`Issuer "${issuer}" already exist, skipping…\n`))
    return
  }

  console.log(chalk.cyan(`🚀  Adding issuer "${issuer}"…\n`))
  await poaManager.addIssuer(issuer, txConfig)
  console.log(chalk.green(`\n✅  Successfully added issuer "${issuer}"`))
  console.log(
    chalk.green(
      '------------------------------------------------------------------------\n\n'
    )
  )
}

const deployPoa = async (
  poaManager,
  params = {
    name: 'POA Test Token',
    symbol: 'BBK-RE-DE123',
    fiatCurrency: 'EUR',
    totalSupply: oneHundredThousandTokensInWei,
    startTimeForFundingPeriod: unixTimeWithOffsetInSec(600),
    durationForFiatFundingPeriod: oneWeekInSec,
    durationForEthFundingPeriod: oneWeekInSec,
    durationForActivationPeriod: twoWeeksInSec,
    fundingGoalInCents: oneHundredThousandEuroInCents,
    listToken: true,
  },
  txConfig = {}
) => {
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
    listToken,
  } = params
  console.log(
    chalk.cyan(
      '\n--------------------------------------------------------------------'
    )
  )
  console.log(
    chalk.cyan(`🚀  Deploying POA "${name}" with symbol "${symbol}"…\n`)
  )

  const tx = await poaManager.addNewToken(
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
    txConfig
  )
  const poaAddress = tx.logs[0].args.token

  console.log(
    chalk.green(
      `\n✅  Successfully deployed POA "${symbol}" to "${poaAddress}"`
    )
  )

  if (listToken) {
    console.log(chalk.gray(`\n  Listing POA "${symbol}" on PoaManager`))
    await poaManager.listToken(poaAddress)
    console.log(
      chalk.green(`\n✅  Successfully listed POA "${symbol}" on PoaManager`)
    )
  }

  const tokenList = await poaManager.getTokenAddressList()

  console.log(chalk.yellow(`\n  POA token list in PoaManager`), tokenList)

  console.log(
    chalk.yellow(
      `\n  POA "${symbol}" index in PoaManager is: ${tokenList.length - 1}`
    )
  )

  console.log(
    chalk.green(
      '-------------------------------------------------------------------------------------------\n\n'
    )
  )
}

module.exports = {
  addIssuer,
  deployPoa,
}
