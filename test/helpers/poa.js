const ContractRegistry = artifacts.require('BrickblockContractRegistry')
const AccessToken = artifacts.require('BrickblockAccessToken')
const ExchangeRates = artifacts.require('ExchangeRates')
const FeeManager = artifacts.require('BrickblockFeeManager')
const Whitelist = artifacts.require('BrickblockWhitelist')

const { finalizedBBK } = require('./bbk')

const setupContracts = async (
  owner,
  bonusAddress,
  contributors,
  tokenDistAmount,
  actRate,
  whitelistAddresses
) => {
  const reg = await ContractRegistry.new()
  const act = await AccessToken.new(reg.address)
  const bbk = await finalizedBBK(
    owner,
    bonusAddress,
    act.address,
    contributors,
    tokenDistAmount
  )
  const exr = await ExchangeRates.new(reg.address)

  if (actRate.greaterThan(0)) {
    await exr.setActRate(actRate)
  }

  const fmr = await FeeManager.new(reg.address)
  const wht = await Whitelist.new()

  for (const address of whitelistAddresses) {
    await wht.addAddress(address)
  }

  await reg.updateContractAddress('BrickblockToken', bbk.address)
  await reg.updateContractAddress('AccessToken', act.address)
  await reg.updateContractAddress('ExchangeRates', exr.address)
  await reg.updateContractAddress('FeeManager', fmr.address)
  await reg.updateContractAddress('Whitelist', wht.address)

  const balanceCheck = await bbk.balanceOf(contributors[0])
  const bbkPaused = await bbk.paused()
  assert(balanceCheck.greaterThan(0), 'the balance should be more than 0')
  assert(!bbkPaused, 'the contract should not be paused')
  return {
    reg,
    act,
    bbk,
    exr,
    fmr,
    wht
  }
}

const stages = {
  funding: 0,
  pending: 1,
  failed: 2,
  active: 3,
  terminated: 4
}

module.exports = {
  stages,
  setupContracts
}
