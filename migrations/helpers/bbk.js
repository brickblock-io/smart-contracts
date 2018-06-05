const distributeBbkToMany = (bbk, accounts, amount) =>
  Promise.all(accounts.map(account => bbk.distributeTokens(account, amount)))

const finalizeBbk = async (
  bbk,
  owner,
  fountainAddress,
  contributors,
  tokenDistAmount
) => {
  await bbk.changeFountainContractAddress(fountainAddress, { from: owner })
  await distributeBbkToMany(bbk, contributors, tokenDistAmount)
  await bbk.finalizeTokenSale({ from: owner })
  await bbk.unpause({ from: owner })
}

module.exports = {
  finalizeBbk
}
