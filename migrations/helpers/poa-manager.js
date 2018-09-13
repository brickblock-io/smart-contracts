/* eslint-disable no-console */
const chalk = require('chalk')

const {
  oneHundredThousandEuroInCents,
  oneHundredThousandTokensInWei,
  oneWeekInSec,
  twoWeeksInSec
} = require('./constants')
const { unixTimeWithOffsetInSec } = require('./general.js')

const addBroker = async (
  poaManager,
  params = {
    broker: ''
  },
  txConfig
) => {
  const { broker } = params

  console.log(
    chalk.cyan(
      '\n--------------------------------------------------------------'
    )
  )
  console.log(chalk.gray(`Checking if broker "${broker}" exist…\n`))
  const isBrokerExist = await poaManager.isBrokerExist(broker, txConfig)
  if (isBrokerExist) {
    console.log(chalk.gray(`Broker "${broker}" already exist, skipping…\n`))
    return
  }

  console.log(chalk.cyan(`🚀  Adding broker "${broker}"…\n`))
  await poaManager.addBroker(broker, txConfig)
  console.log(chalk.green(`\n✅  Successfully added broker "${broker}"`))
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
    startTimeForEthFundingPeriod: unixTimeWithOffsetInSec(600),
    durationForEthFundingPeriod: oneWeekInSec,
    durationForActivationPeriod: twoWeeksInSec,
    fundingGoalInCents: oneHundredThousandEuroInCents,
    listToken: true
  },
  txConfig = {}
) => {
  const {
    name,
    symbol,
    fiatCurrency,
    custodian,
    totalSupply,
    startTimeForEthFundingPeriod,
    durationForEthFundingPeriod,
    durationForActivationPeriod,
    fundingGoalInCents,
    listToken
  } = params
  console.log(
    chalk.cyan(
      '\n--------------------------------------------------------------------'
    )
  )
  console.log(
    chalk.cyan(`🚀  Deploying POA "${name}" with symbol "${symbol}"…\n`)
  )
  const tx = await poaManager.addToken(
    name,
    symbol,
    fiatCurrency,
    custodian,
    totalSupply,
    startTimeForEthFundingPeriod,
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

  console.log(
    chalk.green(
      '-------------------------------------------------------------------------------------------\n\n'
    )
  )
}

module.exports = {
  addBroker,
  deployPoa
}
