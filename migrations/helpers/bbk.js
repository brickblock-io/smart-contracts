/* eslint-disable no-console */
const chalk = require('chalk')

const distributeBbkToMany = async (
  BrickblockToken,
  contributors,
  amount,
  txConfig = { from: null, gas: null }
) => {
  for (let index = 0; index < contributors.length; index++) {
    const address = contributors[index]
    await BrickblockToken.distributeTokens(address, amount, txConfig)
  }
}

const finalizeBbkCrowdsale = async (
  BrickblockToken,
  params = {
    contributors: [],
    fountainAddress: null,
    tokenAmountPerContributor: null
  },
  txConfig = {
    from: null,
    gas: null
  }
) => {
  const {
    contributors,
    fountainAddress,
    tokenAmountPerContributor,
    network
  } = params

  console.log(chalk.cyan('\n------------------------------'))
  console.log(chalk.cyan('🚀  Finalizing BBK crowdsale…'))

  if (network === 'mainnet') {
    console.error(
      chalk.red(
        `\n➡️   I am not alllowed to do anything on mainnet for BrickblockToken, skipping...`
      )
    )

    return
  }

  const isTokenSaleActive = await BrickblockToken.tokenSaleActive.call()

  console.log(
    chalk.yellow(
      `\n➡️   Changing fountainContractAddress to ${fountainAddress}…`
    )
  )
  await BrickblockToken.changeFountainContractAddress(fountainAddress, txConfig)

  if (isTokenSaleActive) {
    console.log(
      chalk.yellow(
        `\n➡️   Distributing ${tokenAmountPerContributor.toString()} BBK each to ${contributors.toString()}…`
      )
    )
    await distributeBbkToMany(
      BrickblockToken,
      contributors,
      tokenAmountPerContributor,
      txConfig
    )

    console.log(chalk.yellow('\n➡️   Finalizing token sale…'))
    await BrickblockToken.finalizeTokenSale(txConfig)
  } else {
    console.log(chalk.yellow(`\n➡️   Token sale finalized already, skipping…`))
  }

  console.log(chalk.yellow('\n➡️   Unpausing BBK…'))
  const isPaused = await BrickblockToken.paused.call()
  if (isPaused) {
    await BrickblockToken.unpause(txConfig)
  } else {
    console.log(chalk.yellow(`\n➡️   BBK Token unpaused already, skipping…`))
  }

  console.log(chalk.green('\n✅  Successfully finalized BBK crowdsale'))
  console.log(chalk.green('------------------------------------------\n\n'))
}

module.exports = {
  finalizeBbkCrowdsale
}
