const {
  custodian,
  whitelistedPoaBuyers,
  defaultIpfsHash,
  setupPoaAndEcosystem,
  testStartSale,
  testBuyTokens,
  determineNeededTimeTravel,
  testBuyRemainingTokens,
  testActivate,
  testBrokerClaim,
  testPayout,
  testClaimAllPayouts,
  testFirstReclaim,
  fundingTimeoutContract,
  activationTimeoutContract,
  testSetFailed,
  testTransfer,
  testApprove,
  testTransferFrom,
  testBuyTokensMulti,
  getAccountInformation,
  testResetCurrencyRate,
  testActiveBalances
} = require('../../helpers/poa')
const {
  timeTravel,
  gasPrice,
  areInRange,
  getEtherBalance
} = require('../../helpers/general.js')
const BigNumber = require('bignumber.js')

describe('when handling unhappy paths', async () => {
  contract('PoaToken', () => {
    let poa

    beforeEach('setup contracts', async () => {
      const contracts = await setupPoaAndEcosystem()
      poa = contracts.poa
    })

    it('should hit checkTimeout when reclaiming after fundingTimeout', async () => {
      const tokenBuyAmount = new BigNumber(1e18)
      const neededTime = await determineNeededTimeTravel(poa)
      await timeTravel(neededTime)
      await testStartSale(poa)

      // purchase tokens to reclaim when failed
      await testBuyTokens(poa, {
        from: whitelistedPoaBuyers[0],
        value: tokenBuyAmount,
        gasPrice
      })

      await fundingTimeoutContract(poa)
      await testFirstReclaim(poa, { from: whitelistedPoaBuyers[0] })
    })

    it('should hit checkTimeout when reclaiming after activationTimeout', async () => {
      const neededTime = await determineNeededTimeTravel(poa)
      await timeTravel(neededTime)
      await testStartSale(poa)

      // move to Pending
      await testBuyRemainingTokens(poa, {
        from: whitelistedPoaBuyers[0],
        gasPrice
      })

      await activationTimeoutContract(poa)

      await testFirstReclaim(poa, { from: whitelistedPoaBuyers[0] }, true)
    })

    it('should setFailed by anyone when activationTimeout has occured', async () => {
      const neededTime = await determineNeededTimeTravel(poa)
      await timeTravel(neededTime)
      await testStartSale(poa)

      // move to Pending
      await testBuyRemainingTokens(poa, {
        from: whitelistedPoaBuyers[0],
        gasPrice
      })

      await activationTimeoutContract(poa)
      await testSetFailed(poa, true)
    })
  })
})

describe('when trying various scenarios involving payout, transfer, approve, and transferFrom', () => {
  contract('PoaToken', () => {
    let poa
    let fmr
    let feeRate
    let totalSupply
    const defaultPayoutAmount = new BigNumber(0.23437e16)
    const defaultBuyAmount = new BigNumber(1.802384753e16)

    beforeEach('setup contracts', async () => {
      const contracts = await setupPoaAndEcosystem()
      poa = contracts.poa
      fmr = contracts.fmr

      // move into Funding
      const neededTime = await determineNeededTimeTravel(poa)
      await timeTravel(neededTime)
      await testStartSale(poa)

      await testBuyTokensMulti(poa, defaultBuyAmount)

      await testBuyRemainingTokens(poa, {
        from:
          whitelistedPoaBuyers[
            Math.floor(Math.random() * whitelistedPoaBuyers.length)
          ],
        gasPrice
      })

      // move into Active
      await testActivate(poa, fmr, defaultIpfsHash, {
        from: custodian
      })

      // clean out broker balance for easier debugging
      await testBrokerClaim(poa)

      feeRate = await poa.feeRate()
      totalSupply = await poa.totalSupply()
    })

    describe('payout -> trasfer 100% -> payout', () => {
      it('should have correct currentPayout and claims all users', async () => {
        const sender = whitelistedPoaBuyers[0]
        const receiver = whitelistedPoaBuyers[1]
        let senderAccount
        let receiverAccount
        let expectedSenderPayout = new BigNumber(0)
        let expectedReceiverPayout = new BigNumber(0)
        let expectedSenderUnclaimed = new BigNumber(0)
        let expectedReceiverUnclaimed = new BigNumber(0)
        let expectedPerTokenPayout = new BigNumber(0)
        let fee

        await testPayout(poa, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        senderAccount = await getAccountInformation(poa, sender)
        receiverAccount = await getAccountInformation(poa, receiver)

        fee = defaultPayoutAmount.mul(feeRate).div(1e3)
        expectedPerTokenPayout = defaultPayoutAmount.sub(fee).div(totalSupply)

        // should just be perToken rate here
        expectedSenderPayout = senderAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )
        expectedReceiverPayout = receiverAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )

        assert(
          areInRange(senderAccount.currentPayout, expectedSenderPayout, 1e2),
          'sender currentPayout should match expectedPayout'
        )
        assert(
          areInRange(
            receiverAccount.currentPayout,
            expectedReceiverPayout,
            1e2
          ),
          'receiver currentPayout should match expectedPayout'
        )

        await testTransfer(poa, receiver, senderAccount.tokenBalance, {
          from: sender
        })

        // now need to account for unclaimedPayouts
        expectedSenderUnclaimed = senderAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )
        expectedReceiverUnclaimed = receiverAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )

        await testPayout(poa, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        // another payout has occured we need to account for perToken as well
        senderAccount = await getAccountInformation(poa, sender)
        receiverAccount = await getAccountInformation(poa, receiver)

        fee = defaultPayoutAmount.mul(feeRate).div(1e3)
        expectedPerTokenPayout = defaultPayoutAmount.sub(fee).div(totalSupply)

        expectedSenderPayout = senderAccount.tokenBalance
          .mul(expectedPerTokenPayout)
          .add(expectedSenderUnclaimed)
        expectedReceiverPayout = receiverAccount.tokenBalance
          .mul(expectedPerTokenPayout)
          .add(expectedReceiverUnclaimed)

        assert(
          areInRange(senderAccount.currentPayout, expectedSenderPayout, 1e2),
          'sender currentPayout should match expectedPayout'
        )
        assert(
          areInRange(
            receiverAccount.currentPayout,
            expectedReceiverPayout,
            1e2
          ),
          'receiver currentPayout should match expectedPayout'
        )

        await testClaimAllPayouts(poa, whitelistedPoaBuyers)
      })
    })

    describe('payout -> transfer 50% -> payout', () => {
      it('should have correct currentPayout and claims all users', async () => {
        const sender = whitelistedPoaBuyers[0]
        const receiver = whitelistedPoaBuyers[1]
        let senderAccount
        let receiverAccount
        let expectedSenderPayout = new BigNumber(0)
        let expectedReceiverPayout = new BigNumber(0)
        let expectedSenderUnclaimed = new BigNumber(0)
        let expectedReceiverUnclaimed = new BigNumber(0)
        let expectedPerTokenPayout = new BigNumber(0)
        let fee

        await testPayout(poa, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        senderAccount = await getAccountInformation(poa, sender)
        receiverAccount = await getAccountInformation(poa, receiver)

        fee = defaultPayoutAmount.mul(feeRate).div(1e3)
        expectedPerTokenPayout = defaultPayoutAmount.sub(fee).div(totalSupply)

        // should just be perToken rate here
        expectedSenderPayout = senderAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )
        expectedReceiverPayout = receiverAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )

        assert(
          areInRange(senderAccount.currentPayout, expectedSenderPayout, 1e2),
          'sender currentPayout should match expectedPayout'
        )
        assert(
          areInRange(
            receiverAccount.currentPayout,
            expectedReceiverPayout,
            1e2
          ),
          'receiver currentPayout should match expectedPayout'
        )

        await testTransfer(
          poa,
          receiver,
          senderAccount.tokenBalance.div(2).floor(),
          {
            from: sender
          }
        )

        // now need to account for unclaimedPayouts
        expectedSenderUnclaimed = senderAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )
        expectedReceiverUnclaimed = receiverAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )

        await testPayout(poa, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        // another payout has occured we need to account for perToken as well
        senderAccount = await getAccountInformation(poa, sender)
        receiverAccount = await getAccountInformation(poa, receiver)

        fee = defaultPayoutAmount.mul(feeRate).div(1e3)
        expectedPerTokenPayout = defaultPayoutAmount.sub(fee).div(totalSupply)

        expectedSenderPayout = senderAccount.tokenBalance
          .mul(expectedPerTokenPayout)
          .add(expectedSenderUnclaimed)
        expectedReceiverPayout = receiverAccount.tokenBalance
          .mul(expectedPerTokenPayout)
          .add(expectedReceiverUnclaimed)

        assert(
          areInRange(senderAccount.currentPayout, expectedSenderPayout, 1e2),
          'sender currentPayout should match expectedPayout'
        )
        assert(
          areInRange(
            receiverAccount.currentPayout,
            expectedReceiverPayout,
            1e2
          ),
          'receiver currentPayout should match expectedPayout'
        )

        await testClaimAllPayouts(poa, whitelistedPoaBuyers)
      })
    })

    describe('payout -> transferFrom 100% -> payout', () => {
      it('should have correct currentPayout and claims all users', async () => {
        const sender = whitelistedPoaBuyers[0]
        const receiver = whitelistedPoaBuyers[1]
        const spender = whitelistedPoaBuyers[2]
        let senderAccount
        let receiverAccount
        let expectedSenderPayout = new BigNumber(0)
        let expectedReceiverPayout = new BigNumber(0)
        let expectedSenderUnclaimed = new BigNumber(0)
        let expectedReceiverUnclaimed = new BigNumber(0)
        let expectedPerTokenPayout = new BigNumber(0)
        let fee

        await testPayout(poa, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        senderAccount = await getAccountInformation(poa, sender)
        receiverAccount = await getAccountInformation(poa, receiver)

        fee = defaultPayoutAmount.mul(feeRate).div(1e3)
        expectedPerTokenPayout = defaultPayoutAmount.sub(fee).div(totalSupply)

        // should just be perToken rate here
        expectedSenderPayout = senderAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )
        expectedReceiverPayout = receiverAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )

        assert(
          areInRange(senderAccount.currentPayout, expectedSenderPayout, 1e2),
          `sender currentPayout ${senderAccount.currentPayout.toString()}
          should match expectedPayout ${expectedSenderPayout.toString()}`
        )
        assert(
          areInRange(
            receiverAccount.currentPayout,
            expectedReceiverPayout,
            1e2
          ),
          `receiver currentPayout ${receiverAccount.currentPayout.toString()}
          should match expectedPayout ${expectedReceiverPayout.toString()}`
        )

        await testApprove(poa, spender, senderAccount.tokenBalance, {
          from: sender
        })
        await testTransferFrom(
          poa,
          sender,
          receiver,
          senderAccount.tokenBalance,
          {
            from: spender
          }
        )
        // now need to account for unclaimedPayouts
        expectedSenderUnclaimed = senderAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )
        expectedReceiverUnclaimed = receiverAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )

        await testPayout(poa, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        // another payout has occured we need to account for perToken as well
        senderAccount = await getAccountInformation(poa, sender)
        receiverAccount = await getAccountInformation(poa, receiver)

        fee = defaultPayoutAmount.mul(feeRate).div(1e3)
        expectedPerTokenPayout = defaultPayoutAmount.sub(fee).div(totalSupply)

        expectedSenderPayout = senderAccount.tokenBalance
          .mul(expectedPerTokenPayout)
          .add(expectedSenderUnclaimed)
        expectedReceiverPayout = receiverAccount.tokenBalance
          .mul(expectedPerTokenPayout)
          .add(expectedReceiverUnclaimed)

        assert(
          areInRange(senderAccount.currentPayout, expectedSenderPayout, 1e2),
          `sender currentPayout ${senderAccount.currentPayout.toString()}
            should match expectedPayout ${expectedSenderPayout.toString()}`
        )
        assert(
          areInRange(
            receiverAccount.currentPayout,
            expectedReceiverPayout,
            1e2
          ),
          `receiver currentPayout ${receiverAccount.currentPayout.toString()}
            should match expectedPayout ${expectedReceiverPayout.toString()}`
        )

        await testClaimAllPayouts(poa, whitelistedPoaBuyers)
      })
    })

    describe('payout -> trasferFrom 50% -> payout', () => {
      it('should have correct currentPayout and claims all users', async () => {
        const sender = whitelistedPoaBuyers[0]
        const receiver = whitelistedPoaBuyers[1]
        const spender = whitelistedPoaBuyers[2]
        let senderAccount
        let receiverAccount
        let expectedSenderPayout = new BigNumber(0)
        let expectedReceiverPayout = new BigNumber(0)
        let expectedSenderUnclaimed = new BigNumber(0)
        let expectedReceiverUnclaimed = new BigNumber(0)
        let expectedPerTokenPayout = new BigNumber(0)
        let fee

        await testPayout(poa, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        senderAccount = await getAccountInformation(poa, sender)
        receiverAccount = await getAccountInformation(poa, receiver)

        fee = defaultPayoutAmount.mul(feeRate).div(1e3)
        expectedPerTokenPayout = defaultPayoutAmount.sub(fee).div(totalSupply)

        // should just be perToken rate here
        expectedSenderPayout = senderAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )
        expectedReceiverPayout = receiverAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )

        assert(
          areInRange(senderAccount.currentPayout, expectedSenderPayout, 1e2),
          `sender currentPayout ${senderAccount.currentPayout.toString()}
          should match expectedPayout ${expectedSenderPayout.toString()}`
        )
        assert(
          areInRange(
            receiverAccount.currentPayout,
            expectedReceiverPayout,
            1e2
          ),
          `receiver currentPayout ${receiverAccount.currentPayout.toString()}
          should match expectedPayout ${expectedReceiverPayout.toString()}`
        )

        await testApprove(poa, spender, senderAccount.tokenBalance, {
          from: sender
        })
        await testTransferFrom(
          poa,
          sender,
          receiver,
          senderAccount.tokenBalance.div(2).floor(),
          {
            from: spender
          }
        )

        // now need to account for unclaimedPayouts
        expectedSenderUnclaimed = senderAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )
        expectedReceiverUnclaimed = receiverAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )

        await testPayout(poa, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        // another payout has occured we need to account for perToken as well
        senderAccount = await getAccountInformation(poa, sender)
        receiverAccount = await getAccountInformation(poa, receiver)

        fee = defaultPayoutAmount.mul(feeRate).div(1e3)
        expectedPerTokenPayout = defaultPayoutAmount.sub(fee).div(totalSupply)

        expectedSenderPayout = senderAccount.tokenBalance
          .mul(expectedPerTokenPayout)
          .add(expectedSenderUnclaimed)
        expectedReceiverPayout = receiverAccount.tokenBalance
          .mul(expectedPerTokenPayout)
          .add(expectedReceiverUnclaimed)

        assert(
          areInRange(senderAccount.currentPayout, expectedSenderPayout, 1e2),
          `sender currentPayout ${senderAccount.currentPayout.toString()}
            should match expectedPayout ${expectedSenderPayout.toString()}`
        )
        assert(
          areInRange(
            receiverAccount.currentPayout,
            expectedReceiverPayout,
            1e2
          ),
          `receiver currentPayout ${receiverAccount.currentPayout.toString()}
            should match expectedPayout ${expectedReceiverPayout.toString()}`
        )

        await testClaimAllPayouts(poa, whitelistedPoaBuyers)
      })
    })

    describe('transfer 100% -> payout', () => {
      it('should have correct currentPayout and claims all users', async () => {
        const sender = whitelistedPoaBuyers[0]
        const receiver = whitelistedPoaBuyers[1]

        let senderAccount = await getAccountInformation(poa, sender)
        let receiverAccount = await getAccountInformation(poa, receiver)

        await testTransfer(poa, receiver, senderAccount.tokenBalance, {
          from: sender
        })

        await testPayout(poa, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        const fee = defaultPayoutAmount.mul(feeRate).div(1e3)
        const expectedPerTokenPayout = defaultPayoutAmount
          .sub(fee)
          .div(totalSupply)

        const expectedSenderPayout = new BigNumber(0)
        const expectedReceiverPayout = receiverAccount.tokenBalance
          .add(senderAccount.tokenBalance)
          .mul(expectedPerTokenPayout)

        senderAccount = await getAccountInformation(poa, sender)
        receiverAccount = await getAccountInformation(poa, receiver)
        assert(
          areInRange(senderAccount.currentPayout, expectedSenderPayout, 1e2),
          `sender currentPayout ${senderAccount.currentPayout.toString()}
          should match expectedPayout ${expectedSenderPayout.toString()}`
        )
        assert(
          areInRange(
            receiverAccount.currentPayout,
            expectedReceiverPayout,
            1e2
          ),
          `receiver currentPayout ${receiverAccount.currentPayout.toString()}
          should match expectedPayout ${expectedReceiverPayout.toString()}`
        )

        await testClaimAllPayouts(poa, whitelistedPoaBuyers)
      })
    })

    describe('transfer 50% -> payout', () => {
      it('should have correct currentPayout and claims all users', async () => {
        const sender = whitelistedPoaBuyers[0]
        const receiver = whitelistedPoaBuyers[1]

        let senderAccount = await getAccountInformation(poa, sender)
        let receiverAccount = await getAccountInformation(poa, receiver)

        await testTransfer(
          poa,
          receiver,
          senderAccount.tokenBalance.div(2).floor(),
          {
            from: sender
          }
        )

        await testPayout(poa, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        const fee = defaultPayoutAmount.mul(feeRate).div(1e3)
        const expectedPerTokenPayout = defaultPayoutAmount
          .sub(fee)
          .div(totalSupply)

        const expectedSenderPayout = senderAccount.tokenBalance
          .div(2)
          .floor()
          .mul(expectedPerTokenPayout)
        const expectedReceiverPayout = receiverAccount.tokenBalance
          .add(senderAccount.tokenBalance.div(2).floor())
          .mul(expectedPerTokenPayout)

        senderAccount = await getAccountInformation(poa, sender)
        receiverAccount = await getAccountInformation(poa, receiver)
        assert(
          areInRange(senderAccount.currentPayout, expectedSenderPayout, 1e2),
          `sender currentPayout ${senderAccount.currentPayout.toString()}
          should match expectedPayout ${expectedSenderPayout.toString()}`
        )
        assert(
          areInRange(
            receiverAccount.currentPayout,
            expectedReceiverPayout,
            1e2
          ),
          `receiver currentPayout ${receiverAccount.currentPayout.toString()}
          should match expectedPayout ${expectedReceiverPayout.toString()}`
        )

        await testClaimAllPayouts(poa, whitelistedPoaBuyers)
      })
    })

    describe('transferFrom 100% -> payout', () => {
      it('should have correct currentPayout and claims all users', async () => {
        const sender = whitelistedPoaBuyers[0]
        const receiver = whitelistedPoaBuyers[1]
        const spender = whitelistedPoaBuyers[2]

        let senderAccount = await getAccountInformation(poa, sender)
        let receiverAccount = await getAccountInformation(poa, receiver)

        await testApprove(poa, spender, senderAccount.tokenBalance, {
          from: sender
        })

        await testTransferFrom(
          poa,
          sender,
          receiver,
          senderAccount.tokenBalance,
          {
            from: spender
          }
        )

        await testPayout(poa, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        const fee = defaultPayoutAmount.mul(feeRate).div(1e3)
        const expectedPerTokenPayout = defaultPayoutAmount
          .sub(fee)
          .div(totalSupply)

        const expectedSenderPayout = new BigNumber(0)
        const expectedReceiverPayout = receiverAccount.tokenBalance
          .add(senderAccount.tokenBalance)
          .mul(expectedPerTokenPayout)

        senderAccount = await getAccountInformation(poa, sender)
        receiverAccount = await getAccountInformation(poa, receiver)
        assert(
          areInRange(senderAccount.currentPayout, expectedSenderPayout, 1e2),
          `sender currentPayout ${senderAccount.currentPayout.toString()}
          should match expectedPayout ${expectedSenderPayout.toString()}`
        )
        assert(
          areInRange(
            receiverAccount.currentPayout,
            expectedReceiverPayout,
            1e2
          ),
          `receiver currentPayout ${receiverAccount.currentPayout.toString()}
          should match expectedPayout ${expectedReceiverPayout.toString()}`
        )

        await testClaimAllPayouts(poa, whitelistedPoaBuyers)
      })
    })

    describe('transferFrom 50% -> payout', () => {
      it('should have correct currentPayout and claims all users', async () => {
        const sender = whitelistedPoaBuyers[0]
        const receiver = whitelistedPoaBuyers[1]
        const spender = whitelistedPoaBuyers[2]

        let senderAccount = await getAccountInformation(poa, sender)
        let receiverAccount = await getAccountInformation(poa, receiver)

        await testApprove(poa, spender, senderAccount.tokenBalance, {
          from: sender
        })

        await testTransferFrom(
          poa,
          sender,
          receiver,
          senderAccount.tokenBalance.div(2).floor(),
          {
            from: spender
          }
        )

        await testPayout(poa, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        const fee = defaultPayoutAmount.mul(feeRate).div(1e3)
        const expectedPerTokenPayout = defaultPayoutAmount
          .sub(fee)
          .div(totalSupply)

        const expectedSenderPayout = senderAccount.tokenBalance
          .div(2)
          .floor()
          .mul(expectedPerTokenPayout)
        const expectedReceiverPayout = receiverAccount.tokenBalance
          .add(senderAccount.tokenBalance.div(2).floor())
          .mul(expectedPerTokenPayout)

        senderAccount = await getAccountInformation(poa, sender)
        receiverAccount = await getAccountInformation(poa, receiver)

        assert(
          areInRange(senderAccount.currentPayout, expectedSenderPayout, 1e2),
          `sender currentPayout ${senderAccount.currentPayout.toString()}
          should match expectedPayout ${expectedSenderPayout.toString()}`
        )
        assert(
          areInRange(
            receiverAccount.currentPayout,
            expectedReceiverPayout,
            1e2
          ),
          `receiver currentPayout ${receiverAccount.currentPayout.toString()}
          should match expectedPayout ${expectedReceiverPayout.toString()}`
        )

        await testClaimAllPayouts(poa, whitelistedPoaBuyers)
      })
    })
  })
})

describe('when buying tokens with a fluctuating fiatRate', () => {
  contract('PoaToken', () => {
    const defaultBuyAmount = new BigNumber(1e18)
    let poa
    let exr
    let exp
    let fmr
    let rate

    beforeEach('setup contracts', async () => {
      const contracts = await setupPoaAndEcosystem()
      poa = contracts.poa
      exr = contracts.exr
      exp = contracts.exp
      fmr = contracts.fmr
      rate = new BigNumber(5e4)

      // move into Funding
      const neededTime = await determineNeededTimeTravel(poa)
      await timeTravel(neededTime)
      await testStartSale(poa)

      // set starting rate to be sure of rate
      await testResetCurrencyRate(exr, exp, 'EUR', rate)
    })

    it('should give token balance proportional to commitment and fundingGoal, even when rates go down', async () => {
      const commitments = []
      // decrease by 10 percent
      const decreaseRate = 0.1
      for (const from of whitelistedPoaBuyers) {
        const preFundingGoalInWei = await poa.fundingGoalInWei()
        rate = rate.sub(rate.mul(decreaseRate)).floor()
        await testResetCurrencyRate(exr, exp, 'EUR', rate)
        const postFundingGoalInWei = await poa.fundingGoalInWei()
        assert(
          postFundingGoalInWei.greaterThan(preFundingGoalInWei),
          'fundingGoalInWei should increase when fiat rate goes down'
        )

        const purchase = await testBuyTokens(poa, {
          from,
          value: defaultBuyAmount,
          gasPrice
        })

        commitments.push({
          address: from,
          amount: purchase
        })
      }

      const purchase = await testBuyRemainingTokens(poa, {
        from: whitelistedPoaBuyers[0],
        gasPrice
      })

      // this matches the first buyer's first purchase (whitelistedPoaBuers[0])
      commitments[0].amount = purchase

      await testActivate(poa, fmr, defaultIpfsHash, {
        from: custodian,
        gasPrice
      })

      await testActiveBalances(poa, commitments)
    })

    it('should give token balance proportional to commitment and fundingGoal, even when rates go up', async () => {
      const commitments = []
      // increase by 10 percent
      const increaseRate = 0.1
      for (const from of whitelistedPoaBuyers) {
        const preFundingGoalInWei = await poa.fundingGoalInWei()
        rate = rate.add(rate.mul(increaseRate)).floor()
        await testResetCurrencyRate(exr, exp, 'EUR', rate)
        const postFundingGoalInWei = await poa.fundingGoalInWei()
        assert(
          postFundingGoalInWei.lessThan(preFundingGoalInWei),
          'fundingGoalInWei should increase when fiat rate goes down'
        )

        const purchase = await testBuyTokens(poa, {
          from,
          value: defaultBuyAmount,
          gasPrice
        })

        commitments.push({
          address: from,
          amount: purchase
        })
      }

      const purchase = await testBuyRemainingTokens(poa, {
        from: whitelistedPoaBuyers[0],
        gasPrice
      })

      // this matches the first buyer's first purchase (whitelistedPoaBuers[0])
      commitments[0].amount = purchase

      await testActivate(poa, fmr, defaultIpfsHash, {
        from: custodian,
        gasPrice
      })

      await testActiveBalances(poa, commitments)
    })

    it('should NOT move to pending if rate goes low enough before a buy', async () => {
      const fundingGoalFiatCents = await poa.fundingGoalInCents()
      const preNeededWei = await poa.fiatCentsToWei(fundingGoalFiatCents)
      // suddenly eth drops to half of value vs EUR
      rate = rate.div(2).floor()
      await testResetCurrencyRate(exr, exp, 'EUR', rate)

      await testBuyTokens(poa, {
        from: whitelistedPoaBuyers[0],
        value: preNeededWei,
        gasPrice
      })

      const postStage = await poa.stage()
      const postFundedAmountCents = await poa.fundedAmountInCents()

      assert.equal(
        postStage.toString(),
        new BigNumber(1).toString(),
        'contract should still be in stage 1, Funding'
      )
      assert(
        areInRange(postFundedAmountCents, fundingGoalFiatCents.div(2), 1e2),
        'fundedAmountInCents should be half of fundingGoalFiatCents'
      )
    })

    it('should NOT buy tokens when rate goes high enough before buy', async () => {
      const fundingGoalFiatCents = await poa.fundingGoalInCents()
      const preNeededWei = await poa.fiatCentsToWei(fundingGoalFiatCents)

      // buy half of tokens based on original rate
      await testBuyTokens(poa, {
        from: whitelistedPoaBuyers[0],
        value: preNeededWei.div(2),
        gasPrice
      })

      // rate doubles
      rate = rate.mul(2).floor()
      await testResetCurrencyRate(exr, exp, 'EUR', rate)

      const interimStage = await poa.stage()
      const preSecondEthBalance = await getEtherBalance(whitelistedPoaBuyers[1])

      // try to buy after rate doubling (fundingGoal should be met)
      const tx = await poa.buy({
        from: whitelistedPoaBuyers[1],
        value: preNeededWei.div(2).floor(),
        gasPrice
      })
      const { gasUsed } = tx.receipt
      const gasCost = gasPrice.mul(gasUsed)

      const postStage = await poa.stage()
      const postSecondEthBalance = await getEtherBalance(
        whitelistedPoaBuyers[1]
      )
      const postSecondTokenBalance = await poa.balanceOf(
        whitelistedPoaBuyers[1]
      )

      assert.equal(
        interimStage.toString(),
        new BigNumber(1).toString(),
        'stage should still be 1, Funding'
      )
      assert.equal(
        postStage.toString(),
        new BigNumber(2).toString(),
        'stage should now be 2, Pending'
      )
      assert.equal(
        postSecondTokenBalance.toString(),
        new BigNumber(0).toString(),
        'buyer should get no tokens'
      )
      assert.equal(
        preSecondEthBalance.sub(postSecondEthBalance).toString(),
        gasCost.toString(),
        'only gasCost should be deducted, the rest should be sent back'
      )
    })
  })
})
