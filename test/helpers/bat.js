const assert = require('assert')
const BigNumber = require('bignumber.js')
const { finalizedBBK } = require('./bbk')

const { getEtherBalance, gasPrice, getReceipt } = require('./general')

const setupContracts = async (
  owner,
  bonusAddress,
  contributors,
  tokenDistAmount,
  ContractRegistry,
  AccessToken,
  BrickblockToken,
  FeeManager,
  BrickblockAccount,
  unlockBlock = 1000
) => {
  const crt = await ContractRegistry.new()
  const act = await AccessToken.new(crt.address)
  const bat = await BrickblockAccount.new(crt.address, unlockBlock)
  const bbk = await finalizedBBK(
    owner,
    BrickblockToken,
    bonusAddress,
    bat.address,
    contributors,
    tokenDistAmount
  )
  const bfm = await FeeManager.new(crt.address)

  await crt.updateContract('BrickblockToken', bbk.address)
  await crt.updateContract('AccessToken', act.address)
  await crt.updateContract('FeeManager', bfm.address)
  await crt.updateContract('BrickblockAccount', bat.address)

  const balanceCheck = await bbk.balanceOf(contributors[0])
  const bbkPaused = await bbk.paused()
  assert(balanceCheck.greaterThan(0), 'balance should be more than 0')
  assert(!bbkPaused, 'contract should not be paused')
  return {
    crt,
    act,
    bbk,
    bfm,
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
    'lockedBBK of AccountManager should be incremented by locked in amount'
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
    'lockedBBK of AccountManager should be decremented by unlocked amount'
  )
}

const testClaimFee = async (bbk, act, bfm, bat, amount) => {
  const value = new BigNumber(amount)
  const preBatActBalance = await act.balanceOf(bat.address)
  const preBatEthBalance = await getEtherBalance(bat.address)
  const preBfmEthBalance = await getEtherBalance(bfm.address)
  const preTotalSupply = await act.totalSupply()
  await bat.claimFee(value)
  const postBatActBalance = await act.balanceOf(bat.address)
  const postBatEthBalance = await getEtherBalance(bat.address)
  const postBfmEthBalance = await getEtherBalance(bfm.address)
  const postTotalSupply = await act.totalSupply()

  assert.equal(
    preBatActBalance.sub(postBatActBalance).toString(),
    value.toString(),
    'AccountManager ACT balance should be decremented by value'
  )
  assert.equal(
    postBatEthBalance.sub(preBatEthBalance).toString(),
    value.toString(),
    'AccountManager ether balance should be incremented by value'
  )
  assert.equal(
    preBfmEthBalance.sub(postBfmEthBalance).toString(),
    value.toString(),
    'FeeManager ether balance should be decremented by value'
  )
  assert.equal(
    preTotalSupply.sub(postTotalSupply).toString(),
    value.toString(),
    'ACT totalSupply should be decremented by value'
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
