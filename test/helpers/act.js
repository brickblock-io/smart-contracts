const ContractRegistry = artifacts.require('BrickblockContractRegistry')
const AccessToken = artifacts.require('BrickblockAccessToken')
const FeeManager = artifacts.require('BrickblockFeeManager')
const assert = require('assert')
const { finalizedBBK } = require('./bbk')
const { getEtherBalance, getReceipt, gasPrice, bigZero } = require('./general')
const BigNumber = require('bignumber.js')

const setupContracts = async (
  owner,
  bonusAddress,
  contributors,
  tokenDistAmount
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
  const fmr = await FeeManager.new(reg.address)

  await reg.updateContractAddress('BrickblockToken', bbk.address)
  await reg.updateContractAddress('AccessToken', act.address)
  await reg.updateContractAddress('FeeManager', fmr.address)

  const balanceCheck = await bbk.balanceOf(contributors[0])
  const bbkPaused = await bbk.paused()
  assert(balanceCheck.greaterThan(0), 'the balance should be more than 0')
  assert(!bbkPaused, 'the contract should not be paused')
  return {
    reg,
    act,
    bbk,
    fmr
  }
}

const testApproveAndLockBBK = async (bbk, act, bbkHolder, amount) => {
  const preBbkBalance = await bbk.balanceOf(bbkHolder)
  const preLockedBBK = await act.lockedBbkOf(bbkHolder)

  await bbk.approve(act.address, amount, { from: bbkHolder })

  await act.lockBBK(amount, { from: bbkHolder })

  const postBbkBalance = await bbk.balanceOf(bbkHolder)
  const postLockedBBK = await act.lockedBbkOf(bbkHolder)

  assert.equal(
    preBbkBalance.minus(postBbkBalance).toString(),
    amount.toString(),
    'bbkHolder BBK balance should be decremented by amount'
  )
  assert.equal(
    postLockedBBK.minus(preLockedBBK).toString(),
    amount.toString(),
    'bbkHolder lockedBBK should be incremented by amount'
  )

  return postLockedBBK
}

const testUnlockBBK = async (bbk, act, bbkHolder, amount) => {
  const preBbkBalance = await bbk.balanceOf(bbkHolder)
  const preLockedBBK = await act.lockedBbkOf(bbkHolder)
  const preActBalance = await act.balanceOf(bbkHolder)

  await act.unlockBBK(amount, { from: bbkHolder })

  const postBbkBalance = await bbk.balanceOf(bbkHolder)
  const postLockedBBK = await act.lockedBbkOf(bbkHolder)
  const postActBalance = await act.balanceOf(bbkHolder)
  assert.equal(
    postBbkBalance.minus(preBbkBalance).toString(),
    amount.toString(),
    'bbkHolder BBK balance should be incremented by amount'
  )
  assert.equal(
    preLockedBBK.minus(postLockedBBK).toString(),
    amount.toString(),
    'bbkHolder lockedBBK should be decremented by amount'
  )

  assert.equal(
    preActBalance.toString(),
    postActBalance.toString(),
    'the ACT balance should not change'
  )

  return postLockedBBK
}

const testApproveAndLockMany = async (bbk, act, bbkHolders, amount) => {
  for (const bbkHolder of bbkHolders) {
    await testApproveAndLockBBK(bbk, act, bbkHolder, amount)
  }

  return true
}

const testPayFee = async (feePayer, bbkHolders, feeValue, act, fmr) => {
  const totalLockedBBK = await act.totalLockedBBK()
  const preActTotalSupply = await act.totalSupply()
  const preFeePayerEtherBalance = await getEtherBalance(feePayer)
  const preContributorsActBalances = {}
  for (const bbkHolder of bbkHolders) {
    const actBalance = await act.balanceOf(bbkHolder)
    const lockedBBK = await act.lockedBbkOf(bbkHolder)
    preContributorsActBalances[bbkHolder] = {
      actBalance,
      lockedBBK
    }
  }

  const txid = await fmr.payFee({
    from: feePayer,
    value: feeValue,
    gasPrice
  })

  const tx = await getReceipt(txid)
  const postFeePayerEtherBalance = await getEtherBalance(feePayer)
  const { gasUsed } = tx
  const gasCost = gasPrice.mul(gasUsed)
  const expectedPostFeePayerEtherBalance = preFeePayerEtherBalance
    .sub(feeValue)
    .sub(gasCost)
  const postContributorsActBalance = {}
  for (const bbkHolder of bbkHolders) {
    const actBalance = await act.balanceOf(bbkHolder)
    const lockedBBK = await act.lockedBbkOf(bbkHolder)
    postContributorsActBalance[bbkHolder] = {
      actBalance,
      lockedBBK
    }
    const expectedPerTokenRate = feeValue
      .mul(1e18)
      .div(totalLockedBBK)
      .floor()
    const expectedActBalance = lockedBBK.mul(expectedPerTokenRate).div(1e18)
    if (actBalance.equals(0)) {
      // eslint-disable-next-line
      console.warn(`⚠️  ${bbkHolder} has ACT balance of 0 during testPayFee`)
    }

    assert.equal(
      expectedActBalance.toString(),
      actBalance.toString(),
      'the actBalance should match the expected act balance'
    )
  }

  const postActTotalSupply = await act.totalSupply()

  assert.equal(
    postActTotalSupply.sub(preActTotalSupply).toString(),
    feeValue.toString(),
    'the ACT totalSupply should be incremented by the feeValue'
  )
  assert.equal(
    expectedPostFeePayerEtherBalance.toString(),
    postFeePayerEtherBalance.toString(),
    'the feePayer balance should be decremented by the expected amount'
  )

  return postContributorsActBalance
}

const testClaimFeeMany = async (claimers, act, fmr) => {
  const preContributorBalances = {}
  for (const claimer of claimers) {
    const preActBalance = await act.balanceOf(claimer)
    const preEthBalance = await getEtherBalance(claimer)
    preContributorBalances[claimer] = {
      preActBalance,
      preEthBalance
    }
  }

  for (const claimer of claimers) {
    const { preActBalance, preEthBalance } = preContributorBalances[claimer]
    const txid = await fmr.claimFee(preActBalance, {
      from: claimer,
      gasPrice
    })
    const tx = await getReceipt(txid)
    const gasCost = gasPrice.mul(tx.gasUsed)
    const expectedPostEthBalance = preEthBalance.sub(gasCost).add(preActBalance)
    const postActBalance = await act.balanceOf(claimer)
    const postEthBalance = await getEtherBalance(claimer)

    assert.equal(
      postActBalance.toString(),
      bigZero.toString(),
      'the entire ACT balance should be used'
    )
    assert.equal(
      expectedPostEthBalance.toString(),
      postEthBalance.toString(),
      'the ETH balance for claimer should be incremented by previous ACT balance'
    )
    if (preActBalance.equals(0)) {
      // eslint-disable-next-line no-console
      console.warn(
        `⚠️  ${claimer} has a beginning balance of 0 ACT during testClaimMany`
      )
    }
  }

  const postFeeManagerEthBalance = await getEtherBalance(fmr.address)
  const postActTotalSupply = await act.totalSupply()

  assert.equal(
    postFeeManagerEthBalance.toString(),
    bigZero.toString(),
    'the feeManager should have 0 ether left if all ACT burned'
  )
  assert.equal(
    postActTotalSupply.toString(),
    bigZero.toString(),
    'the act contract totalSupply should be 0 if all ACT burned and all ETH claimed'
  )

  return postActTotalSupply
}

const testTransferAct = async (act, from, to, value) => {
  const amount = new BigNumber(value)
  const preSenderBalance = await act.balanceOf(from)
  const preReceiverBalance = await act.balanceOf(to)

  await act.transfer(to, amount, { from })

  const postSenderBalance = await act.balanceOf(from)
  const postReceiverBalance = await act.balanceOf(to)

  if (preSenderBalance.equals(0)) {
    // eslint-disable-next-line no-console
    console.warn(`⚠️  ${from} has a balance of 0 during testTransferAct`)
  }

  assert.equal(
    preSenderBalance.minus(postSenderBalance).toString(),
    amount.toString(),
    'the sender ACT balance should be decremented by the sent amount'
  )

  assert.equal(
    postReceiverBalance.minus(preReceiverBalance).toString(),
    amount.toString(),
    'the receiver ACT balance should be incremented by the received amount'
  )

  return { from: postSenderBalance, to: postReceiverBalance }
}

const testTransferActMany = async (act, senders, to, value) => {
  const amount = new BigNumber(value)
  for (const sender of senders) {
    await testTransferAct(act, sender, to, amount)
  }
}

const testApproveAct = async (act, accountOwner, spender, value) => {
  const amount = new BigNumber(value)
  const preSpenderAllowance = await act.allowance(accountOwner, spender)

  await act.increaseApproval(spender, amount, { from: accountOwner })

  const postSpenderAllowance = await act.allowance(accountOwner, spender)

  assert.equal(
    postSpenderAllowance.sub(preSpenderAllowance).toString(),
    amount.toString(),
    'the spender allowance should be incremented by the amount'
  )
}

const testApproveActMany = async (act, approvers, spender, value) => {
  for (const approver of approvers) {
    await testApproveAct(act, approver, spender, value)
  }
}

const testTransferFromAct = async (act, accountOwner, to, spender, value) => {
  const amount = new BigNumber(value)
  const preSenderBalance = await act.balanceOf(accountOwner)
  const preReceiverBalance = await act.balanceOf(to)
  const preSpenderAllowance = await act.allowance(accountOwner, spender)

  await act.transferFrom(accountOwner, to, amount, { from: spender })
  const postSenderBalance = await act.balanceOf(accountOwner)
  const postReceiverBalance = await act.balanceOf(to)
  const postSpenderAllowance = await act.allowance(accountOwner, spender)

  assert.equal(
    preSenderBalance.minus(postSenderBalance).toString(),
    amount.toString(),
    'the sender ACT balance should be decremented by the sent amount'
  )

  assert.equal(
    postReceiverBalance.minus(preReceiverBalance).toString(),
    amount.toString(),
    'the receiver ACT balance should be incremented by the received amount'
  )

  assert.equal(
    preSpenderAllowance.sub(postSpenderAllowance).toString(),
    amount.toString(),
    'the spender allowance should be decremented by the spent amount'
  )

  return {
    accountOwner: postSenderBalance,
    to: postReceiverBalance,
    spender: postSpenderAllowance
  }
}

const testTransferFromActMany = async (act, actHolders, to, spender, value) => {
  const amount = new BigNumber(value)
  for (const actHolder of actHolders) {
    await testTransferFromAct(act, actHolder, to, spender, amount)
  }
}

const testActBalanceGreaterThanZero = async (act, actHolder) => {
  const actBalance = await act.balanceOf(actHolder)
  assert(actBalance.greaterThan(0), 'the ACT balance should be more than 0')
  return actBalance
}

module.exports = {
  setupContracts,
  testApproveAndLockBBK,
  testUnlockBBK,
  testApproveAndLockMany,
  testPayFee,
  testClaimFeeMany,
  testTransferAct,
  testTransferActMany,
  testActBalanceGreaterThanZero,
  testApproveAct,
  testApproveActMany,
  testTransferFromAct,
  testTransferFromActMany
}
