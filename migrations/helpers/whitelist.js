/* eslint-disable no-console */
const chalk = require('chalk')

const addAddress = async (
  whitelist,
  params = { investor: null },
  txConfig = {}
) => {
  const { investor } = params

  console.log(
    chalk.cyan(
      '\n---------------------------------------------------------------------------------'
    )
  )
  console.log(chalk.cyan(`🚀  Whitelisting investor "${investor}"…\n`))
  await whitelist.addAddress(investor, txConfig)
  console.log(
    chalk.green(`\n✅  Successfully whitelisted investor "${investor}"`)
  )
  console.log(
    chalk.green(
      '----------------------------------------------------------------------------------\n\n'
    )
  )
}

module.exports = {
  addAddress
}
