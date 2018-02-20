const assert = require('assert')
const { getEtherBalance, getReceipt, gasPrice, bigZero } = require('./general')
const BigNumber = require('bignumber.js')

const testPayFee = async (bfm, account, amount) => {
  const value = new BigNumber(amount)
  const preFeeManagerEthBalance = await getEtherBalance(bfm.address)
  const preFeePayerEthBalance = await getEtherBalance(account)

  const txid = await bfm.payFee({ from: account, value, gasPrice })
  const tx = await getReceipt(txid)

  const { gasUsed } = tx
  const gasCost = gasPrice.mul(gasUsed)

  const postFeeManagerEthBalance = await getEtherBalance(bfm.address)
  const postFeePayerEthBalance = await getEtherBalance(account)
  const expectedFeePayerEthBalance = preFeePayerEthBalance
    .sub(value)
    .sub(gasCost)

  assert.equal(
    postFeeManagerEthBalance.sub(preFeeManagerEthBalance).toString(),
    value.toString(),
    'the fee manager eth balance should be incremented by the value sent'
  )

  assert.equal(
    expectedFeePayerEthBalance.toString(),
    postFeePayerEthBalance.toString(),
    'the fee payer eth balance should match the expected balance'
  )

  return postFeePayerEthBalance
}

const testPartialClaimFee = async (bfm, act, account, claimAmount) => {
  const value = new BigNumber(claimAmount)
  const preFeeManagerEthBalance = await getEtherBalance(bfm.address)
  const preFeeClaimerEthBalance = await getEtherBalance(account)
  const preFeeManagerActBalance = await act.balanceOf(bfm.address)
  const preFeeClaimerActBalance = await act.balanceOf(account)
  const preActTotalSupply = await act.totalSupply()

  const txid = await bfm.claimFee(claimAmount, { from: account, gasPrice })
  const tx = await getReceipt(txid)

  const { gasUsed } = tx
  const gasCost = gasPrice.mul(gasUsed)

  const postFeeManagerEthBalance = await getEtherBalance(bfm.address)
  const postFeeClaimerEthBalance = await getEtherBalance(account)
  const expectedFeeClaimerEthBalance = preFeeClaimerEthBalance
    .add(value)
    .sub(gasCost)
  const postFeeManagerActBalance = await act.balanceOf(bfm.address)
  const postFeeClaimerActBalance = await act.balanceOf(account)
  const postActTotalSupply = await act.totalSupply()

  assert(
    value.greaterThan(0),
    'the act to use to claim should be greater than 0'
  )
  assert.equal(
    preFeeManagerEthBalance.sub(postFeeManagerEthBalance).toString(),
    value.toString(),
    'the fee manager eth balance should be decremented by the value sent'
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
    value.toString(),
    'the ACT balance of the fee claimer should be decremented by the amount'
  )
  assert.equal(
    preActTotalSupply.sub(postActTotalSupply).toString(),
    value.toString(),
    'the ACT total supply should be decremented by the amount burned for ETH'
  )

  return postFeeClaimerActBalance
}

module.exports = {
  testPayFee,
  testPartialClaimFee
}
