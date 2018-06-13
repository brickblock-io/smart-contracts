const BrickblockToken = artifacts.require('./BrickblockToken')

const distributeBbkToMany = async (bbk, accounts, amount, owner) => {
  return Promise.all(
    accounts.map(account =>
      bbk.distributeTokens(account, amount, { from: owner })
    )
  )
}

const finalizedBBK = async (
  owner,
  bonusAddress,
  fountainAddress,
  contributors,
  tokenDistAmount
) => {
  const bbk = await BrickblockToken.new(bonusAddress, { from: owner })
  await bbk.changeFountainContractAddress(fountainAddress, { from: owner })
  await distributeBbkToMany(bbk, contributors, tokenDistAmount, owner)
  await bbk.finalizeTokenSale({ from: owner })
  await bbk.unpause({ from: owner })
  return bbk
}

module.exports = {
  distributeBbkToMany,
  finalizedBBK
}
