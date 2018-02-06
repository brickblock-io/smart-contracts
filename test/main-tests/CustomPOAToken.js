const CustomPOAToken = artifacts.require('CustomPOAToken')
const WarpTool = artifacts.require('WarpTool')
const assert = require('assert')
const BigNumber = require('bignumber.js')

function getEtherBalance(address) {
  return new Promise((resolve, reject) => {
    web3.eth.getBalance(address, (err, res) => {
      if (err) reject(err)
      resolve(res)
    })
  })
}

function warpBlocks(blocks) {
  return new Promise((resolve, reject) => {
    contract('WarpTool', async accounts => {
      const warpTool = await WarpTool.new()
      for (let i = 0; i < blocks - 1; i++) {
        await warpTool.warp()
      }
      resolve(true)
    })
  })
}

function sendTransaction(args) {
  return new Promise(function(resolve, reject) {
    web3.eth.sendTransaction(args, (err, res) => {
      if (err) {
        reject(err)
      } else {
        resolve(res)
      }
    })
  })
}

function getReceipt(txHash) {
  // seems that sometimes actual transaction is returned instead of txHash
  if (typeof txHash === 'object') {
    return txHash.receipt
  }
  return new Promise(function(resolve, reject) {
    web3.eth.getTransactionReceipt(txHash, (err, res) => {
      if (err) {
        reject(err)
      }
      resolve(res)
    })
  })
}

// start scenario testing functions

async function testMultiBuyTokens(investors, contract, args) {
  assert(args.gasPrice, 'no gasPrice set in args!')
  assert(args.value, 'no value set in args!')

  const investAmount = args.value
  const gasPrice = args.gasPrice

  const totalSupply = await contract.totalSupply()
  const fundingGoal = await contract.fundingGoal()

  const totalInvestmentEth = investAmount.mul(investors.length)
  const totalInvestmentTokens = investAmount
    .mul(totalSupply)
    .div(fundingGoal)
    .floor()
    .mul(investors.length)
  const preContractTokenBalance = await contract.balanceOf(contract.address)
  const preContractEtherBalance = await getEtherBalance(contract.address)

  for (let investor of investors) {
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

async function testFallbackBuy(contract, args) {
  assert(args.value, 'value has not been set in args!')
  assert(args.gasPrice, 'gasPrice has not been set in args!')
  assert(args.from, 'from has not been set in args!')

  const investor = args.from
  const investAmount = args.value
  const gasPrice = args.gasPrice

  const preInvestorTokenBalance = await contract.balanceOf(investor)
  const preInvestorEtherBalance = await getEtherBalance(investor)
  const preContractTokenBalance = await contract.balanceOf(contract.address)
  const preContractEtherBalance = await getEtherBalance(contract.address)

  const txHash = await sendTransaction({
    to: contract.address,
    from: investor,
    value: investAmount,
    gasPrice
  })
  const initialSupply = await contract.initialSupply()
  const fundingGoal = await contract.fundingGoal()
  const tx = await getReceipt(txHash)
  const gasUsed = tx.gasUsed
  const gasCost = gasPrice.mul(gasUsed)
  const expectedTokenPurchaseAmount = investAmount
    .mul(initialSupply)
    .div(fundingGoal)

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

async function testBuyRemainingTokens(fundingGoal, contract, args) {
  assert(args.gasPrice, 'gasPrice has not been set in args!')
  assert(args.from, 'from has not been set in args!')

  const investor = args.from
  const gasPrice = args.gasPrice

  const totalSupply = await contract.totalSupply()

  const preContractStage = await contract.stage()
  const preInvestorTokenBalance = await contract.balanceOf(investor)
  const preInvestorEtherBalance = await getEtherBalance(investor)
  const preContractEtherBalance = await getEtherBalance(contract.address)
  const neededAmountEth = fundingGoal.sub(preContractEtherBalance)

  const tx = await contract.buy({
    from: investor,
    value: neededAmountEth,
    gasPrice
  })

  const postInvestorTokenBalance = await contract.balanceOf(investor)
  const postInvestorEtherBalance = await getEtherBalance(investor)
  const postContractTokenBalance = await contract.balanceOf(contract.address)
  const postContractEtherBalance = await getEtherBalance(contract.address)
  const postContractStage = await contract.stage()
  const gasCost = gasPrice.mul(tx.receipt.gasUsed)
  const postExpectedInvestorEtherBalance = preInvestorEtherBalance
    .sub(gasCost)
    .sub(neededAmountEth)
  const postExpectedIvestorTokenAmount = neededAmountEth
    .mul(totalSupply)
    .div(fundingGoal)
    .floor()

  assert.equal(
    postInvestorTokenBalance.minus(preInvestorTokenBalance).toString(),
    postExpectedIvestorTokenAmount.toString(),
    'the investor token balance should be incremented by that bought'
  )
  assert.equal(
    postInvestorEtherBalance.toString(),
    postExpectedInvestorEtherBalance.toString(),
    'the investor ether balance should be decremented by the expected amount'
  )
  assert.equal(
    postContractTokenBalance.toString(),
    new BigNumber(0).toString(),
    'the contract should now have a Token balance of 0'
  )
  assert.equal(
    postContractEtherBalance.toString(),
    fundingGoal.toString(),
    'the contract ether balance should match the funding goal when all tokens are bought'
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
  assert(!!args.from, 'args.from not set!')
  assert(!!args.gasPrice, 'args.gasPrice not set!')

  const contractValue = await contract.fundingGoal()
  const fee = await contract.calculateFee(contractValue)
  args.value = args.value ? args.value : fee
  await contract.activate(args)
  currentStage = await contract.stage()

  assert.equal(
    currentStage.toNumber(),
    3,
    'the contract stage should be 3 (active)'
  )
}

async function testOwnerWithdrawFees(cpoa, owner) {
  const gasPrice = new BigNumber(30e9)
  const preOwnerEtherBalance = await getEtherBalance(owner)
  const preContractEtherBalance = await getEtherBalance(cpoa.address)
  const preOwnerUnclaimedBalance = await cpoa.unclaimedPayoutTotals(owner)

  const txHash = await cpoa.claim.sendTransaction({
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
    new BigNumber(0).toString()
  )

  return true
}

async function testCustodianWithdrawFees(cpoa, custodian) {
  const gasPrice = new BigNumber(30e9)
  const preCustodianEtherBalance = await getEtherBalance(custodian)
  const preContractEtherBalance = await getEtherBalance(cpoa.address)
  const preCustodianUnclaimedBalance = await cpoa.unclaimedPayoutTotals(
    custodian
  )

  const txHash = await cpoa.claim.sendTransaction({
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
    new BigNumber(0).toString()
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
  const totalSupply = await contract.totalSupply()
  const payoutValue = args.value
  const gasPrice = args.gasPrice
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
  const preOwnerEtherBalance = await getEtherBalance(owner)

  assert(args.gasPrice, 'gasPrice not included in args!')
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
  const postOwnerEtherBalance = await getEtherBalance(owner)

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

async function testClaimAllPayouts(investors, contract, args) {
  assert(args.gasPrice, 'no gas price set in args!')
  const gasPrice = args.gasPrice

  const stage = await contract.stage()
  assert.equal(
    stage.toNumber(),
    3,
    'the stage of the contract should be in 3 (active)'
  )

  let totalClaimAmount = new BigNumber(0)

  for (let investor of investors) {
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
      console.log(
        `⚠️ ${
          investor
        } has 0 claimable balances... are you sure this should happen?`
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
    'the contract should have very small ether balance after all payouts have been claimed but ${finalContractEtherBalance} wei remain'
  )

  return true
}

async function testWillThrow(fn, args) {
  try {
    await fn.apply(null, args)
    assert(false, 'the contract should throw here')
  } catch (error) {
    assert(
      /invalid opcode/.test(error),
      `the error message should be invalid opcode, the error was ${error}`
    )
  }
}

async function testKill(contract) {
  const accounts = web3.eth.accounts
  const owner = accounts[0]
  const broker = accounts[1]
  const custodian = accounts[2]
  const investors = accounts.slice(3)

  const fundingGoal = contract.fundingGoal()
  const totalSupply = contract.totalSupply()

  const preContractEtherBalance = await getEtherBalance(contract.address)
  const preOwnerEtherBalance = await getEtherBalance(owner)

  // only owner can call kill
  await testWillThrow(contract.kill, [{ from: custodian }])

  const meta = await contract.kill({ from: owner, gasPrice: 0 })

  // Events
  assert(
    meta.logs.map(i => i.event).includes('Terminated'),
    'should have emitted terminated event'
  )
  assert.equal(
    meta.logs.filter(i => i.event == 'Stage')[0].args.stage.toString(),
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

  // did send ether to onwer
  const ownerEtherBalanceDelta = (await getEtherBalance(owner)).sub(
    preOwnerEtherBalance
  )
  assert.equal(
    ownerEtherBalanceDelta.toString(),
    preContractEtherBalance.toString(),
    'owner balance should have changed by the contract balance'
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

// end scenario testing functions

describe('when first deploying', () => {
  contract('CustomPOAToken', accounts => {
    const owner = accounts[0]
    const broker = accounts[1]
    const custodian = accounts[2]
    const investors = accounts.slice(3)
    const totalSupply = new BigNumber(20e18)
    const fundingGoal = new BigNumber(20e18)
    const timeoutBlock = web3.eth.blockNumber + 200
    let cpoa

    before('setup state', async () => {
      cpoa = await CustomPOAToken.new(
        'ProofOfAwesome',
        'POA',
        broker,
        custodian,
        timeoutBlock,
        totalSupply,
        fundingGoal
      )
    })

    it('should initalize with the correct values', async () => {
      const name = await cpoa.name()
      const symbol = await cpoa.symbol()
      const contractBroker = await cpoa.broker()
      const contractCustodian = await cpoa.custodian()
      const actualTimeoutBlock = await cpoa.timeoutBlock()
      const contractTotalSupply = await cpoa.totalSupply()
      const contractTokenBalance = await cpoa.balanceOf(cpoa.address)
      const decimals = await cpoa.decimals()
      const feeRate = await cpoa.feeRate()

      assert.equal(
        name,
        'ProofOfAwesome',
        'the name should match that given in the constructor'
      )
      assert.equal(
        symbol,
        'POA',
        'the token symbol should match that given in the constructor'
      )
      assert.equal(
        contractBroker,
        broker,
        'the broker should match that given in the constructor'
      )
      assert.equal(
        contractCustodian,
        custodian,
        'the custodian should match that given in the constructor'
      )
      assert.equal(
        timeoutBlock.toString(),
        actualTimeoutBlock.toString(),
        'the timeoutBlock should match that given in the constructor'
      )
      assert.equal(
        contractTotalSupply.toString(),
        totalSupply.toString(),
        'the total supply should match that given in the constructor'
      )
      assert.equal(
        decimals.toString(),
        new BigNumber(18).toString(),
        'the contract decimals should match the expected value'
      )
      assert.equal(
        feeRate.toString(),
        new BigNumber(5).toString(),
        'the contract feeRate should match the expected value'
      )
    })

    it('should kill the Token when in funding Stage', async () => {
      assert.equal(
        (await cpoa.stage()).toString(),
        '0',
        'should be in funding stage'
      )
      await testKill(cpoa)
    })
  })
})

describe('when in Funding stage', () => {
  contract('CustomPOAToken', accounts => {
    const owner = accounts[0]
    const broker = accounts[1]
    const custodian = accounts[2]
    const nonInvestor = accounts[3]
    const investors = accounts.slice(4)
    const totalSupply = new BigNumber(10e18)
    const fundingGoal = new BigNumber(20e18)
    const gasPrice = new BigNumber(30e9)
    const tokenSalePrice = totalSupply.div(fundingGoal)
    let cpoa

    before('setup state', async () => {
      cpoa = await CustomPOAToken.new(
        'ProofOfAwesome',
        'POA',
        broker,
        custodian,
        web3.eth.blockNumber + 200,
        totalSupply,
        fundingGoal
      )
    })

    it('should start with NO investors whitelisted', async () => {
      for (let investor of investors) {
        const whitelisted = await cpoa.whitelisted(investor)
        assert.equal(
          whitelisted,
          false,
          'the investor should be NOT whitelisted'
        )
      }
    })

    it('should NOT blacklist already blacklisted investors', async () => {
      for (let investor of investors) {
        await testWillThrow(cpoa.blacklistAddress, [investor, { from: owner }])
      }
    })

    it('should NOT whitelist investors if NOT owner', async () => {
      await testWillThrow(cpoa.whitelistAddress, [
        investors[0],
        { from: custodian }
      ])
    })

    it('should whitelist investors if owner', async () => {
      for (let investor of investors) {
        await cpoa.whitelistAddress(investor)
        const whitelisted = await cpoa.whitelisted(investor)
        assert.equal(whitelisted, true, 'the investor should be whitelisted')
      }
    })

    it('should NOT whitelist already whitelisted investors', async () => {
      for (let investor of investors) {
        await testWillThrow(cpoa.whitelistAddress, [investor, { from: owner }])
      }
    })

    it('should NOT blacklist investors if NOT owner', async () => {
      await testWillThrow(cpoa.blacklistAddress, [
        investors[0],
        { from: custodian }
      ])
    })

    it('should blacklist whitelisted investors if owner', async () => {
      for (let investor of investors) {
        const preInvestorStatus = await cpoa.whitelisted(investor)
        await cpoa.blacklistAddress(investor)
        const postInvestorStatus = await cpoa.whitelisted(investor)
        assert.equal(
          preInvestorStatus,
          true,
          'the investor should start whitelisted from previous test'
        )
        assert.equal(
          postInvestorStatus,
          false,
          'the investor should be blacklisted after blacklist function'
        )
      }
    })

    it('should allow buying from whitelisted investors', async () => {
      await testMultiBuyTokens(investors, cpoa, {
        gasPrice,
        value: new BigNumber(1e18)
      })
    })

    it('should NOT allow buying for blacklisted investors', async () => {
      const nonInvestorStatus = await cpoa.whitelisted(nonInvestor)
      assert(!nonInvestorStatus, 'the investor should NOT be whitelisted')
      await testWillThrow(cpoa.buy, [
        {
          from: nonInvestor,
          value: 1e18
        }
      ])
    })

    it('should NOT allow buying more than the contract token balance', async () => {
      const investor = investors[0]
      const investorStatus = await cpoa.whitelisted(investor)
      assert(investorStatus, 'the investor should be whitelisted')
      const contractEtherBalance = await getEtherBalance(cpoa.address)
      const overInvestAmount = fundingGoal.minus(contractEtherBalance).add(2)
      // [TODO] this should work with 1 too
      await testWillThrow(cpoa.buy, [
        {
          from: investor,
          value: overInvestAmount
        }
      ])
    })

    it('should use the buy function as a fallback', async () => {
      await testFallbackBuy(cpoa, {
        from: investors[0],
        value: new BigNumber(1e18),
        gasPrice
      })
    })

    // start expected impossible functions at Stages.Funding

    it('should NOT unpause even if owner', async () => {
      await testWillThrow(cpoa.unpause, [{ from: owner }])
    })

    it('should NOT activate even if custodian', async () => {
      const fee = await cpoa.calculateFee(totalSupply)
      await testWillThrow(cpoa.activate, [{ from: custodian, value: fee }])
    })

    it('should NOT terminate even if custodian', async () => {
      await testWillThrow(cpoa.terminate, [{ from: custodian }])
    })

    it('should NOT reclaim even if investor with invested amount', async () => {
      const investor = investors[0]
      const investorTokenBalance = await cpoa.balanceOf(investor)
      assert(
        investorTokenBalance.toNumber() > 0,
        'the investor should have a balance more than 0 from previous tests'
      )
      await testWillThrow(cpoa.reclaim, [{ from: investor }])
    })

    it('should NOT payout even if custodian with ether paid', async () => {
      await testWillThrow(cpoa.payout, [{ from: custodian, value: 1e18 }])
    })

    it('should NOT claim even if investor with invested amount', async () => {
      const investor = investors[0]
      const investorTokenBalance = await cpoa.balanceOf(investor)
      assert(
        investorTokenBalance.toNumber() > 0,
        'the investor token balance should be more than 0 from previous tests'
      )
      await testWillThrow(cpoa.claim, [{ from: investor }])
    })

    it('should NOT transfer even if investor has tokens', async () => {
      const investor = investors[0]
      const otherInvestor = investors[1]
      const investorTokenBalance = await cpoa.balanceOf(investor)
      assert(
        investorTokenBalance.toNumber() > 0,
        'the investor token balance should be more than 0 from previous tests'
      )
      await testWillThrow(cpoa.transfer, [
        otherInvestor,
        investorTokenBalance.div(2),
        { from: investor }
      ])
    })

    it('should NOT approve and thus also NOT transferFrom', async () => {
      const investor = investors[0]
      const otherInvestor = investors[1]
      await testWillThrow(cpoa.approve, [
        otherInvestor,
        1e18,
        { from: investor }
      ])
    })

    // end expected impossible functions at Stages.Funding

    it('should move to pending stage when all tokens have been bought', async () => {
      await testBuyRemainingTokens(fundingGoal, cpoa, {
        from: investors[0],
        gasPrice
      })
    })

    it('should kill the Token when in Pending Stage', async () => {
      assert.equal(
        (await cpoa.stage()).toString(),
        '1',
        'should be in Pending stage'
      )
      await testKill(cpoa)
    })
  })
})

describe('when in Pending stage', () => {
  contract('CustomPOAToken', accounts => {
    const owner = accounts[0]
    const broker = accounts[1]
    const custodian = accounts[2]
    const nonInvestor = accounts[3]
    const investors = accounts.slice(4)
    const totalSupply = new BigNumber(600e18).div(10)
    const fundingGoal = new BigNumber(150e18).div(10)
    const gasPrice = new BigNumber(30e9)
    const tokenSalePrice = totalSupply.div(fundingGoal)
    let cpoa

    before('setup state', async () => {
      const investAmount = new BigNumber(1e18)
      const bigInvestor = investors[0]
      cpoa = await CustomPOAToken.new(
        'ProofOfAwesome',
        'POA',
        broker,
        custodian,
        web3.eth.blockNumber + 200,
        totalSupply,
        fundingGoal
      )
      await testMultiBuyTokens(investors, cpoa, {
        value: investAmount,
        gasPrice: new BigNumber(21e9)
      })

      // get last of contract's balance and buy it up
      await testBuyRemainingTokens(fundingGoal, cpoa, {
        from: bigInvestor,
        gasPrice: new BigNumber(21e9)
      })

      const contractStage = await cpoa.stage()
      assert.equal(
        contractStage.toNumber(),
        1,
        'the contract should be in stage 1 (pending)'
      )
    })

    // start expected impossible functions at Stages.Pending

    it('should NOT unpause even if owner', async () => {
      await testWillThrow(cpoa.unpause, [{ from: owner }])
    })

    it('should NOT whitelist even if owner', async () => {
      const nonInvestorStatus = await cpoa.whitelisted(nonInvestor)
      assert(!nonInvestorStatus, 'the nonInvestor should not be whitelisted')
      await testWillThrow(cpoa.whitelistAddress, [nonInvestor, { from: owner }])
    })

    it('should NOT blacklist even if owner', async () => {
      const investorStatus = cpoa.whitelisted(investors[0])
      await testWillThrow(cpoa.blacklistAddress, [
        investors[0],
        { from: owner }
      ])
    })

    it('should NOT buy even if whitelisted', async () => {
      await testWillThrow(cpoa.buy, [{ from: investors[0], value: 1e18 }])
    })

    it('should NOT buy using the fallback function', async () => {
      const investor = investors[0]
      web3.eth.sendTransaction(
        {
          to: cpoa.address,
          from: investors[0],
          value: 1e18
        },
        async (error, response) => {
          if (response) {
            assert(false, 'the contract should throw here')
          }
          assert(
            /invalid opcode/.test(error),
            'the error message should contain invalid opcode'
          )
        }
      )
    })

    it('should NOT terminate even if custodian', async () => {
      await testWillThrow(cpoa.terminate, [{ from: custodian }])
    })

    it('should NOT reclaim even if investor with invested amount', async () => {
      const investor = investors[0]
      const investorTokenBalance = await cpoa.balanceOf(investor)
      assert(
        investorTokenBalance.toNumber() > 0,
        'the investor should have a balance more than 0 from previous tests'
      )
      await testWillThrow(cpoa.reclaim, [{ from: investor }])
    })

    it('should NOT payout even if custodian with ether paid', async () => {
      await testWillThrow(cpoa.payout, [{ from: custodian, value: 1e18 }])
    })

    it('should NOT claim even if investor with invested amount', async () => {
      const investor = investors[0]
      const investorTokenBalance = await cpoa.balanceOf(investor)
      assert(
        investorTokenBalance.toNumber() > 0,
        'the investor token balance should be more than 0 from previous tests'
      )
      await testWillThrow(cpoa.claim, [{ from: investor }])
    })

    it('should NOT transfer even if investor has tokens', async () => {
      const investor = investors[0]
      const otherInvestor = investors[1]
      const investorTokenBalance = await cpoa.balanceOf(investor)
      assert(
        investorTokenBalance.toNumber() > 0,
        'the investor token balance should be more than 0 from previous tests'
      )
      await testWillThrow(cpoa.transfer, [
        otherInvestor,
        investorTokenBalance.div(2),
        { from: investor }
      ])
    })

    it('should NOT approve and thus also NOT transferFrom', async () => {
      const investor = investors[0]
      const otherInvestor = investors[1]
      await testWillThrow(cpoa.approve, [
        otherInvestor,
        1e18,
        { from: investor }
      ])
    })

    // end expected impossible functions at Stages.Pending

    it('should NOT activate when not custodian', async () => {
      const contractValue = await cpoa.fundingGoal()
      const fee = await cpoa.calculateFee(contractValue)
      const gasPrice = new BigNumber(30e9)
      await testWillThrow(cpoa.activate, [
        {
          from: owner,
          value: fee,
          gasPrice
        }
      ])
    })

    it('should NOT activate when the fee is too high', async () => {
      const contractValue = await cpoa.fundingGoal()
      const fee = await cpoa.calculateFee(contractValue)
      const highFee = fee.mul(2)
      const gasPrice = new BigNumber(30e9)
      await testWillThrow(cpoa.activate, [
        {
          from: custodian,
          value: highFee,
          gasPrice
        }
      ])
    })

    it('should NOT activate when the fee is too low', async () => {
      const contractValue = await cpoa.fundingGoal()
      const fee = await cpoa.calculateFee(contractValue)
      const lowFee = fee.div(2)
      const gasPrice = new BigNumber(30e9)
      await testWillThrow(cpoa.activate, [
        {
          from: custodian,
          value: lowFee,
          gasPrice
        }
      ])
    })

    it('should activate when called by custodian with appropriate fee', async () => {
      const fundingGoal = await cpoa.fundingGoal()
      const fee = await cpoa.calculateFee(fundingGoal)
      const gasPrice = new BigNumber(30e9)

      const preCustodianUnclaimedBalance = await cpoa.unclaimedPayoutTotals(
        custodian
      )
      const preOwnerUnclaimedBalance = await cpoa.unclaimedPayoutTotals(owner)
      const preCustodianEtherBalance = await getEtherBalance(custodian)
      const preContractEtherBalance = await getEtherBalance(cpoa.address)
      const preContractStage = await cpoa.stage()

      assert.equal(
        preContractStage.toNumber(),
        1,
        'the contract stage should be 1 (pending)'
      )

      const txHash = await cpoa.activate({
        from: custodian,
        value: fee,
        gasPrice
      })

      const tx = await getReceipt(txHash)

      const postCustodianUnclaimedBalance = await cpoa.unclaimedPayoutTotals(
        custodian
      )
      const postOwnerUnclaimedBalance = await cpoa.unclaimedPayoutTotals(owner)
      const postCustodianEtherBalance = await getEtherBalance(custodian)
      const postContractEtherBalance = await getEtherBalance(cpoa.address)
      const postContractStage = await cpoa.stage()

      const gasUsed = new BigNumber(tx.gasUsed)
      const gasCost = gasUsed.mul(gasPrice)
      const expectedCustodianEtherBalance = preCustodianEtherBalance
        .minus(fee)
        .minus(gasCost)

      assert.equal(
        postContractStage.toNumber(),
        3,
        'the contract stage should be 3 (active)'
      )
      assert.equal(
        postOwnerUnclaimedBalance.minus(preOwnerUnclaimedBalance).toString(),
        fee.toString(),
        "the owner's ether balance should be incremented by the fee amount"
      )
      assert.equal(
        postCustodianUnclaimedBalance
          .minus(preCustodianUnclaimedBalance)
          .toString(),
        fundingGoal.toString(),
        'the custodian unclaimedPayoutTotals should be incremented by the funding goal'
      )
      assert.equal(
        postContractEtherBalance.minus(preContractEtherBalance).toString(),
        fee.toString(),
        'the contract ether balance should be incremented by the fee'
      )
      assert.equal(
        expectedCustodianEtherBalance.toString(),
        postCustodianEtherBalance.toString(),
        'the custodian ether balance should be decremented by the fee and gasCost'
      )
    })

    it('should allow owner fee claiming after activation', async () => {
      const gasPrice = new BigNumber(30e9)
      const preOwnerEtherBalance = await getEtherBalance(owner)
      const preContractEtherBalance = await getEtherBalance(cpoa.address)
      const preOwnerUnclaimedBalance = await cpoa.unclaimedPayoutTotals(owner)

      const txHash = await cpoa.claim.sendTransaction({
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
        new BigNumber(0).toString()
      )
    })

    it('should allow custodian balance claiming after activation', async () => {
      const gasPrice = new BigNumber(30e9)
      const preCustodianEtherBalance = await getEtherBalance(custodian)
      const preContractEtherBalance = await getEtherBalance(cpoa.address)
      const preCustodianUnclaimedBalance = await cpoa.unclaimedPayoutTotals(
        custodian
      )

      const txHash = await cpoa.claim.sendTransaction({
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
        new BigNumber(0).toString()
      )
    })

    it('should NOT activate again even if called by custodian with appropriate fee', async () => {
      const contractValue = await cpoa.fundingGoal()
      const fee = await cpoa.calculateFee(contractValue)
      await testWillThrow(cpoa.activate, [
        {
          from: custodian,
          value: fee
        }
      ])
    })

    it('should kill the Token when in Active Stage', async () => {
      assert.equal(
        (await cpoa.stage()).toString(),
        '3',
        'should be in active stage'
      )
      await testKill(cpoa)
    })
  })
})

describe('when in Active stage', () => {
  contract('CustomPOAToken', accounts => {
    const owner = accounts[0]
    const broker = accounts[1]
    const custodian = accounts[2]
    const nonInvestor = accounts[3]
    const investors = accounts.slice(4)
    const allowanceOwner = investors[0]
    const allowanceSpender = investors[1]
    const allowanceAmount = new BigNumber(5e17)
    const totalSupply = new BigNumber(600e18).div(10)
    const fundingGoal = new BigNumber(200e18).div(10)
    const gasPrice = new BigNumber(30e9)
    const tokenSalePrice = totalSupply.div(fundingGoal)
    let cpoa
    let ownerFee
    // amount paid by custodian - fee
    let totalPayoutAmount = new BigNumber(0)
    let totalPerTokenPayout = new BigNumber(0)
    let investorBalances = investors.reduce((balances, investor) => {
      return {
        ...balances,
        [investor]: new BigNumber(0)
      }
    }, {})

    before('setup state', async () => {
      //setup contract
      const investAmount = new BigNumber(1e18)
      const bigInvestor = investors[0]
      let currentStage
      cpoa = await CustomPOAToken.new(
        'ProofOfAwesome',
        'POA',
        broker,
        custodian,
        web3.eth.blockNumber + 200,
        totalSupply,
        fundingGoal
      )

      // claim tokens for investors
      await testMultiBuyTokens(investors, cpoa, {
        value: investAmount,
        gasPrice: new BigNumber(21e9)
      })

      // buy remaining tokens to go into pending
      await testBuyRemainingTokens(fundingGoal, cpoa, {
        from: bigInvestor,
        gasPrice: new BigNumber(21e9)
      })

      // activate the contract by custodian with proper fee
      await testActivation(cpoa, {
        from: custodian,
        gasPrice: new BigNumber(21e9)
      })

      await testOwnerWithdrawFees(cpoa, owner)
      await testCustodianWithdrawFees(cpoa, custodian)
    })

    it('should start in active stage unpaused', async () => {
      const paused = await cpoa.paused()
      assert(!paused, 'the contract should NOT be paused')
    })

    it('should NOT pause when NOT owner', async () => {
      await testWillThrow(cpoa.pause, [{ from: custodian }])
    })

    it('should pause when owner', async () => {
      const prePaused = await cpoa.paused()
      assert(!prePaused, 'the contract should NOT be paused')
      await cpoa.pause({
        from: owner
      })
      const postPaused = await cpoa.paused()
      assert(postPaused, 'the contract should be paused')
    })

    it('should NOT unpause when NOT owner', async () => {
      await testWillThrow(cpoa.unpause, [{ from: custodian }])
    })

    it('should unpause when owner', async () => {
      const prePaused = await cpoa.paused()
      assert(prePaused, 'the contract should be paused')
      await cpoa.unpause({
        from: owner
      })
      const postPaused = await cpoa.paused()
      assert(!postPaused, 'the contract should NOT be paused')
    })

    it('should NOT payout if NOT custodian', async () => {
      await testWillThrow(cpoa.payout, [{ from: owner, value: 1e18 }])
    })

    it('should NOT payout if 0 ether is sent', async () => {
      await testWillThrow(cpoa.payout, [{ from: custodian }])
    })

    it('should payout if custodian', async () => {
      const totalSupply = await cpoa.totalSupply()
      const payoutValue = new BigNumber(1e18)
      const gasPrice = new BigNumber(30e9)
      const _fee = await cpoa.calculateFee(payoutValue)
      const fee = _fee.add(
        payoutValue
          .sub(_fee)
          .mul(1e18)
          .mod(totalSupply)
          .div(1e18)
          .floor()
      )
      const preContractTotalTokenPayout = await cpoa.totalPerTokenPayout()
      const preCustodianEtherBalance = await getEtherBalance(custodian)
      const preContractEtherBalance = await getEtherBalance(cpoa.address)
      const preOwnerEtherBalance = await getEtherBalance(owner)

      const tx = await cpoa.payout({
        from: custodian,
        value: payoutValue,
        gasPrice
      })

      const postContractTotalTokenPayout = await cpoa.totalPerTokenPayout()
      // set to above closure for later testing...
      totalPerTokenPayout = totalPerTokenPayout.add(
        postContractTotalTokenPayout
      )
      const expectedContractTotalTokenPayout = preContractTotalTokenPayout
        .add(payoutValue)
        .minus(_fee)
        .mul(1e18)
        .div(totalSupply)
        .floor()
      const postCustodianEtherBalance = await getEtherBalance(custodian)
      const expectedCustodianEtherBalance = preCustodianEtherBalance
        .minus(gasPrice.mul(tx.receipt.gasUsed))
        .minus(payoutValue)
      const postContractEtherBalance = await getEtherBalance(cpoa.address)
      const postOwnerEtherBalance = await getEtherBalance(owner)

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
        payoutValue.toString(),
        'the contact ether balance should be incremented by the payoutValue'
      )
      // set for later test...
      ownerFee = fee
      totalPayoutAmount = totalPayoutAmount.add(postContractEtherBalance.minus(fee))
    })

    it('should allow owner to collect the fee after payout', async () => {
      const preOwnerUnclaimedBalance = await cpoa.unclaimedPayoutTotals(owner)

      await testOwnerWithdrawFees(cpoa, owner)

      assert.equal(
        preOwnerUnclaimedBalance.toString(),
        ownerFee.toString()
      )
    })

    it('should show the correct payout', async () => {
      let totalInvestorPayouts = new BigNumber(0)

      for (let investor of investors) {
        const tokenBalance = await cpoa.balanceOf(investor)
        const expectedPayout = tokenBalance
          .mul(totalPerTokenPayout)
          .div(1e18)
          .floor()
        const currentPayout = await cpoa.currentPayout(investor, true)

        assert.equal(
          currentPayout.toString(),
          expectedPayout.toString(),
          'the contract payout calculation should match the expected payout'
        )

        totalInvestorPayouts = totalInvestorPayouts.add(currentPayout)
      }

      assert.equal(
        totalInvestorPayouts.toString(),
        totalPayoutAmount.toString(),
        'the claimable payouts should match the actual payout amount'
      )
    })

    it('should claim as investor after payout', async () => {
      const gasPrice = new BigNumber(30e9)
      for (let investor of investors) {
        const investorClaimAmount = await cpoa.currentPayout(investor, true)
        const preInvestorEtherBalance = await getEtherBalance(investor)
        const preContractEtherBalance = await getEtherBalance(cpoa.address)

        const tx = await cpoa.claim({
          from: investor,
          gasPrice
        })
        const gasUsed = tx.receipt.gasUsed
        const gasCost = gasPrice.mul(gasUsed)
        const expectedInvestorEtherBalance = preInvestorEtherBalance
          .minus(gasCost)
          .add(investorClaimAmount)

        const postInvestorEtherBalance = await getEtherBalance(investor)
        const postContractEtherBalance = await getEtherBalance(cpoa.address)

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
      }
      const finalContractEtherBalance = await getEtherBalance(cpoa.address)
      assert.equal(
        finalContractEtherBalance.toString(),
        new BigNumber(0).toString(),
        'the contract should have no ether after all payouts have been claimed'
      )
    })

    it('should NOT claim if an address has no payout', async () => {
      await testWillThrow(cpoa.claim, [{ from: owner }])
    })

    it('should transfer', async () => {
      const sender = investors[0]
      const receiver = investors[1]
      const transferAmount = new BigNumber(5e17)
      const preSenderBalance = await cpoa.balanceOf(sender)
      const preReceiverBalance = await cpoa.balanceOf(receiver)

      await cpoa.transfer(receiver, transferAmount, {
        from: sender
      })

      const postSenderBalance = await cpoa.balanceOf(sender)
      const postReceiverBalance = await cpoa.balanceOf(receiver)

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
    })

    it('should NOT transfer when paused', async () => {
      await cpoa.pause()
      const sender = investors[0]
      const receiver = investors[1]
      const sendAmount = new BigNumber(1e18)
      await testWillThrow(cpoa.transfer, [
        receiver,
        sendAmount,
        { from: sender }
      ])
      await cpoa.unpause()
    })

    it('should approve', async () => {
      const preSpenderAllowance = await cpoa.allowance(
        allowanceOwner,
        allowanceSpender
      )

      await cpoa.approve(allowanceSpender, allowanceAmount, {
        from: allowanceOwner
      })

      const postSpenderAllowance = await cpoa.allowance(
        allowanceOwner,
        allowanceSpender
      )

      assert.equal(
        postSpenderAllowance.minus(preSpenderAllowance).toString(),
        allowanceAmount.toString(),
        'the allowanceSpender should have their allowance for allowanceOwner incremented by allowedAmount'
      )
    })

    it('should NOT approve when paused', async () => {
      await cpoa.pause()
      await testWillThrow(cpoa.approve, [
        allowanceOwner,
        allowanceAmount,
        { from: allowanceSpender }
      ])
      await cpoa.unpause()
    })

    it('should transferFrom', async () => {
      const preOwnerTokenBalance = await cpoa.balanceOf(allowanceOwner)
      const preSpenderTokenBalance = await cpoa.balanceOf(allowanceSpender)
      const preSpenderAllowance = await cpoa.allowance(
        allowanceOwner,
        allowanceSpender
      )

      await cpoa.transferFrom(
        allowanceOwner,
        allowanceSpender,
        allowanceAmount,
        {
          from: allowanceSpender
        }
      )

      const postOwnerTokenBalance = await cpoa.balanceOf(allowanceOwner)
      const postSpenderTokenBalance = await cpoa.balanceOf(allowanceSpender)
      const postSpenderAllowance = await cpoa.allowance(
        allowanceOwner,
        allowanceSpender
      )

      assert.equal(
        preOwnerTokenBalance.minus(postOwnerTokenBalance).toString(),
        allowanceAmount.toString(),
        'the owner balance should be decremented by the transferFrom amount'
      )
      assert.equal(
        postSpenderTokenBalance.minus(preSpenderTokenBalance).toString(),
        allowanceAmount.toString(),
        'the spender balance should be incremented by the transferFrom amount'
      )
      assert.equal(
        preSpenderAllowance.minus(postSpenderAllowance).toString(),
        allowanceAmount.toString(),
        'the spender allowance should be decremented by the transferFrom amount'
      )
    })

    it('should NOT transferFrom when paused', async () => {
      await cpoa.approve(allowanceSpender, allowanceAmount, {
        from: allowanceOwner
      })
      await cpoa.pause()
      await testWillThrow(cpoa.transferFrom, [
        allowanceOwner,
        allowanceSpender,
        allowanceAmount,
        { from: allowanceSpender }
      ])
      await cpoa.unpause()
    })

    // start expected impossible functions in Stages.Active
    it('should NOT whitelist even if owner', async () => {
      const whitelisted = await cpoa.whitelisted(broker)
      assert(!whitelisted, 'the broker should not be whitelisted')
      await testWillThrow(cpoa.whitelistAddress, [broker, { from: owner }])
    })

    it('should NOT blacklist even if owner', async () => {
      const whitelistedInvestor = investors[0]
      const whitelisted = await cpoa.whitelisted(whitelistedInvestor)
      assert(whitelisted, 'the investor should be whitelisted already')
      await testWillThrow(cpoa.blacklistAddress, [
        investors[0],
        { from: owner }
      ])
    })

    it('should NOT buy even if whitelisted', async () => {
      const whitelistedInvestor = investors[0]
      const whitelisted = await cpoa.whitelisted(whitelistedInvestor)
      assert(whitelisted, 'the investor should be whitelisted already')
      await testWillThrow(cpoa.buy, [
        { from: whitelistedInvestor, value: 1e18 }
      ])
    })

    it('should NOT activate even if custodian', async () => {
      const contractValue = await cpoa.totalSupply()
      const fee = await cpoa.calculateFee(contractValue)
      await testWillThrow(cpoa.activate, [{ from: custodian, value: fee }])
    })

    it('should NOT reclaim even if owning tokens', async () => {
      const investor = investors[0]
      const investorBalance = await cpoa.balanceOf(investor)
      assert(investorBalance.greaterThan(0), 'the investor should own tokens')
      await testWillThrow(cpoa.reclaim, [{ from: investor }])
    })

    it('should NOT buy through the fallback function', async () => {
      const investor = investors[0]
      await testWillThrow(sendTransaction, [
        {
          from: investor,
          to: cpoa.address,
          value: 1e18
        }
      ])
    })

    // end expected impossible functions in Stages.Active

    it('should NOT terminate if NOT custodian', async () => {
      const preStage = await cpoa.stage()
      assert.equal(
        preStage.toNumber(),
        3,
        'the contract should be in stage 3 (active) before terminating'
      )
      await testWillThrow(cpoa.terminate, [{ from: owner }])
    })

    it('should terminate if custodian', async () => {
      const preStage = await cpoa.stage()
      await cpoa.terminate({
        from: custodian
      })
      const postStage = await cpoa.stage()
      assert.equal(
        preStage.toNumber(),
        3,
        'the contract should be in stage 3 (active) before terminating'
      )
      assert.equal(
        postStage.toNumber(),
        4,
        'the contract should be in stage 4 (terminated) after terminating'
      )
    })

    it('should NOT terminate again even if custodian', async () => {
      await testWillThrow(cpoa.terminate, [{ from: custodian }])
    })

    it('should kill the Token when in Terminated Stage', async () => {
      assert.equal(
        (await cpoa.stage()).toString(),
        '4',
        'should be in active stage'
      )
      await testKill(cpoa)
    })
  })
})

describe('while in Terminated stage', async () => {
  contract('CustomPOAToken', accounts => {
    const owner = accounts[0]
    const broker = accounts[1]
    const custodian = accounts[2]
    const nonInvestor = accounts[3]
    const investors = accounts.slice(4)
    const allowanceOwner = investors[0]
    const allowanceSpender = investors[1]
    const allowanceAmount = new BigNumber(5e17)
    const totalSupply = new BigNumber(600e18).div(10)
    const fundingGoal = new BigNumber(150e18).div(10)
    const gasPrice = new BigNumber(30e9)
    const tokenSalePrice = totalSupply.div(fundingGoal)
    let cpoa
    // amount paid by custodian - fee
    let totalPayoutAmount = new BigNumber(0)
    let totalPerTokenPayout
    let investorBalances = investors.reduce((balances, investor) => {
      return {
        ...balances,
        [investor]: new BigNumber(0)
      }
    }, {})

    before('setup state', async () => {
      //setup contract
      const investAmount = new BigNumber(1e18)
      const bigInvestor = investors[0]
      let currentStage
      cpoa = await CustomPOAToken.new(
        'ProofOfAwesome',
        'POA',
        broker,
        custodian,
        web3.eth.blockNumber + 200,
        totalSupply,
        fundingGoal
      )

      // claim tokens for investors
      await testMultiBuyTokens(investors, cpoa, {
        value: investAmount,
        gasPrice: new BigNumber(21e9)
      })

      // // buy remaining tokens to go into pending
      await testBuyRemainingTokens(fundingGoal, cpoa, {
        from: bigInvestor,
        gasPrice: new BigNumber(21e9)
      })

      // // activate the contract by custodian with proper fee
      await testActivation(cpoa, {
        from: custodian,
        gasPrice: new BigNumber(21e9)
      })

      currentStage = await cpoa.stage()
      assert.equal(
        currentStage.toNumber(),
        3,
        'the contract stage should be 3 (active)'
      )

      await testOwnerWithdrawFees(cpoa, owner)
      await testCustodianWithdrawFees(cpoa, custodian)

      // set an allowance to test while terminated
      await cpoa.approve(allowanceSpender, allowanceAmount, {
        from: allowanceOwner
      })

      // terminate the contract
      await cpoa.terminate({
        from: custodian
      })
      currentStage = await cpoa.stage()
      assert.equal(
        currentStage.toNumber(),
        4,
        'the contract stage should be 4 (terminated)'
      )
    })

    it('should be paused', async () => {
      const paused = await cpoa.paused()
      assert(paused, 'the contract should be paused')
    })

    it('should NOT payout if NOT custodian', async () => {
      try {
        await cpoa.payout({
          from: owner,
          value: 1e18
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT payout if 0 ether is sent', async () => {
      try {
        await cpoa.payout({
          from: custodian
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error messgage should contain invalid opcode'
        )
      }
    })

    it('should payout if custodian', async () => {
      const totalSupply = await cpoa.totalSupply()
      const payoutValue = new BigNumber(1e18)
      const gasPrice = new BigNumber(30e9)
      const _fee = await cpoa.calculateFee(payoutValue)
      const fee = _fee.add(
        payoutValue
          .sub(_fee)
          .mul(1e18)
          .mod(totalSupply)
          .div(1e18)
          .floor()
      )
      const preContractTotalTokenPayout = await cpoa.totalPerTokenPayout()
      const preCustodianEtherBalance = await getEtherBalance(custodian)
      const preContractEtherBalance = await getEtherBalance(cpoa.address)
      const preOwnerEtherBalance = await getEtherBalance(owner)

      const tx = await cpoa.payout({
        from: custodian,
        value: payoutValue,
        gasPrice
      })

      const postContractTotalTokenPayout = await cpoa.totalPerTokenPayout()
      // set to above closure for later testing...
      totalPerTokenPayout = postContractTotalTokenPayout
      const expectedContractTotalTokenPayout = preContractTotalTokenPayout
        .add(payoutValue)
        .minus(_fee)
        .mul(1e18)
        .div(totalSupply)
        .floor()
      const postCustodianEtherBalance = await getEtherBalance(custodian)
      const expectedCustodianEtherBalance = preCustodianEtherBalance
        .minus(gasPrice.mul(tx.receipt.gasUsed))
        .minus(payoutValue)
      const postContractEtherBalance = await getEtherBalance(cpoa.address)
      const expectedContractEtherBalance = payoutValue.minus(fee)
      const postOwnerEtherBalance = await getEtherBalance(owner)

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
        payoutValue.toString(),
        'the contact ether balance should be incremented by the payoutValue'
      )
      // set for later test...
      ownerFee = fee
      totalPayoutAmount = totalPayoutAmount.add(postContractEtherBalance.minus(fee))
    })

    it('should allow owner to collect the fee after payout', async () => {
      const preOwnerUnclaimedBalance = await cpoa.unclaimedPayoutTotals(owner)
      await testOwnerWithdrawFees(cpoa, owner)

      assert.equal(
        preOwnerUnclaimedBalance.toString(),
        ownerFee.toString()
      )
    })

    it('should show the correct payout', async () => {
      let totalInvestorPayouts = new BigNumber(0)

      for (let investor of investors) {
        const tokenBalance = await cpoa.balanceOf(investor)
        const expectedPayout = tokenBalance.mul(totalPerTokenPayout).div(1e18)
        const currentPayout = await cpoa.currentPayout(investor, true)

        assert.equal(
          expectedPayout.toString(),
          currentPayout.toString(),
          'the contract payout calculation should match the expected payout'
        )

        totalInvestorPayouts = totalInvestorPayouts.add(currentPayout)
      }

      assert.equal(
        totalInvestorPayouts.toString(),
        totalPayoutAmount.toString(),
        'the claimable payouts should match the actual payout amount'
      )
    })

    it('should claim as investor after payout', async () => {
      const gasPrice = new BigNumber(30e9)
      for (let investor of investors) {
        const investorClaimAmount = await cpoa.currentPayout(investor, true)
        const preInvestorEtherBalance = await getEtherBalance(investor)
        const preContractEtherBalance = await getEtherBalance(cpoa.address)

        const tx = await cpoa.claim({
          from: investor,
          gasPrice
        })
        const gasUsed = tx.receipt.gasUsed
        const gasCost = gasPrice.mul(gasUsed)
        const expectedInvestorEtherBalance = preInvestorEtherBalance
          .minus(gasCost)
          .add(investorClaimAmount)

        const postInvestorEtherBalance = await getEtherBalance(investor)
        const postContractEtherBalance = await getEtherBalance(cpoa.address)

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
      }
      const finalContractEtherBalance = await getEtherBalance(cpoa.address)
      assert.equal(
        finalContractEtherBalance.toString(),
        new BigNumber(0).toString(),
        'the contract should have no ether after all payouts have been claimed'
      )
    })

    it('should NOT claim if an address has no payout', async () => {
      try {
        await cpoa.claim({
          from: owner
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should contain invalid opcode'
        )
      }
    })

    // start expected impossible functions in Stages.Terminated

    it('should NOT unpause even if owner', async () => {
      try {
        await cpoa.unpause({
          from: owner
        })
        assert(false, 'the contract should throw')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should contain invalid opcode'
        )
      }
    })

    it('should NOT pause even if owner', async () => {
      try {
        await cpoa.pause({
          from: owner
        })
        assert(false, 'the contract should throw')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should contain invalid opcode'
        )
      }
    })

    it('should NOT whitelist even if owner', async () => {
      const whitelisted = await cpoa.whitelisted(broker)
      assert(!whitelisted, 'the broker should not be whitelisted')
      try {
        await cpoa.whitelistAddress(broker, {
          from: owner
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT blacklist even if owner', async () => {
      const whitelistedInvestor = investors[0]
      const whitelisted = await cpoa.whitelisted(whitelistedInvestor)
      assert(whitelisted, 'the investor should be whitelisted already')
      try {
        await cpoa.blacklistAddress(investors[0], {
          from: owner
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT buy even if whitelisted', async () => {
      const whitelistedInvestor = investors[0]
      const whitelisted = await cpoa.whitelisted(whitelistedInvestor)
      assert(whitelisted, 'the investor should be whitelisted already')
      try {
        await cpoa.buy({
          from: whitelistedInvestor,
          value: 1e18
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT activate even if custodian', async () => {
      const contractValue = await cpoa.totalSupply()
      const fee = await cpoa.calculateFee(contractValue)
      try {
        await cpoa.activate({
          from: custodian,
          value: fee
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT reclaim even if owning tokens', async () => {
      const investor = investors[0]
      const investorBalance = await cpoa.balanceOf(investor)
      assert(investorBalance.greaterThan(0), 'the investor should own tokens')
      try {
        await cpoa.reclaim({
          from: investor
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT buy through the fallback function', async () => {
      const investor = investors[0]
      try {
        await sendTransaction({
          from: investor,
          to: cpoa.address,
          value: 1e18
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should contain invalid opcode'
        )
      }
    })

    it('should NOT transfer even if the investor has tokens', async () => {
      const sender = investors[0]
      const receiver = investors[1]
      const sendAmount = new BigNumber(1e18)
      try {
        await cpoa.transfer(receiver, sendAmount, {
          from: sender
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT approve', async () => {
      try {
        await cpoa.approve(allowanceOwner, allowanceAmount, {
          from: allowanceSpender
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT transferFrom even if allowance was previously set', async () => {
      // allowance is set in before block
      try {
        await cpoa.transferFrom(
          allowanceOwner,
          allowanceSpender,
          allowanceAmount,
          {
            from: allowanceSpender
          }
        )
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    // end expected impossible functions in Stages.Terminated

    it('should kill the Token when in Terminated Stage', async () => {
      assert.equal(
        (await cpoa.stage()).toString(),
        '4',
        'should be in failed stage'
      )

      await testKill(cpoa)
    })
  })
})

describe('when timing out (going into stage 2 (failed))', () => {
  contract('CustomPOAToken', accounts => {
    const owner = accounts[0]
    const broker = accounts[1]
    const custodian = accounts[2]
    const nonInvestor = accounts[3]
    const investors = accounts.slice(4)
    const firstReclaimInvestor = investors[0]
    const laterReclaimInvestors = investors.slice(1)
    const totalSupply = new BigNumber(600e18).div(10)
    const fundingGoal = new BigNumber(150e18).div(10)
    const gasPrice = new BigNumber(30e9)
    const tokenSalePrice = totalSupply.div(fundingGoal)
    let investorBalances = investors.reduce((balances, investor) => {
      return {
        ...balances,
        [investor]: new BigNumber(0)
      }
    }, {})
    let cpoa

    before('setup fresh cpoa', async () => {
      //setup contract
      const investAmount = new BigNumber(1e18)
      let currentStage
      cpoa = await CustomPOAToken.new(
        'ProofOfAwesome',
        'POA',
        broker,
        custodian,
        50,
        totalSupply,
        fundingGoal
      )

      // claim tokens for investors
      await testMultiBuyTokens(investors, cpoa, {
        value: investAmount,
        gasPrice: new BigNumber(21e9)
      })
      // warp ahead past timeoutBlock to setup for failure
      await warpBlocks(50)
      // contract should still be in funding until someone pokes the contract
      currentStage = await cpoa.stage()
      assert.equal(
        currentStage.toNumber(),
        0,
        'the contract should be in stage 0 (funding)'
      )
    })

    it('should NOT timeout to failed when buying after timeoutblock, it should throw', async () => {
      try {
        await cpoa.buy({
          from: investors[0],
          value: 1e18
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          `the error message should contain invalid opcode${error}`
        )
      }

      const stage = await cpoa.stage()
      assert.equal(
        stage.toNumber(),
        0,
        'the contract should still be in stage 0 (active)'
      )
    })

    it('should NOT timeout to failed when activating as custodian, it should throw', async () => {
      const totalSupply = await cpoa.totalSupply()
      const fee = await cpoa.calculateFee(totalSupply)
      try {
        await cpoa.activate({
          from: custodian,
          value: fee
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should contain invalid opcode'
        )
      }

      const stage = await cpoa.stage()
      assert.equal(
        stage.toNumber(),
        0,
        'the contract should still be in stage 0 (active)'
      )
    })

    it('first reclaim after timeout should reclaim, set stage to 2, burn contract token balance, and decrement totalSupply by contract balance', async () => {
      const preTotalSupply = await cpoa.totalSupply()
      const preContractTokenBalance = await cpoa.balanceOf(cpoa.address) // shouldn't this be 0 always(befor hadnling floating integer problem)
      const preInvestorTokenBalance = await cpoa.balanceOf(firstReclaimInvestor)
      const assumedContributionByTokenBalance = preInvestorTokenBalance
        .mul(fundingGoal)
        .div(totalSupply)
        .floor()
      const preContractEtherBalance = await getEtherBalance(cpoa.address)
      const preInvestorEtherBalance = await getEtherBalance(
        firstReclaimInvestor
      )
      const preStage = await cpoa.stage()

      assert.equal(
        preStage.toNumber(),
        0,
        'the contract should be in stage 0 (funding) before reclaiming'
      )

      const tx = await cpoa.reclaim({
        from: firstReclaimInvestor,
        gasPrice
      })

      const postTotalSupply = await cpoa.totalSupply()
      const postContractTokenBalance = await cpoa.balanceOf(cpoa.address)
      const postInvestorTokenBalance = await cpoa.balanceOf(
        firstReclaimInvestor
      )
      const postContractEtherBalance = await getEtherBalance(cpoa.address)
      const postInvestorEtherBalance = await getEtherBalance(
        firstReclaimInvestor
      )
      const postStage = await cpoa.stage()

      const expectedContractTokenBalance = new BigNumber(0)
      const expectedInvestorTokenBalance = new BigNumber(0)
      const expectedTotalSupply = preTotalSupply
        .minus(preContractTokenBalance)
        .minus(preInvestorTokenBalance)
      const gasCost = gasPrice.mul(tx.receipt.gasUsed)
      const expectedInvestorEtherBalance = preInvestorEtherBalance
        .minus(gasCost)
        .add(1e18) // initialInvestAmount
      const ethDelta = postInvestorEtherBalance
        .minus(preInvestorEtherBalance)
        .plus(gasCost)

      assert.equal(
        preContractEtherBalance.minus(postContractEtherBalance).toString(),
        ethDelta.toString(),
        'ether went somewhere else'
      )

      assert.equal(
        postTotalSupply.toString(),
        expectedTotalSupply.toString(),
        'the totalSupply after first reclaim should match the expectedTotalSupply'
      )
      assert.equal(
        postContractTokenBalance.toString(),
        expectedContractTokenBalance.toString(),
        'the contract token balance should be 0 after first reclaim'
      )
      assert.equal(
        postInvestorTokenBalance.toString(),
        expectedInvestorTokenBalance.toString(),
        'the investor token balance should be 0 after reclaiming'
      )
      assert.equal(
        preContractEtherBalance
          .minus(postContractEtherBalance)
          .div(1e18)
          .toString(),
        assumedContributionByTokenBalance.div(1e18).toString(),
        'the contract ether balance should be decremented corresponding to the investor token balance reclaimed'
      )
      assert.equal(
        postInvestorEtherBalance.div(1e18).toString(),
        expectedInvestorEtherBalance.div(1e18).toString(),
        'the investor ether balance should be incremented corresponding to the token balance reclaimed'
      )
      assert.equal(
        postStage.toNumber(),
        2,
        'the contract should be in stage 2 (failed) after reclaiming'
      )
    })

    it('should be paused', async () => {
      const paused = await cpoa.paused()
      assert(paused, 'the contract should be paused')
    })

    it('should NOT reclaim if NOT owning tokens', async () => {
      try {
        await cpoa.reclaim({
          from: owner
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    // start expected imposssible functions in Stages.Failed

    it('should NOT unpause even if owner', async () => {
      try {
        await cpoa.unpause({
          from: owner
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT whitelist even if owner', async () => {
      const whitelisted = await cpoa.whitelisted(broker)
      assert(!whitelisted, 'the broker should not be whitelisted')
      try {
        await cpoa.whitelistAddress(broker, {
          from: owner
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT blacklist even if owner', async () => {
      const whitelistedInvestor = investors[0]
      const whitelisted = await cpoa.whitelisted(whitelistedInvestor)
      assert(whitelisted, 'the investor should be whitelisted already')
      try {
        await cpoa.blacklistAddress(investors[0], {
          from: owner
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT buy even if whitelisted', async () => {
      const whitelistedInvestor = investors[0]
      const whitelisted = await cpoa.whitelisted(whitelistedInvestor)
      assert(whitelisted, 'the investor should be whitelisted already')
      try {
        await cpoa.buy({
          from: whitelistedInvestor,
          value: 1e18
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT activate even if custodian', async () => {
      const contractValue = await cpoa.totalSupply()
      const fee = await cpoa.calculateFee(contractValue)
      try {
        await cpoa.activate({
          from: custodian,
          value: fee
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT terminate even if custodian', async () => {
      try {
        await cpoa.terminate({
          from: custodian
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT payout even if custodian with ether paid', async () => {
      try {
        await cpoa.payout({
          from: custodian,
          value: 1e18
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT claim even if investor with invested amount', async () => {
      const investor = investors[1]
      const investorTokenBalance = await cpoa.balanceOf(investor)
      assert(
        investorTokenBalance.toNumber() > 0,
        'the investor token balance should be more than 0 from previous tests'
      )
      try {
        await cpoa.claim({
          from: investor
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT transfer even if investor has tokens', async () => {
      const investor = investors[1]
      const otherInvestor = investors[2]
      const investorTokenBalance = await cpoa.balanceOf(investor)
      assert(
        investorTokenBalance.toNumber() > 0,
        'the investor token balance should be more than 0 from previous tests'
      )
      try {
        await cpoa.transfer(otherInvestor, investorTokenBalance.div(2), {
          from: investor
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT approve and thus also NOT transferFrom', async () => {
      const investor = investors[1]
      const otherInvestor = investors[2]
      try {
        await cpoa.approve(otherInvestor, 1e18, {
          from: investor
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should include invalid opcode'
        )
      }
    })

    it('should NOT buy through the fallback function', async () => {
      const investor = investors[0]
      try {
        await sendTransaction({
          from: investor,
          to: cpoa.address,
          value: 1e18
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error message should contain invalid opcode'
        )
      }
    })

    // end expected imposssible functions in Stages.Failed

    it('should reclaim when owning tokens', async () => {
      const preTotalSupply = await cpoa.totalSupply()
      for (let investor of laterReclaimInvestors) {
        const preInvestorEtherBalance = await getEtherBalance(investor)
        const preInvestorTokenBalance = await cpoa.balanceOf(investor)
        const preContractEtherBalance = await getEtherBalance(cpoa.address)
        const preContractTotalSupply = await cpoa.totalSupply()

        const tx = await cpoa.reclaim({
          from: investor,
          gasPrice
        })

        const gasCost = gasPrice.mul(tx.receipt.gasUsed)
        const postInvestorEtherBalance = await getEtherBalance(investor)
        const expectedPayout = preInvestorTokenBalance
          .mul(fundingGoal)
          .div(totalSupply)
        const expectedInvestorEtherBalance = preInvestorEtherBalance
          .minus(gasCost)
          .add(expectedPayout)

        const postInvestorTokenBalance = await cpoa.balanceOf(investor)
        const postContractEtherBalance = await getEtherBalance(cpoa.address)
        const postContractTotalSupply = await cpoa.totalSupply()

        assert.equal(
          expectedInvestorEtherBalance.toString(),
          postInvestorEtherBalance.toString(),
          'the investor should get back an ether amount equal to token holdings'
        )
        assert.equal(
          postInvestorTokenBalance.toString(),
          new BigNumber(0).toString(),
          'the investor should have 0 tokens after reclaiming'
        )
        assert.equal(
          preContractEtherBalance.minus(postContractEtherBalance).toString(),
          expectedPayout.toString(),
          'the contract ether balance should be decremented by the tokens relcaimed'
        )
        assert.equal(
          preContractTotalSupply.minus(postContractTotalSupply).toString(),
          preInvestorTokenBalance.toString(),
          'the contract totalSupply should be decremented by the tokens reclaimed'
        )
      }

      const finalContractTotalSupply = await cpoa.totalSupply()
      const finalContractEtherBalance = await getEtherBalance(cpoa.address)

      assert.equal(
        finalContractTotalSupply.toString(),
        new BigNumber(0).toString(),
        'the final contract total supply should be 0 after all investors have reclaimed'
      )
      assert.equal(
        finalContractEtherBalance.toString(),
        new BigNumber(0).toString(),
        'the final contract ether balance should be 0 after all investors have reclaimed'
      )
    })

    it('should kill the Token when timed out', async () => {
      assert.equal(
        (await cpoa.stage()).toString(),
        '2',
        'should be in failed stage'
      )
      await testKill(cpoa)
    })
  })
})

describe('when trying various scenarios using payout, transfer, approve, and transferFrom', () => {
  contract('CustomPOAToken', accounts => {
    const owner = accounts[0]
    const broker = accounts[1]
    const custodian = accounts[2]
    const nonInvestor = accounts[3]
    const investors = accounts.slice(4)
    const allowanceOwner = investors[0]
    const allowanceSpender = investors[1]
    const sender = investors[2]
    const receiver = investors[3]
    const allowanceAmount = new BigNumber(5e17)
    const totalSupply = new BigNumber(600e18).div(10)
    const fundingGoal = new BigNumber(150e18).div(10)
    const gasPrice = new BigNumber(30e9)
    const tokenSalePrice = totalSupply.div(fundingGoal)
    let cpoa

    beforeEach('setup state', async () => {
      //setup contract
      const investAmount = new BigNumber(1e18)
      const bigInvestor = investors[0]
      let currentStage
      cpoa = await CustomPOAToken.new(
        'ProofOfAwesome',
        'POA',
        broker,
        custodian,
        web3.eth.blockNumber + 200,
        totalSupply,
        fundingGoal
      )

      // claim tokens for investors
      await testMultiBuyTokens(investors, cpoa, {
        value: investAmount,
        gasPrice: new BigNumber(21e9)
      })

      // get last of contract's balance and buy it up
      await testBuyRemainingTokens(fundingGoal, cpoa, {
        from: bigInvestor,
        gasPrice: new BigNumber(21e9)
      })

      // activate the contract by custodian with proper fee

      await testActivation(cpoa, {
        from: custodian,
        gasPrice: new BigNumber(21e9)
      })
      // the contract stage should be 3 (active)

      await testOwnerWithdrawFees(cpoa, owner)
      await testCustodianWithdrawFees(cpoa, custodian)
    })

    describe('payout', () => {
      it('has already been covered in main tests', async () => {
        assert(true)
      })
    })

    describe('payout -> trasfer 100% -> payout', () => {
      it('should have the correct currentPayout and claims for each user', async () => {
        const payoutAmount = new BigNumber(1e18)
        const totalSupply = await cpoa.totalSupply()
        const senderAccount1 = await getAccountInformation(sender, cpoa)
        const receiverAccount1 = await getAccountInformation(receiver, cpoa)
        const firstTokenTotalPayout = await testPayout(cpoa, {
          from: custodian,
          value: payoutAmount,
          gasPrice
        })

        const senderAccount2 = await getAccountInformation(sender, cpoa)
        const receiverAccount2 = await getAccountInformation(receiver, cpoa)

        await testTransfer(receiver, senderAccount1.tokenBalance, cpoa, {
          from: sender
        })

        const senderAccount3 = await getAccountInformation(sender, cpoa)
        const receiverAccount3 = await getAccountInformation(receiver, cpoa)

        const secondTokenTotalPayout = await testPayout(cpoa, {
          from: custodian,
          value: payoutAmount,
          gasPrice
        })

        const senderAccount4 = await getAccountInformation(sender, cpoa)
        const receiverAccount4 = await getAccountInformation(receiver, cpoa)

        const feeRate = await cpoa.feeRate()
        const fee = payoutAmount.mul(feeRate.toNumber()).div(1000)
        const expectedFirstTokenTotalPayout = payoutAmount
          .minus(fee)
          .div(totalSupply)
          .mul(1e18)
          .floor()
          .div(1e18)
        const expectedSecondTokenTotalPayout = payoutAmount
          .minus(fee)
          .div(totalSupply)
          .mul(1e18)
          .floor()
          .div(1e18)

        const expectedSenderPayout1 = senderAccount1.tokenBalance.mul(
          expectedFirstTokenTotalPayout
        )
        const expectedSenderPayout2 = senderAccount3.tokenBalance.mul(
          expectedSecondTokenTotalPayout
        )
        const expectedSenderFinalPayout = expectedSenderPayout1.add(
          expectedSenderPayout2
        )

        const expectedReceiverPayout1 = receiverAccount1.tokenBalance.mul(
          expectedFirstTokenTotalPayout
        )
        const expectedReceiverPayout2 = receiverAccount3.tokenBalance.mul(
          expectedSecondTokenTotalPayout
        )
        const expectedReceiverFinalPayout = expectedReceiverPayout1.add(
          expectedReceiverPayout2
        )

        assert.equal(
          expectedSenderFinalPayout.toString(),
          senderAccount4.currentPayout.toString(),
          'the expected payout should match the actual payout for sender'
        )
        assert.equal(
          expectedReceiverFinalPayout.toString(),
          receiverAccount4.currentPayout.toString(),
          'the expected payout should match the actual payout for sender'
        )
        it('should claim everything', async () => {
          await testClaimAllPayouts(investors, cpoa, {
            gasPrice
          })
        })
      })
    })

    describe('payout -> trasfer 50% -> payout', () => {
      it('should have the correct currentPayout and claims for each user', async () => {
        const payoutAmount = new BigNumber(1e18)
        const totalSupply = await cpoa.totalSupply()
        const senderAccount1 = await getAccountInformation(sender, cpoa)
        const receiverAccount1 = await getAccountInformation(receiver, cpoa)
        const firstTokenTotalPayout = await testPayout(cpoa, {
          from: custodian,
          value: payoutAmount,
          gasPrice
        })

        const senderAccount2 = await getAccountInformation(sender, cpoa)
        const receiverAccount2 = await getAccountInformation(receiver, cpoa)

        await testTransfer(receiver, senderAccount1.tokenBalance.div(2), cpoa, {
          from: sender
        })

        const senderAccount3 = await getAccountInformation(sender, cpoa)
        const receiverAccount3 = await getAccountInformation(receiver, cpoa)

        const secondTokenTotalPayout = await testPayout(cpoa, {
          from: custodian,
          value: payoutAmount,
          gasPrice
        })

        const senderAccount4 = await getAccountInformation(sender, cpoa)
        const receiverAccount4 = await getAccountInformation(receiver, cpoa)

        const feeRate = await cpoa.feeRate()
        const fee = payoutAmount.mul(feeRate.toNumber()).div(1000)
        const expectedFirstTokenTotalPayout = payoutAmount
          .minus(fee)
          .div(totalSupply)
          .round(18)
        const expectedSecondTokenTotalPayout = payoutAmount
          .minus(fee)
          .div(totalSupply)
          .round(18)

        const expectedSenderPayout1 = senderAccount1.tokenBalance.mul(
          expectedFirstTokenTotalPayout
        )
        const expectedSenderPayout2 = senderAccount3.tokenBalance.mul(
          expectedSecondTokenTotalPayout
        )
        const expectedSenderFinalPayout = expectedSenderPayout1.add(
          expectedSenderPayout2
        )

        const expectedReceiverPayout1 = receiverAccount1.tokenBalance.mul(
          expectedFirstTokenTotalPayout
        )
        const expectedReceiverPayout2 = receiverAccount3.tokenBalance.mul(
          expectedSecondTokenTotalPayout
        )
        const expectedReceiverFinalPayout = expectedReceiverPayout1.add(
          expectedReceiverPayout2
        )

        assert.equal(
          expectedSenderFinalPayout.toString(),
          senderAccount4.currentPayout.toString(),
          'the expected payout should match the actual payout for sender'
        )
        assert.equal(
          expectedReceiverFinalPayout.toString(),
          receiverAccount4.currentPayout.toString(),
          'the expected payout should match the actual payout for sender'
        )

        await testClaimAllPayouts(investors, cpoa, {
          gasPrice
        })
      })
    })

    describe('payout -> trasferFrom 100% -> payout', () => {
      it('should have the correct currentPayout and claims for each user', async () => {
        const payoutAmount = new BigNumber(1e18)
        const totalSupply = await cpoa.totalSupply()
        const allowanceOwnerAccount1 = await getAccountInformation(
          allowanceOwner,
          cpoa
        )
        const receiverAccount1 = await getAccountInformation(receiver, cpoa)

        const firstTokenTotalPayout = await testPayout(cpoa, {
          from: custodian,
          value: payoutAmount,
          gasPrice
        })

        const allowanceOwnerAccount2 = await getAccountInformation(
          allowanceOwner,
          cpoa
        )
        const receiverAccount2 = await getAccountInformation(receiver, cpoa)

        await testApproveTransferFrom(
          allowanceOwner,
          allowanceSpender,
          allowanceOwnerAccount1.tokenBalance,
          receiver,
          allowanceOwnerAccount1.tokenBalance,
          cpoa
        )

        const allowanceOwnerAccount3 = await getAccountInformation(
          allowanceOwner,
          cpoa
        )
        const receiverAccount3 = await getAccountInformation(receiver, cpoa)

        const secondTokenTotalPayout = await testPayout(cpoa, {
          from: custodian,
          value: payoutAmount,
          gasPrice
        })

        const allowanceOwnerAccount4 = await getAccountInformation(
          allowanceOwner,
          cpoa
        )
        const receiverAccount4 = await getAccountInformation(receiver, cpoa)

        const feeRate = await cpoa.feeRate()
        const fee = payoutAmount.mul(feeRate.toNumber()).div(1000)
        const expectedFirstTokenTotalPayout = payoutAmount
          .minus(fee)
          .div(totalSupply)
          .round(18)
        const expectedSecondTokenTotalPayout = payoutAmount
          .minus(fee)
          .div(totalSupply)
          .round(18)

        const expectedAllowanceOwnerPayout1 = allowanceOwnerAccount1.tokenBalance.mul(
          expectedFirstTokenTotalPayout
        )
        const expectedAllowanceOwnerPayout2 = allowanceOwnerAccount3.tokenBalance.mul(
          expectedSecondTokenTotalPayout
        )
        const expectedAllowanceOwnerFinalPayout = expectedAllowanceOwnerPayout1.add(
          expectedAllowanceOwnerPayout2
        )

        const expectedReceiverPayout1 = receiverAccount1.tokenBalance.mul(
          expectedFirstTokenTotalPayout
        )
        const expectedReceiverPayout2 = receiverAccount3.tokenBalance.mul(
          expectedSecondTokenTotalPayout
        )
        const expectedReceiverFinalPayout = expectedReceiverPayout1.add(
          expectedReceiverPayout2
        )

        assert.equal(
          expectedAllowanceOwnerFinalPayout.toString(),
          allowanceOwnerAccount4.currentPayout.toString(),
          'the expected payout should match the actual payout for allowanceOwner'
        )
        assert.equal(
          expectedReceiverFinalPayout.toString(),
          receiverAccount4.currentPayout.toString(),
          'the expected payout should match the actual payout for allowanceOwner'
        )

        await testClaimAllPayouts(investors, cpoa, {
          gasPrice
        })
      })
    })

    describe('payout -> trasferFrom 50% -> payout', () => {
      it('should have the correct currentPayout and claims for each user', async () => {
        const payoutAmount = new BigNumber(1e18)
        const totalSupply = await cpoa.totalSupply()
        const allowanceOwnerAccount1 = await getAccountInformation(
          allowanceOwner,
          cpoa
        )
        const receiverAccount1 = await getAccountInformation(receiver, cpoa)
        const firstTokenTotalPayout = await testPayout(cpoa, {
          from: custodian,
          value: payoutAmount,
          gasPrice
        })

        const allowanceOwnerAccount2 = await getAccountInformation(
          allowanceOwner,
          cpoa
        )
        const receiverAccount2 = await getAccountInformation(receiver, cpoa)

        await testApproveTransferFrom(
          allowanceOwner,
          allowanceSpender,
          allowanceAmount,
          receiver,
          allowanceAmount,
          cpoa
        )

        const allowanceOwnerAccount3 = await getAccountInformation(
          allowanceOwner,
          cpoa
        )
        const receiverAccount3 = await getAccountInformation(receiver, cpoa)

        const secondTokenTotalPayout = await testPayout(cpoa, {
          from: custodian,
          value: payoutAmount,
          gasPrice
        })

        const allowanceOwnerAccount4 = await getAccountInformation(
          allowanceOwner,
          cpoa
        )
        const receiverAccount4 = await getAccountInformation(receiver, cpoa)

        const feeRate = await cpoa.feeRate()
        const fee = payoutAmount.mul(feeRate.toNumber()).div(1000)
        const expectedFirstTokenTotalPayout = payoutAmount
          .minus(fee)
          .div(totalSupply)
          .round(18)
        const expectedSecondTokenTotalPayout = payoutAmount
          .minus(fee)
          .div(totalSupply)
          .round(18)

        const expectedAllowanceOwnerPayout1 = allowanceOwnerAccount1.tokenBalance.mul(
          expectedFirstTokenTotalPayout
        )
        const expectedAllowanceOwnerPayout2 = allowanceOwnerAccount3.tokenBalance.mul(
          expectedSecondTokenTotalPayout
        )
        const expectedAllowanceOwnerFinalPayout = expectedAllowanceOwnerPayout1.add(
          expectedAllowanceOwnerPayout2
        )

        const expectedReceiverPayout1 = receiverAccount1.tokenBalance.mul(
          expectedFirstTokenTotalPayout
        )
        const expectedReceiverPayout2 = receiverAccount3.tokenBalance.mul(
          expectedSecondTokenTotalPayout
        )
        const expectedReceiverFinalPayout = expectedReceiverPayout1.add(
          expectedReceiverPayout2
        )

        assert.equal(
          expectedAllowanceOwnerFinalPayout.floor().toString(), // [TODO] dirty not actualy fixed
          allowanceOwnerAccount4.currentPayout.toString(),
          'the expected payout should match the actual payout for allowanceOwner'
        )
        assert.equal(
          expectedReceiverFinalPayout.floor().toString(), // [TODO] dirty not actualy fixed
          receiverAccount4.currentPayout.toString(),
          'the expected payout should match the actual payout for allowanceOwner'
        )

        await testClaimAllPayouts(investors, cpoa, {
          gasPrice
        })
      })
    })

    describe('transfer 100% -> payout', () => {
      it('should have the correct currentPayout and claims for each investor', async () => {
        const payoutAmount = new BigNumber(1e18)
        const totalSupply = await cpoa.totalSupply()

        const senderAccount1 = await getAccountInformation(sender, cpoa)
        const receiverAccount1 = await getAccountInformation(receiver, cpoa)

        await testTransfer(receiver, senderAccount1.tokenBalance, cpoa, {
          from: sender
        })

        const senderAccount2 = await getAccountInformation(sender, cpoa)
        const receiverAccount2 = await getAccountInformation(receiver, cpoa)
        const firstTokenTotalPayout = await testPayout(cpoa, {
          from: custodian,
          value: payoutAmount,
          gasPrice
        })

        const senderAccount3 = await getAccountInformation(sender, cpoa)
        const receiverAccount3 = await getAccountInformation(receiver, cpoa)

        const feeRate = await cpoa.feeRate()
        const fee = payoutAmount.mul(feeRate.toNumber()).div(1000)

        const expectedTotalTokenPayout = payoutAmount
          .minus(fee)
          .div(totalSupply)
          .round(18)

        const expectedSenderFinalPayout = new BigNumber(0)
        const expectedReceiverFinalPayout = receiverAccount2.tokenBalance.mul(
          expectedTotalTokenPayout
        )

        assert.equal(
          senderAccount3.currentPayout.toString(),
          expectedSenderFinalPayout.toString(),
          'the final payout for a sender sending all tokens before payout should be 0'
        )
        assert.equal(
          receiverAccount3.currentPayout.toString(),
          expectedReceiverFinalPayout.toString(),
          'the final payout for the recipient should match the expected payout'
        )

        await testClaimAllPayouts(investors, cpoa, {
          gasPrice
        })
      })
    })

    describe('transfer 50% -> payout', () => {
      it('should have the correct currentPayout and claims for each investor', async () => {
        const payoutAmount = new BigNumber(1e18)
        const totalSupply = await cpoa.totalSupply()

        const senderAccount1 = await getAccountInformation(sender, cpoa)
        const receiverAccount1 = await getAccountInformation(receiver, cpoa)

        await testTransfer(receiver, senderAccount1.tokenBalance.div(2), cpoa, {
          from: sender
        })

        const senderAccount2 = await getAccountInformation(sender, cpoa)
        const receiverAccount2 = await getAccountInformation(receiver, cpoa)
        const firstTokenTotalPayout = await testPayout(cpoa, {
          from: custodian,
          value: payoutAmount,
          gasPrice
        })

        const senderAccount3 = await getAccountInformation(sender, cpoa)
        const receiverAccount3 = await getAccountInformation(receiver, cpoa)

        const feeRate = await cpoa.feeRate()
        const fee = payoutAmount.mul(feeRate.toNumber()).div(1000)

        const expectedTotalTokenPayout = payoutAmount
          .minus(fee)
          .div(totalSupply)
          .round(18)

        const expectedSenderFinalPayout = senderAccount2.tokenBalance.mul(
          expectedTotalTokenPayout
        )
        const expectedReceiverFinalPayout = receiverAccount2.tokenBalance.mul(
          expectedTotalTokenPayout
        )

        assert.equal(
          senderAccount3.currentPayout.toString(),
          expectedSenderFinalPayout.toString(),
          'the final payout for a sender sending all tokens before payout should be 0'
        )
        assert.equal(
          receiverAccount3.currentPayout.toString(),
          expectedReceiverFinalPayout.toString(),
          'the final payout for the recipient should match the expected payout'
        )

        await testClaimAllPayouts(investors, cpoa, {
          gasPrice
        })
      })
    })

    describe('transferFrom 100% -> payout', () => {
      it('should have the correct currentPayout and claims for each investor', async () => {
        const payoutAmount = new BigNumber(1e18)
        const totalSupply = await cpoa.totalSupply()

        const allowanceOwnerAccount1 = await getAccountInformation(
          allowanceOwner,
          cpoa
        )
        const receiverAccount1 = await getAccountInformation(receiver, cpoa)

        await testApproveTransferFrom(
          allowanceOwner,
          allowanceSpender,
          allowanceOwnerAccount1.tokenBalance,
          receiver,
          allowanceOwnerAccount1.tokenBalance,
          cpoa
        )

        const allowanceOwnerAccount2 = await getAccountInformation(
          allowanceOwner,
          cpoa
        )
        const receiverAccount2 = await getAccountInformation(receiver, cpoa)
        const firstTokenTotalPayout = await testPayout(cpoa, {
          from: custodian,
          value: payoutAmount,
          gasPrice
        })

        const allowanceOwnerAccount3 = await getAccountInformation(
          allowanceOwner,
          cpoa
        )
        const receiverAccount3 = await getAccountInformation(receiver, cpoa)

        const feeRate = await cpoa.feeRate()
        const fee = payoutAmount.mul(feeRate.toNumber()).div(1000)

        const expectedTotalTokenPayout = payoutAmount
          .minus(fee)
          .div(totalSupply)
          .round(18)

        const expectedSenderFinalPayout = new BigNumber(0)
        const expectedReceiverFinalPayout = receiverAccount2.tokenBalance.mul(
          expectedTotalTokenPayout
        )

        assert.equal(
          allowanceOwnerAccount3.currentPayout.toString(),
          expectedSenderFinalPayout.toString(),
          'the final payout for a allowanceOwner sending all tokens before payout should be 0'
        )
        assert.equal(
          receiverAccount3.currentPayout.toString(),
          expectedReceiverFinalPayout.toString(),
          'the final payout for the recipient should match the expected payout'
        )

        await testClaimAllPayouts(investors, cpoa, {
          gasPrice
        })
      })
    })

    describe('transferFrom 50% -> payout', () => {
      it('should have the correct currentPayout and claims for each investor', async () => {
        const payoutAmount = new BigNumber(1e18)
        const totalSupply = await cpoa.totalSupply()

        const allowanceOwnerAccount1 = await getAccountInformation(
          allowanceOwner,
          cpoa
        )
        const receiverAccount1 = await getAccountInformation(receiver, cpoa)

        await testApproveTransferFrom(
          allowanceOwner,
          allowanceSpender,
          allowanceOwnerAccount1.tokenBalance,
          receiver,
          allowanceOwnerAccount1.tokenBalance.div(2),
          cpoa
        )

        const allowanceOwnerAccount2 = await getAccountInformation(
          allowanceOwner,
          cpoa
        )
        const receiverAccount2 = await getAccountInformation(receiver, cpoa)
        const firstTokenTotalPayout = await testPayout(cpoa, {
          from: custodian,
          value: payoutAmount,
          gasPrice
        })

        const allowanceOwnerAccount3 = await getAccountInformation(
          allowanceOwner,
          cpoa
        )
        const receiverAccount3 = await getAccountInformation(receiver, cpoa)

        const feeRate = await cpoa.feeRate()
        const fee = payoutAmount.mul(feeRate.toNumber()).div(1000)

        const expectedTotalTokenPayout = payoutAmount
          .minus(fee)
          .div(totalSupply)
          .round(18)

        const expectedSenderFinalPayout = allowanceOwnerAccount2.tokenBalance.mul(
          expectedTotalTokenPayout
        )
        const expectedReceiverFinalPayout = receiverAccount2.tokenBalance.mul(
          expectedTotalTokenPayout
        )

        assert.equal(
          allowanceOwnerAccount3.currentPayout.toString(),
          expectedSenderFinalPayout.toString(),
          'the final payout for a allowanceOwner sending all tokens before payout should be 0'
        )
        assert.equal(
          receiverAccount3.currentPayout.toString(),
          expectedReceiverFinalPayout.toString(),
          'the final payout for the recipient should match the expected payout'
        )

        await testClaimAllPayouts(investors, cpoa, {
          gasPrice
        })
      })
    })
  })
})
