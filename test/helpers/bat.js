const assert = require('assert')
const BigNumber = require('bignumber.js')
const { finalizedBBK } = require('./bbk')
const ContractRegistry = artifacts.require('./ContractRegistry')
const AccessToken = artifacts.require('./AccessToken')
const ExchangeRates = artifacts.require('./ExchangeRates')
const FeeManager = artifacts.require('./FeeManager')
const BrickblockAccount = artifacts.require('./BrickblockAccount')

const { getEtherBalance, gasPrice, getReceipt } = require('./general')

const setupContracts = async (
  owner,
  bonusAddress,
  contributors,
  tokenDistAmount,
  releaseTime
) => {
  const reg = await ContractRegistry.new()
  const act = await AccessToken.new(reg.address)
  const exr = await ExchangeRates.new(reg.address)
  const bat = await BrickblockAccount.new(reg.address, releaseTime)
  const bbk = await finalizedBBK(
    owner,
    bonusAddress,
    bat.address,
    contributors,
    tokenDistAmount
  )
  const fmr = await FeeManager.new(reg.address)

  await reg.updateContractAddress('BrickblockToken', bbk.address)
  await reg.updateContractAddress('AccessToken', act.address)
  await reg.updateContractAddress('ExchangeRates', exr.address)
  await reg.updateContractAddress('FeeManager', fmr.address)
  await reg.updateContractAddress('BrickblockAccount', bat.address)

  const balanceCheck = await bbk.balanceOf(contributors[0])
  const bbkPaused = await bbk.paused()
  assert(balanceCheck.greaterThan(0), 'balance should be more than 0')
  assert(!bbkPaused, 'contract should not be paused')
  return {
    reg,
    act,
    bbk,
    fmr,
    bat
  }
}

const testPullFunds = async (bbk, bat) => {
  const preBbkBalance = await bbk.balanceOf(bat.address)
  await bat.pullFunds()
  const postBbkBalance = await bbk.balanceOf(bat.address)
  const bbkInitialSupply = await bbk.initialSupply()
  const companyShare = await bbk.companyShare()
  const expectedPostBalance = bbkInitialSupply.mul(companyShare).div(100)
  assert(preBbkBalance.equals(0), 'starting AccountManager balance should be 0')
  assert.equal(
    postBbkBalance.toString(),
    expectedPostBalance.toString(),
    'post AccountManager balance should equal expected value'
  )
}

const testLockBBK = async (bbk, act, bat, amount) => {
  const value = new BigNumber(amount)
  const preBatBbkBalance = await bbk.balanceOf(bat.address)
  const preActBbkBalance = await bbk.balanceOf(act.address)
  const preActLockedBalance = await act.lockedBbkOf(bat.address)

  await bat.lockBBK(value)

  const postBatBbkBalance = await bbk.balanceOf(bat.address)
  const postActBbkBalance = await bbk.balanceOf(act.address)
  const postActLockedBalance = await act.lockedBbkOf(bat.address)

  assert.equal(
    preBatBbkBalance.sub(postBatBbkBalance).toString(),
    value.toString(),
    'AccountManager balance should be decremented by locked in amount'
  )
  assert.equal(
    postActBbkBalance.sub(preActBbkBalance).toString(),
    value.toString(),
    'AccessToken BBK balance should be incremented by locked in amount'
  )
  assert.equal(
    postActLockedBalance.sub(preActLockedBalance).toString(),
    value.toString(),
    'lockedBbk of AccountManager should be incremented by locked in amount'
  )
}

const testUnlockBBK = async (bbk, act, bat, amount) => {
  const value = new BigNumber(amount)
  const preBatBbkBalance = await bbk.balanceOf(bat.address)
  const preActBbkBalance = await bbk.balanceOf(act.address)
  const preBatLockedBalance = await act.lockedBbkOf(bat.address)

  await bat.unlockBBK(value)

  const postBatBbkBalance = await bbk.balanceOf(bat.address)
  const postActBbkBalance = await bbk.balanceOf(act.address)
  const postBatLockedBalance = await act.lockedBbkOf(bat.address)

  assert.equal(
    postBatBbkBalance.sub(preBatBbkBalance).toString(),
    value.toString(),
    'AccountManager balance should be incremented by locked in amount'
  )
  assert.equal(
    preActBbkBalance.sub(postActBbkBalance).toString(),
    value.toString(),
    'AccessToken BBK balance should be decremented by locked in amount'
  )
  assert.equal(
    preBatLockedBalance.sub(postBatLockedBalance).toString(),
    value.toString(),
    'lockedBbk of AccountManager should be decremented by unlocked amount'
  )
}

const testClaimFee = async (bbk, act, fmr, bat, actAmount, actRate) => {
  const actAsWei = actAmount.div(actRate)
  const preBatActBalance = await act.balanceOf(bat.address)
  const preBatEthBalance = await getEtherBalance(bat.address)
  const preBfmEthBalance = await getEtherBalance(fmr.address)
  const preTotalSupply = await act.totalSupply()
  await bat.claimFee(actAmount)
  const postBatActBalance = await act.balanceOf(bat.address)
  const postBatEthBalance = await getEtherBalance(bat.address)
  const postBfmEthBalance = await getEtherBalance(fmr.address)
  const postTotalSupply = await act.totalSupply()

  assert.equal(
    preBatActBalance.sub(postBatActBalance).toString(),
    actAmount.toString(),
    'AccountManager ACT balance should be decremented by actAmount'
  )
  assert.equal(
    postBatEthBalance.sub(preBatEthBalance).toString(),
    actAsWei.toString(),
    'AccountManager ether balance should be incremented by actAmount'
  )
  assert.equal(
    preBfmEthBalance.sub(postBfmEthBalance).toString(),
    actAsWei.toString(),
    'FeeManager ether balance should be decremented by actAmount'
  )
  assert.equal(
    preTotalSupply.sub(postTotalSupply).toString(),
    actAmount.toString(),
    'ACT totalSupply should be decremented by actAmount'
  )
}

const testWithdrawEthFunds = async (bat, recipient, amount) => {
  const owner = await bat.owner()
  const ownerWithdrawing = owner === recipient
  const value = new BigNumber(amount)
  const preRecipientEthBalance = await getEtherBalance(recipient)
  const preContractEthBalance = await getEtherBalance(bat.address)

  const txid = await bat.withdrawEthFunds(recipient, value, { gasPrice })
  const tx = await getReceipt(txid)

  const postRecipientEthBalance = await getEtherBalance(recipient)
  const postContractEthBalance = await getEtherBalance(bat.address)

  if (ownerWithdrawing) {
    const expectedRecipientEthBalance = preRecipientEthBalance
      .add(value)
      .sub(gasPrice.mul(tx.gasUsed))

    assert.equal(
      expectedRecipientEthBalance.toString(),
      postRecipientEthBalance.toString(),
      'receiver post withdraw balance should match expected balance'
    )
  } else {
    assert.equal(
      postRecipientEthBalance.sub(preRecipientEthBalance).toString(),
      value.toString(),
      'recipient ETH balance should be incremented by withdrawal amount'
    )
  }

  assert.equal(
    preContractEthBalance.sub(postContractEthBalance).toString(),
    value.toString(),
    'the contract ETH balance should be decremented by the withdrawal amount'
  )
}

const testWithdrawActFunds = async (bat, act, recipient, amount) => {
  const value = new BigNumber(amount)
  const preRecipientActBalance = await act.balanceOf(recipient)
  const preContractActBalance = await act.balanceOf(bat.address)

  await bat.withdrawActFunds(recipient, amount)

  const postRecipientActBalance = await act.balanceOf(recipient)
  const postContractActBalance = await act.balanceOf(bat.address)

  assert.equal(
    postRecipientActBalance.sub(preRecipientActBalance).toString(),
    value.toString(),
    'the recipient ACT balance should be incremented by given amount'
  )
  assert.equal(
    preContractActBalance.sub(postContractActBalance).toString(),
    value.toString(),
    'the contract ACT balance should be decremented by the given amount'
  )
}

const testWithdrawBbkFunds = async (bat, bbk, recipient, amount) => {
  const value = new BigNumber(amount)
  const preRecipientBbkBalance = await bbk.balanceOf(recipient)
  const preContractBbkBalance = await bbk.balanceOf(bat.address)

  await bat.withdrawBbkFunds(recipient, amount)

  const postRecipientBbkBalance = await bbk.balanceOf(recipient)
  const postContractBbkBalance = await bbk.balanceOf(bat.address)

  assert.equal(
    postRecipientBbkBalance.sub(preRecipientBbkBalance).toString(),
    value.toString(),
    'recipient BBK balance should be incremented by given amount'
  )
  assert.equal(
    preContractBbkBalance.sub(postContractBbkBalance).toString(),
    value.toString(),
    'contract BBK balance should be decremented by given amount'
  )
}

module.exports = {
  setupContracts,
  testPullFunds,
  testLockBBK,
  testUnlockBBK,
  testClaimFee,
  testWithdrawEthFunds,
  testWithdrawActFunds,
  testWithdrawBbkFunds
}
