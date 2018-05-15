const assert = require('assert')
const BigNumber = require('bignumber.js')

const {
  sendTransaction,
  getReceipt,
  getEtherBalance
} = require('../helpers/general')

const totalSupply = new BigNumber(33e18)
const fundingGoal = new BigNumber(10e18)
const gasPrice = new BigNumber(30e9)

async function testMultiBuyTokens(investors, contract, args) {
  assert(args.value, 'no value set in args!')

  const investAmount = args.value

  const totalInvestmentEth = investAmount.mul(investors.length)
  const totalInvestmentTokens = investAmount
    .mul(totalSupply)
    .div(fundingGoal)
    .floor()
    .mul(investors.length)
  const preContractTokenBalance = await contract.balanceOf(contract.address)
  const preContractEtherBalance = await getEtherBalance(contract.address)

  for (const investor of investors) {
    const preTokenBalance = await contract.balanceOf(investor)
    const preEtherBalance = await getEtherBalance(investor)
    await contract.whitelistAddress(investor)
    const tx = await contract.buy({
      from: investor,
      value: investAmount,
      gasPrice
    })
    const postTokenBalance = await contract.balanceOf(investor)
    const postEtherBalance = await getEtherBalance(investor)
    const gasUsed = tx.receipt.gasUsed
    const gasCost = gasPrice.mul(gasUsed)
    const expectedEtherBalance = preEtherBalance
      .minus(gasCost)
      .minus(investAmount)
    const expectedTokenBalance = preTokenBalance.add(
      investAmount
        .mul(totalSupply)
        .div(fundingGoal)
        .floor()
    )

    assert(
      postTokenBalance.toNumber() > 0,
      'the balance after buying should be more than 0'
    )
    assert.equal(
      postTokenBalance.toString(),
      expectedTokenBalance.toString(),
      `${investor} balance should match expectedTokenBalance`
    )
    assert.equal(
      postEtherBalance.toString(),
      expectedEtherBalance.toString(),
      `${investor} should be decremented by ${investAmount.toString()} ether`
    )
  }

  const postContractTokenBalance = await contract.balanceOf(contract.address)
  const postContractEtherBalance = await getEtherBalance(contract.address)

  assert.equal(
    preContractTokenBalance.minus(postContractTokenBalance).toString(),
    totalInvestmentTokens.toString(),
    'the contract token balance should be decremented by the total investment amount'
  )
  assert.equal(
    postContractEtherBalance.minus(preContractEtherBalance).toString(),
    totalInvestmentEth.toString(),
    'the contract ether balance should be incremented by the total investment amount'
  )
}

async function testFallbackBuy(web3, contract, args) {
  assert(args.value, 'value has not been set in args!')
  assert(args.from, 'from has not been set in args!')

  const investor = args.from
  const investAmount = args.value

  const preInvestorTokenBalance = await contract.balanceOf(investor)
  const preInvestorEtherBalance = await getEtherBalance(investor)
  const preContractTokenBalance = await contract.balanceOf(contract.address)
  const preContractEtherBalance = await getEtherBalance(contract.address)

  const txHash = await sendTransaction(web3, {
    to: contract.address,
    from: investor,
    value: investAmount,
    gasPrice
  })
  const initialSupply = await contract.initialSupply()
  const tx = await getReceipt(txHash)
  const gasUsed = tx.gasUsed
  const gasCost = gasPrice.mul(gasUsed)
  const expectedTokenPurchaseAmount = investAmount
    .mul(initialSupply)
    .div(fundingGoal)
    .toFixed(0)

  const expectedInvestorEtherBalance = preInvestorEtherBalance
    .minus(gasCost)
    .minus(investAmount)
  const postInvestorTokenBalance = await contract.balanceOf(investor)
  const postInvestorEtherBalance = await getEtherBalance(investor)
  const postContractTokenBalance = await contract.balanceOf(contract.address)
  const postContractEtherBalance = await getEtherBalance(contract.address)

  assert.equal(
    postInvestorTokenBalance.minus(preInvestorTokenBalance).toString(),
    expectedTokenPurchaseAmount.toString(),
    'the investor token balance should be incremented by the right amount'
  )
  assert.equal(
    expectedInvestorEtherBalance.toString(),
    postInvestorEtherBalance.toString(),
    'the investor ether balance should be decremented by the sent ether amount'
  )
  assert.equal(
    preContractTokenBalance.minus(postContractTokenBalance).toString(),
    expectedTokenPurchaseAmount.toString(),
    'the contract token balance should be decremented by the investAmount'
  )
  assert.equal(
    postContractEtherBalance.minus(preContractEtherBalance).toString(),
    investAmount.toString(),
    'the contract ether balance should be incremented by the investAmount'
  )
}

async function testBuyRemainingTokens(contract, accounts, args) {
  assert(args.from, 'from has not been set in args!')

  const investor = args.from
  const intialSupply = await contract.initialSupply()

  const preContractStage = await contract.stage()
  const preInvestorTokenBalance = await contract.balanceOf(investor)
  const preInvestorEtherBalance = await getEtherBalance(investor)
  const preFundedAmount = await contract.fundedAmount()
  const overpayAmountEth = fundingGoal.sub(preFundedAmount).add(1e18)
  const refundAmount = preFundedAmount.add(overpayAmountEth).sub(fundingGoal)

  const tx = await contract.buy({
    from: investor,
    value: overpayAmountEth,
    gasPrice
  })

  const postInvestorTokenBalance = await contract.balanceOf(investor)
  const postInvestorEtherBalance = await getEtherBalance(investor)
  const postContractTokenBalance = await contract.balanceOf(contract.address)
  const postContractStage = await contract.stage()
  const gasCost = gasPrice.mul(tx.receipt.gasUsed)
  const postExpectedInvestorEtherBalance = preInvestorEtherBalance
    .sub(gasCost)
    .sub(overpayAmountEth)
    .add(refundAmount)
  const postExpectedInvestorTokenIncrement = overpayAmountEth
    .sub(refundAmount)
    .mul(1e18)
    .mul(intialSupply)
    .div(fundingGoal)
    .div(1e18)
    .floor()
  const postFundedAmount = await contract.fundedAmount()

  assert.equal(
    postInvestorTokenBalance.minus(preInvestorTokenBalance).toString(),
    postExpectedInvestorTokenIncrement.toString(),
    'the investor token balance should be incremented by the expected amount'
  )
  assert.equal(
    postInvestorEtherBalance.toString(),
    postExpectedInvestorEtherBalance.toString(),
    'the investor ether balance should be decremented by the expected amount and credited the refund amount if overpaid'
  )
  assert.equal(
    postFundedAmount.toString(),
    fundingGoal.toString(),
    'the fundingGoal and fundedAmount should be equal'
  )
  assert.equal(
    postContractTokenBalance.toString(),
    new BigNumber(0).toString(),
    'the contract should now have a Token balance of 0'
  )
  assert.equal(
    preContractStage.toString(),
    new BigNumber(0),
    'the contract should start this test in stage 0 (funding)'
  )
  assert.equal(
    postContractStage.toString(),
    new BigNumber(1),
    'the contract should be in stage 1 (pending) after all tokens are bought'
  )
}

async function testActivation(contract, args) {
  assert(args.from, 'args.from not set!')

  const contractValue = await contract.fundingGoal()
  const fee = await contract.calculateFee(contractValue)
  args.value = fee
  await contract.activate(args)
  const currentStage = await contract.stage()

  assert.equal(
    currentStage.toNumber(),
    3,
    'the contract stage should be 3 (active)'
  )
}

async function testOwnerWithdrawFees(cpoa, owner) {
  const preOwnerEtherBalance = await getEtherBalance(owner)
  const preContractEtherBalance = await getEtherBalance(cpoa.address)
  const preOwnerUnclaimedBalance = await cpoa.unclaimedPayoutTotals(owner)
  const txHash = await cpoa.claim({
    from: owner,
    gasPrice
  })

  const tx = await getReceipt(txHash)

  const postOwnerEtherBalance = await getEtherBalance(owner)
  const postContractEtherBalance = await getEtherBalance(cpoa.address)
  const postOwnerUnclaimedBalance = await cpoa.unclaimedPayoutTotals(owner)
  const gasUsed = new BigNumber(tx.gasUsed)
  const gasCost = gasUsed.mul(gasPrice)
  const expectedOwnerEtherBalance = preOwnerEtherBalance
    .add(preOwnerUnclaimedBalance)
    .minus(gasCost)

  assert.equal(
    postOwnerEtherBalance.toString(),
    expectedOwnerEtherBalance.toString(),
    'the owner ether balance should be incremented by the unclaimedPayoutTotals[owner]'
  )
  assert.equal(
    preContractEtherBalance.minus(postContractEtherBalance).toString(),
    preOwnerUnclaimedBalance.toString(),
    'the contract ether balance should be decremented by the unclaimedPayoutTotals[owner]'
  )
  assert.equal(
    postOwnerUnclaimedBalance.toString(),
    new BigNumber(0).toString(),
    'the owner unclaimed balance should be 0'
  )

  return true
}

async function testCustodianWithdrawFees(cpoa, custodian) {
  const preCustodianEtherBalance = await getEtherBalance(custodian)
  const preContractEtherBalance = await getEtherBalance(cpoa.address)
  const preCustodianUnclaimedBalance = await cpoa.unclaimedPayoutTotals(
    custodian
  )

  const txHash = await cpoa.claim({
    from: custodian,
    gasPrice
  })

  const tx = await getReceipt(txHash)

  const postCustodianEtherBalance = await getEtherBalance(custodian)
  const postContractEtherBalance = await getEtherBalance(cpoa.address)
  const postCustodianUnclaimedBalance = await cpoa.unclaimedPayoutTotals(
    custodian
  )
  const gasUsed = new BigNumber(tx.gasUsed)
  const gasCost = gasUsed.mul(gasPrice)
  const expectedCustodianEtherBalance = preCustodianEtherBalance
    .add(preCustodianUnclaimedBalance)
    .minus(gasCost)
  assert.equal(
    postCustodianEtherBalance.toString(),
    expectedCustodianEtherBalance.toString(),
    'the custodian ether balance should be incremented by the unclaimedPayoutTotals[custodian]'
  )
  assert.equal(
    preContractEtherBalance.minus(postContractEtherBalance).toString(),
    preCustodianUnclaimedBalance.toString(),
    'the contract ether balance should be decremented by the unclaimedPayoutTotals[custodian]'
  )
  assert.equal(
    postCustodianUnclaimedBalance.toString(),
    new BigNumber(0).toString(),
    'the custodian unclaimed balance should be 0'
  )

  return true
}

async function testTransfer(to, value, contract, args) {
  assert(args.from, 'args.from not set!')
  const sender = args.from
  const receiver = to
  const transferAmount = value
  const preSenderBalance = await contract.balanceOf(sender)
  const preReceiverBalance = await contract.balanceOf(receiver)

  await contract.transfer(receiver, transferAmount, args)

  const postSenderBalance = await contract.balanceOf(sender)
  const postReceiverBalance = await contract.balanceOf(receiver)

  assert.equal(
    preSenderBalance.minus(postSenderBalance).toString(),
    transferAmount.toString(),
    'the sender token balance should be decremented by the transferAmount'
  )
  assert.equal(
    postReceiverBalance.minus(preReceiverBalance).toString(),
    transferAmount.toString(),
    'the receiver token balance should be incrementd by the transferAmount'
  )
  return true
}

async function testApproveTransferFrom(
  allowanceOwner,
  allowanceSpender,
  allowanceAmount,
  to,
  value,
  contract
) {
  // approve functions/tests
  let preSpenderAllowance = await contract.allowance(
    allowanceOwner,
    allowanceSpender
  )

  await contract.approve(allowanceSpender, allowanceAmount, {
    from: allowanceOwner
  })

  let postSpenderAllowance = await contract.allowance(
    allowanceOwner,
    allowanceSpender
  )

  assert.equal(
    postSpenderAllowance.minus(preSpenderAllowance).toString(),
    allowanceAmount.toString(),
    'the allowanceSpender should have their allowance for allowanceOwner incremented by allowedAmount'
  )

  // transferFrom functions/tests
  const preOwnerTokenBalance = await contract.balanceOf(allowanceOwner)
  const preReceiverBalance = await contract.balanceOf(to)
  preSpenderAllowance = await contract.allowance(
    allowanceOwner,
    allowanceSpender
  )

  await contract.transferFrom(allowanceOwner, to, value, {
    from: allowanceSpender
  })

  const postOwnerTokenBalance = await contract.balanceOf(allowanceOwner)
  const postReceiverBalance = await contract.balanceOf(to)
  postSpenderAllowance = await contract.allowance(
    allowanceOwner,
    allowanceSpender
  )

  assert.equal(
    preOwnerTokenBalance.minus(postOwnerTokenBalance).toString(),
    value.toString(),
    'the owner balance should be decremented by the transferFrom amount'
  )
  assert.equal(
    postReceiverBalance.minus(preReceiverBalance).toString(),
    value.toString(),
    'the spender balance should be incremented by the transferFrom amount'
  )
  assert.equal(
    preSpenderAllowance.minus(postSpenderAllowance).toString(),
    value.toString(),
    'the spender allowance should be decremented by the transferFrom amount'
  )
}

async function testPayout(contract, args) {
  const owner = await contract.owner()
  const custodian = await contract.custodian()
  const initialSupply = await contract.initialSupply()
  const payoutValue = args.value
  const _fee = await contract.calculateFee(payoutValue)
  const fee = _fee.add(
    payoutValue
      .sub(_fee)
      .mul(1e18)
      .mod(totalSupply)
      .div(1e18)
      .floor()
  )

  const preContractTotalTokenPayout = await contract.totalPerTokenPayout()
  const preCustodianEtherBalance = await getEtherBalance(custodian)
  const preContractEtherBalance = await getEtherBalance(contract.address)

  assert(args.from, 'from not included in args!')
  assert(args.value, 'value not included in args!')

  const tx = await contract.payout(args)
  await testOwnerWithdrawFees(contract, owner)
  const postContractTotalTokenPayout = await contract.totalPerTokenPayout()
  const currentExpectedTotalTokenPayout = payoutValue
    .minus(_fee)
    .mul(1e18)
    .div(initialSupply)
    .floor()
  const expectedContractTotalTokenPayout = preContractTotalTokenPayout.add(
    currentExpectedTotalTokenPayout
  )
  const postCustodianEtherBalance = await getEtherBalance(custodian)
  const expectedCustodianEtherBalance = preCustodianEtherBalance
    .minus(gasPrice.mul(tx.receipt.gasUsed))
    .minus(payoutValue)
  const postContractEtherBalance = await getEtherBalance(contract.address)
  const expectedContractEtherBalance = payoutValue.minus(fee)

  assert.equal(
    postContractTotalTokenPayout.toString(),
    expectedContractTotalTokenPayout.toString(),
    'the contract totalPerTokenPayout should match the expected value'
  )
  assert.equal(
    expectedCustodianEtherBalance.toString(),
    postCustodianEtherBalance.toString(),
    'the expected custodian ether balance should match actual after payout'
  )
  assert.equal(
    postContractEtherBalance.minus(preContractEtherBalance).toString(),
    expectedContractEtherBalance.toString(),
    'the contact ether balance should be incremented by the payoutValue minus fees'
  )

  return postContractEtherBalance
}

async function testClaimAllPayouts(investors, contract) {
  const stage = await contract.stage()
  assert.equal(
    stage.toNumber(),
    3,
    'the stage of the contract should be in 3 (active)'
  )

  let totalClaimAmount = new BigNumber(0)

  for (const investor of investors) {
    const investorClaimAmount = await contract.currentPayout(investor, true)
    const preInvestorEtherBalance = await getEtherBalance(investor)
    const preContractEtherBalance = await getEtherBalance(contract.address)

    if (investorClaimAmount.greaterThan(0)) {
      const tx = await contract.claim({
        from: investor,
        gasPrice
      })

      const gasUsed = tx.receipt.gasUsed || new BigNumber(0)
      const gasCost = gasPrice.mul(gasUsed)
      const expectedInvestorEtherBalance = preInvestorEtherBalance
        .minus(gasCost)
        .add(investorClaimAmount)

      const postInvestorEtherBalance = await getEtherBalance(investor)
      const postContractEtherBalance = await getEtherBalance(contract.address)

      assert.equal(
        expectedInvestorEtherBalance.toString(),
        postInvestorEtherBalance.toString(),
        'the investor ether balance should match expected balance after claiming'
      )
      assert.equal(
        preContractEtherBalance.minus(postContractEtherBalance).toString(),
        investorClaimAmount.toString(),
        'the contract ether balance should be decremented by the investorClaimAmount'
      )
      totalClaimAmount = totalClaimAmount.add(investorClaimAmount)
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `⚠️ ${investor} has 0 claimable balances... this may happen due to current test setup, be sure that this is correct`
      )
    }
  }

  const finalContractEtherBalance = await getEtherBalance(contract.address)

  assert(
    totalClaimAmount.greaterThan(0),
    'the total claim amount should be more than 0'
  )
  assert(
    finalContractEtherBalance.lessThan(100),
    `the contract should have very small ether balance after all payouts have been claimed but ${finalContractEtherBalance} wei remain`
  )

  return true
}

async function testKill(owner, contract) {
  const preContractEtherBalance = await getEtherBalance(contract.address)
  const preOwnerEtherBalance = await getEtherBalance(owner)

  const meta = await contract.kill({
    from: owner,
    gasPrice
  })
  const gasUsed = meta.receipt.gasUsed
  const gasCost = gasPrice.mul(gasUsed)
  const expectedOwnerEtherBalance = preOwnerEtherBalance
    .minus(gasCost)
    .add(preContractEtherBalance)
  const postContractEtherBalance = await getEtherBalance(contract.address)
  const postOwnerEtherBalance = await getEtherBalance(owner)

  assert(
    meta.logs.map(i => i.event).includes('TerminatedEvent'),
    'should have emitted terminated event'
  )

  assert.equal(
    meta.logs.filter(i => i.event == 'StageEvent')[0].args.stage.toString(),
    '4',
    'should have emitted Stage Terminate(4) event'
  )

  // is paused and terminated
  assert(await contract.paused(), 'should be paused')
  assert.equal(
    (await contract.stage()).toString(),
    '4',
    'should be in Terminated stage'
  )

  assert.equal(
    postOwnerEtherBalance.toString(),
    expectedOwnerEtherBalance.toString(),
    'owner balance should be incremented by the contract balance'
  )

  assert.equal(
    postContractEtherBalance.toString(),
    new BigNumber(0).toString(),
    'the contract ether balance should be 0'
  )
}

async function getAccountInformation(address, contract) {
  const etherBalance = await getEtherBalance(address)
  const tokenBalance = await contract.balanceOf(address)
  const currentPayout = await contract.currentPayout(address, true)

  return {
    etherBalance,
    tokenBalance,
    currentPayout
  }
}

const testClearDust = async (cpoa, investors) => {
  for (const investor of investors) {
    const preInvestorEthBalance = await getEtherBalance(investor)
    const preUnclaimedBalance = await cpoa.unclaimedPayoutTotals(investor)

    if (preUnclaimedBalance.greaterThan(0)) {
      await cpoa.claim({
        from: investor
      })
      const postInvestorEthBalance = await getEtherBalance(investor)
      const postUnclaimedBalance = await cpoa.unclaimedPayoutTotals(investor)
      assert.equal(
        postInvestorEthBalance.sub(preInvestorEthBalance).toString(),
        preUnclaimedBalance.toString(),
        'investor eth balance should be incremented by preUnclaimedBalance'
      )
      assert.equal(
        postUnclaimedBalance.toString(),
        new BigNumber(0).toString(),
        'investor unclaimed balance should now be 0'
      )
    }
  }
}

// end scenario testing functions

module.exports = {
  testMultiBuyTokens,
  testFallbackBuy,
  testBuyRemainingTokens,
  testActivation,
  testOwnerWithdrawFees,
  testCustodianWithdrawFees,
  testTransfer,
  testApproveTransferFrom,
  testPayout,
  testClaimAllPayouts,
  testKill,
  getAccountInformation,
  totalSupply,
  fundingGoal,
  gasPrice,
  testClearDust
}
