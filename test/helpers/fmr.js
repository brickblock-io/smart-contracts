const assert = require('assert')
const ContractRegistry = artifacts.require('ContractRegistry')
const AccessToken = artifacts.require('AccessToken')
const FeeManager = artifacts.require('FeeManager')
const ExchangeRates = artifacts.require('ExchangeRates')
const { getEtherBalance, getReceipt, gasPrice, bigZero } = require('./general')
const { finalizedBBK } = require('./bbk')

const setupContracts = async (
  owner,
  bonusAddress,
  contributors,
  tokenDistAmount,
  actRate
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

  await reg.updateContractAddress('BrickblockToken', bbk.address)
  await reg.updateContractAddress('AccessToken', act.address)
  await reg.updateContractAddress('ExchangeRates', exr.address)
  await reg.updateContractAddress('FeeManager', fmr.address)

  // check that at least one of the contributors got bbk
  const balanceCheck = await bbk.balanceOf(contributors[0])
  const bbkPaused = await bbk.paused()
  assert(balanceCheck.greaterThan(0), 'the balance should be more than 0')
  assert(!bbkPaused, 'the contract should not be paused')
  return {
    reg,
    act,
    bbk,
    exr,
    fmr
  }
}

const testPayFee = async (fmr, act, feePayer, feeAmount, actRate) => {
  const expectedActMinted = feeAmount.mul(actRate)
  const preActTotalSupply = await act.totalSupply()
  const preFeeManagerEthBalance = await getEtherBalance(fmr.address)
  const preFeePayerEthBalance = await getEtherBalance(feePayer)

  const txid = await fmr.payFee({ from: feePayer, value: feeAmount, gasPrice })
  const tx = await getReceipt(txid)

  const { gasUsed } = tx
  const gasCost = gasPrice.mul(gasUsed)
  const postActTotalSupply = await act.totalSupply()
  const postFeeManagerEthBalance = await getEtherBalance(fmr.address)
  const postFeePayerEthBalance = await getEtherBalance(feePayer)
  const expectedFeePayerEthBalance = preFeePayerEthBalance
    .sub(feeAmount)
    .sub(gasCost)

  assert.equal(
    postActTotalSupply.sub(preActTotalSupply).toString(),
    expectedActMinted.toString(),
    'minted act should matched expected amount'
  )
  assert.equal(
    postFeeManagerEthBalance.sub(preFeeManagerEthBalance).toString(),
    feeAmount.toString(),
    'the fee manager eth balance should be incremented by the feeAmount sent'
  )

  assert.equal(
    expectedFeePayerEthBalance.toString(),
    postFeePayerEthBalance.toString(),
    'the fee payer eth balance should match the expected balance'
  )

  return postFeePayerEthBalance
}

const testPartialClaimFee = async (fmr, act, claimer, claimAmount, actRate) => {
  const expectedWeiToEth = claimAmount.div(actRate)
  const preFeeManagerEthBalance = await getEtherBalance(fmr.address)
  const preFeeClaimerEthBalance = await getEtherBalance(claimer)
  const preFeeManagerActBalance = await act.balanceOf(fmr.address)
  const preFeeClaimerActBalance = await act.balanceOf(claimer)
  const preActTotalSupply = await act.totalSupply()

  const txid = await fmr.claimFee(claimAmount, { from: claimer, gasPrice })
  const tx = await getReceipt(txid)

  const { gasUsed } = tx
  const gasCost = gasPrice.mul(gasUsed)

  const postFeeManagerEthBalance = await getEtherBalance(fmr.address)
  const postFeeClaimerEthBalance = await getEtherBalance(claimer)
  const expectedFeeClaimerEthBalance = preFeeClaimerEthBalance
    .add(expectedWeiToEth)
    .sub(gasCost)
  const postFeeManagerActBalance = await act.balanceOf(fmr.address)
  const postFeeClaimerActBalance = await act.balanceOf(claimer)
  const postActTotalSupply = await act.totalSupply()

  assert(
    claimAmount.greaterThan(0),
    'the act to use to claim should be greater than 0'
  )
  assert.equal(
    preFeeManagerEthBalance.sub(postFeeManagerEthBalance).toString(),
    expectedWeiToEth.toString(),
    'the fee manager eth balance should be decremented by the claimAmount sent'
  )

  assert.equal(
    expectedFeeClaimerEthBalance.toString(),
    postFeeClaimerEthBalance.toString(),
    'the fee payer eth balance should match the expected balance'
  )
  assert.equal(
    preFeeManagerActBalance.toString(),
    bigZero.toString(),
    'the fee manager ACT balance should always be 0'
  )
  assert.equal(
    postFeeManagerActBalance.toString(),
    bigZero.toString(),
    'the fee manager ACT balance should always be 0'
  )
  assert.equal(
    preFeeClaimerActBalance.sub(postFeeClaimerActBalance).toString(),
    claimAmount.toString(),
    'the ACT balance of the fee claimer should be decremented by the amount'
  )
  assert.equal(
    preActTotalSupply.sub(postActTotalSupply).toString(),
    claimAmount.toString(),
    'the ACT total supply should be decremented by the amount burned for ETH'
  )

  return postFeeClaimerActBalance
}

module.exports = {
  testPayFee,
  testPartialClaimFee,
  setupContracts
}
