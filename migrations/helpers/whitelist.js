/* eslint-disable no-console */
const chalk = require('chalk')

const { getEtherBalance } = require('./general.js')

const addAddress = async (
  whitelist,
  params = {
    addresses: {
      owner: '',
      investor: ''
    }
  }
) => {
  const { owner, investor } = params.addresses

  const ownerPreEtherBalance = await getEtherBalance(owner)

  console.log(chalk.yellow(`➡️  Whitelisting investor "${investor}"…`))
  await whitelist.addAddress(investor, { from: owner })
  console.log(
    chalk.cyan(`✅  Successfully whitelisted investor "${investor}"\n\n`)
  )

  const ownerPostEtherBalance = await getEtherBalance(owner)
  const gasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)
  return { gasCost }
}

module.exports = {
  addAddress
}
