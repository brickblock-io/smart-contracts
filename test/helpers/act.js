const ContractRegistry = artifacts.require('BrickblockContractRegistry')
const AccessToken = artifacts.require('BrickblockAccessToken')
const ExchangeRates = artifacts.require('ExchangeRates')
const FeeManager = artifacts.require('BrickblockFeeManager')
const assert = require('assert')
const chalk = require('chalk')
const { finalizedBBK } = require('./bbk')
const {
  getEtherBalance,
  getReceipt,
  gasPrice,
  bigZero,
  testIsInRange,
  getRandomBigInt
} = require('./general')

const BigNumber = require('bignumber.js')
const defaultRange = { min: 0, max: 100 }

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

  const balanceCheck = await bbk.balanceOf(contributors[0])
  const bbkPaused = await bbk.paused()

  exr.setActRate(actRate)

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

const testApproveAndLockBBK = async (bbk, act, bbkHolder, amount) => {
  const preBbkBalance = await bbk.balanceOf(bbkHolder)
  const preLockedBBK = await act.lockedBbkOf(bbkHolder)

  await bbk.approve(act.address, amount, { from: bbkHolder })

  await act.lockBBK(amount, { from: bbkHolder })

  const postBbkBalance = await bbk.balanceOf(bbkHolder)
  const postLockedBBK = await act.lockedBbkOf(bbkHolder)

  testIsInRange(
    amount.minus(preBbkBalance.minus(postBbkBalance)).abs(),
    defaultRange.min,
    defaultRange.max,
    'bbkHolder BBK balance should be decremented by amount'
  )

  testIsInRange(
    amount.minus(postLockedBBK.minus(preLockedBBK)).abs(),
    defaultRange.min,
    defaultRange.max,
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

const testPayFee = async (
  act,
  fmr,
  feePayer,
  bbkHolders,
  actAmount,
  actRate
) => {
  const weiAsAct = actAmount.mul(actRate)
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
    value: actAmount,
    gasPrice
  })

  const tx = await getReceipt(txid)
  const postFeePayerEtherBalance = await getEtherBalance(feePayer)
  const { gasUsed } = tx
  const gasCost = gasPrice.mul(gasUsed)
  const expectedPostFeePayerEtherBalance = preFeePayerEtherBalance
    .sub(actAmount)
    .sub(gasCost)
  const postContributorsActBalance = {}
  for (const bbkHolder of bbkHolders) {
    const actBalance = await act.balanceOf(bbkHolder)
    const lockedBBK = await act.lockedBbkOf(bbkHolder)
    postContributorsActBalance[bbkHolder] = {
      actBalance,
      lockedBBK
    }

    const expectedPerTokenRate = weiAsAct
      .mul(1e18)
      .div(totalLockedBBK)
      .floor()
    const expectedActBalance = lockedBBK.mul(expectedPerTokenRate).div(1e18)
    if (actBalance.equals(0)) {
      // eslint-disable-next-line
      console.warn(`⚠️  ${bbkHolder} has ACT balance of 0 during testPayFee`)
    }

    testIsInRange(
      actBalance.minus(expectedActBalance).abs(),
      defaultRange.min,
      defaultRange.max,
      'the actBalance should match the expected act balance'
    )
  }

  const postActTotalSupply = await act.totalSupply()

  assert.equal(
    postActTotalSupply.sub(preActTotalSupply).toString(),
    weiAsAct.toString(),
    'the ACT totalSupply should be incremented by the weiAsAct amount'
  )
  assert.equal(
    expectedPostFeePayerEtherBalance.toString(),
    postFeePayerEtherBalance.toString(),
    'the feePayer balance should be decremented by the expected amount'
  )

  return postContributorsActBalance
}

const testClaimFeeMany = async (
  act,
  fmr,
  claimers,
  actRate,
  { actTotalSupplyToleranceAfterBurn = 100 } = {}
) => {
  const preContributorBalances = {}
  for (const claimer of claimers) {
    const preActBalance = await act.balanceOf(claimer)
    const preEthBalance = await getEtherBalance(claimer)
    const preActAsWei = preActBalance.div(actRate)
    preContributorBalances[claimer] = {
      preActBalance,
      preEthBalance,
      preActAsWei
    }
  }

  for (const claimer of claimers) {
    const {
      preActBalance,
      preEthBalance,
      preActAsWei
    } = preContributorBalances[claimer]
    const txid = await fmr.claimFee(preActBalance, {
      from: claimer,
      gasPrice
    })
    const tx = await getReceipt(txid)
    const gasCost = gasPrice.mul(tx.gasUsed)
    const expectedPostEthBalance = preEthBalance.sub(gasCost).add(preActAsWei)
    const postActBalance = await act.balanceOf(claimer)
    const postEthBalance = await getEtherBalance(claimer)

    assert.equal(
      postActBalance.toString(),
      bigZero.toString(),
      'the entire ACT balance should be used'
    )

    testIsInRange(
      postEthBalance.minus(expectedPostEthBalance).abs(),
      defaultRange.min,
      defaultRange.max,
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

  testIsInRange(
    postFeeManagerEthBalance,
    defaultRange.min,
    300,
    'the feeManager should have ~0 ether left if all ACT burned'
  )

  testIsInRange(
    postActTotalSupply,
    defaultRange.min,
    actTotalSupplyToleranceAfterBurn,
    'the act contract totalSupply should be ~0 if all ACT burned and all ETH claimed'
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

const testTransferActManyWithIndividualAmounts = async (
  act,
  senders,
  to,
  amounts
) => {
  let index = 0

  for (const sender of senders) {
    const amount = amounts[index]

    await testTransferAct(act, sender, to, amount)
    index++
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

const testApproveAndLockManyWithIndividualAmounts = async (
  bbk,
  act,
  bbkHolders,
  amounts
) => {
  let index = 0

  for (const bbkHolder of bbkHolders) {
    const amount = amounts[index]
    await testApproveAndLockBBK(bbk, act, bbkHolder, amount)
    index++
  }

  return true
}

const generateRandomLockAmounts = async (
  contributors,
  { min = new BigNumber(1e10), logBalance = false } = {}
) => {
  return Promise.all(
    contributors.map(async contributor => {
      const contributorBalance = await getEtherBalance(contributor)

      let res = getRandomBigInt(min, contributorBalance)

      if (res.gt(contributorBalance)) {
        res = contributorBalance
      }

      if (logBalance) {
        // eslint-disable-next-line
        console.log(chalk.yellowBright(`For address ${contributor}:`))
        // eslint-disable-next-line
        console.log(
          chalk.yellow('Contributor balance:'),
          web3.fromWei(contributorBalance).toString(),
          'ETH'
        )
        // eslint-disable-next-line
        console.log(chalk.yellow('Token Lock Amount:'), res.toString(), 'BBK')
      }

      return res
    })
  )
}

const testRandomLockAndUnlock = async (
  bbk,
  act,
  contributors,
  {
    rounds = 10,
    min = new BigNumber(1e15),
    logBalance = false,
    logRoundInfo = true
  } = {}
) => {
  for (let i = 0; i < rounds; i++) {
    // Lock random amount of BBK Tokens first
    await testApproveAndLockManyWithIndividualAmounts(
      bbk,
      act,
      contributors,
      await generateRandomLockAmounts(contributors, {
        min,
        logBalance
      })
    )

    await Promise.all(
      contributors.map(async contributor => {
        const lockedBbkAmount = await act.lockedBbkOf(contributor)
        const amount = getRandomBigInt(
          lockedBbkAmount.div(2).floor(),
          lockedBbkAmount
        )

        await testUnlockBBK(bbk, act, contributor, amount)
      })
    )

    if (logRoundInfo) {
      // eslint-disable-next-line
      console.log(chalk.green(`BBK Token Lock&Unlock passed ${i + 1} times.`))
    }
  }
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
  testTransferFromActMany,
  testApproveAndLockManyWithIndividualAmounts,
  testTransferActManyWithIndividualAmounts,
  generateRandomLockAmounts,
  testRandomLockAndUnlock
}
