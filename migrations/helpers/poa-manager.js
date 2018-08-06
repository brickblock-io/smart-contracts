/* eslint-disable no-console */
const chalk = require('chalk')

const {
  oneHundredThousandEuroInCents,
  oneHundredThousandTokensInWei,
  oneWeekInSec,
  twoWeeksInSec
} = require('../../config/constants')
const { getEtherBalance, unixTimeWithOffsetInSec } = require('./general.js')

const addBroker = async (
  poaManager,
  params = {
    addresses: {
      owner: '',
      broker: ''
    }
  }
) => {
  const { owner, broker } = params.addresses

  const ownerPreEtherBalance = await getEtherBalance(owner)

  console.log(chalk.yellow(`➡️  Adding broker "${broker}"…`))
  await poaManager.addBroker(broker, { from: owner })
  console.log(chalk.cyan(`✅  Successfully added broker "${broker}"\n\n`))

  const ownerPostEtherBalance = await getEtherBalance(owner)
  const gasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)
  return { gasCost }
}

const deployPoa = async (
  poaManager,
  params = {
    addresses: {
      broker: '',
      custodian: ''
    },
    poa: {
      name: 'POA Test Token',
      symbol: 'BBK-RE-DE123',
      fiatCurrency: 'EUR',
      totalSupply: oneHundredThousandTokensInWei,
      startTimeForEthFunding: unixTimeWithOffsetInSec(60),
      endTimeForEthFunding: unixTimeWithOffsetInSec(oneWeekInSec),
      activationTimeout: unixTimeWithOffsetInSec(twoWeeksInSec),
      fundingGoalInCents: oneHundredThousandEuroInCents
    }
  }
) => {
  const { broker, custodian } = params.addresses
  const {
    poa: {
      name,
      symbol,
      fiatCurrency,
      totalSupply,
      startTimeForEthFunding,
      endTimeForEthFunding,
      activationTimeout,
      fundingGoalInCents
    }
  } = params
  const brokerPreEtherBalance = await getEtherBalance(broker)

  console.log(
    chalk.yellow(`➡️  Deploying POA "${name}" with symbol "${symbol}"…`)
  )
  const tx = await poaManager.addToken(
    name,
    symbol,
    fiatCurrency,
    custodian,
    totalSupply,
    startTimeForEthFunding,
    endTimeForEthFunding,
    activationTimeout,
    fundingGoalInCents,
    { from: broker }
  )
  const poaAddress = tx.logs[0].args.token
  console.log(
    chalk.cyan(
      `✅  Successfully deployed POA "${symbol}" to "${poaAddress}"\n\n`
    )
  )
  const brokerPostEtherBalance = await getEtherBalance(broker)
  const gasCost = brokerPreEtherBalance.sub(brokerPostEtherBalance)
  return { gasCost, poaAddress }
}

module.exports = {
  addBroker,
  deployPoa
}
