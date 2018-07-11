/* eslint-disable no-console */

const { getEtherBalance } = require('./general.js')
const distributeBbkToMany = (bbk, accounts, amount) =>
  Promise.all(accounts.map(account => bbk.distributeTokens(account, amount)))

const finalizeBbk = async (
  bbk,
  owner,
  fountainAddress,
  contributors,
  tokenDistAmount
) => {
  const ownerPreEtherBalance = await getEtherBalance(owner)
  console.log(`Changing fountainContractAddress to ${fountainAddress}`)
  await bbk.changeFountainContractAddress(fountainAddress, { from: owner })
  console.log(
    `Distributing ${tokenDistAmount.toString()} BBK to ${contributors.toString()}`
  )
  await distributeBbkToMany(bbk, contributors, tokenDistAmount)
  console.log('Finalizing token sale')
  await bbk.finalizeTokenSale({ from: owner })
  console.log('Unpausing BBK')
  await bbk.unpause({ from: owner })
  const ownerPostEtherBalance = await getEtherBalance(owner)

  const gasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)

  return { gasCost }
}

module.exports = {
  finalizeBbk
}
