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
  getAccountInformation
} = require('../../helpers/poac')
const { timeTravel, gasPrice, areInRange } = require('../../helpers/general.js')
const BigNumber = require('bignumber.js')

describe('when handling unhappy paths', async () => {
  contract('PoaTokenConcept', () => {
    let poac

    beforeEach('setup contracts', async () => {
      const contracts = await setupPoaAndEcosystem()
      poac = contracts.poac
    })

    it('should hit checkTimeout when reclaiming after fundingTimeout', async () => {
      const tokenBuyAmount = new BigNumber(1e18)
      const neededTime = await determineNeededTimeTravel(poac)
      await timeTravel(neededTime)
      await testStartSale(poac)

      // purchase tokens to reclaim when failed
      await testBuyTokens(poac, {
        from: whitelistedPoaBuyers[0],
        value: tokenBuyAmount,
        gasPrice
      })

      await fundingTimeoutContract(poac)
      await testFirstReclaim(poac, { from: whitelistedPoaBuyers[0] })
    })

    it('should hit checkTimeout when reclaiming after activationTimeout', async () => {
      const neededTime = await determineNeededTimeTravel(poac)
      await timeTravel(neededTime)
      await testStartSale(poac)

      // move to Pending
      await testBuyRemainingTokens(poac, {
        from: whitelistedPoaBuyers[0],
        gasPrice
      })

      await activationTimeoutContract(poac)

      await testFirstReclaim(poac, { from: whitelistedPoaBuyers[0] }, true)
    })

    it('should setFailed by anyone when activationTimeout has occured', async () => {
      const neededTime = await determineNeededTimeTravel(poac)
      await timeTravel(neededTime)
      await testStartSale(poac)

      // move to Pending
      await testBuyRemainingTokens(poac, {
        from: whitelistedPoaBuyers[0],
        gasPrice
      })

      await activationTimeoutContract(poac)
      await testSetFailed(poac, true)
    })
  })
})

describe('when trying various scenarios involving payout, transfer, approve, and transferFrom', () => {
  contract('PoaTokenConcept', () => {
    let poac
    let fmr
    let feeRate
    let totalSupply
    const defaultPayoutAmount = new BigNumber(0.23437e16)
    const defaultBuyAmount = new BigNumber(1.802384753e16)

    beforeEach('setup contracts', async () => {
      const contracts = await setupPoaAndEcosystem()
      poac = contracts.poac
      fmr = contracts.fmr

      // move into Funding
      const neededTime = await determineNeededTimeTravel(poac)
      await timeTravel(neededTime)
      await testStartSale(poac)

      await testBuyTokensMulti(poac, defaultBuyAmount)

      await testBuyRemainingTokens(poac, {
        from:
          whitelistedPoaBuyers[
            Math.floor(Math.random() * whitelistedPoaBuyers.length)
          ],
        gasPrice
      })

      // move into Active
      await testActivate(poac, fmr, defaultIpfsHash, {
        from: custodian
      })

      // clean out broker balance for easier debugging
      await testBrokerClaim(poac)

      feeRate = await poac.feeRate()
      totalSupply = await poac.totalSupply()
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

        await testPayout(poac, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        senderAccount = await getAccountInformation(poac, sender)
        receiverAccount = await getAccountInformation(poac, receiver)

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

        await testTransfer(poac, receiver, senderAccount.tokenBalance, {
          from: sender
        })

        // now need to account for unclaimedPayouts
        expectedSenderUnclaimed = senderAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )
        expectedReceiverUnclaimed = receiverAccount.tokenBalance.mul(
          expectedPerTokenPayout
        )

        await testPayout(poac, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        // another payout has occured we need to account for perToken as well
        senderAccount = await getAccountInformation(poac, sender)
        receiverAccount = await getAccountInformation(poac, receiver)

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

        await testClaimAllPayouts(poac, whitelistedPoaBuyers)
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

        await testPayout(poac, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        senderAccount = await getAccountInformation(poac, sender)
        receiverAccount = await getAccountInformation(poac, receiver)

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
          poac,
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

        await testPayout(poac, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        // another payout has occured we need to account for perToken as well
        senderAccount = await getAccountInformation(poac, sender)
        receiverAccount = await getAccountInformation(poac, receiver)

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

        await testClaimAllPayouts(poac, whitelistedPoaBuyers)
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

        await testPayout(poac, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        senderAccount = await getAccountInformation(poac, sender)
        receiverAccount = await getAccountInformation(poac, receiver)

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

        await testApprove(poac, spender, senderAccount.tokenBalance, {
          from: sender
        })
        await testTransferFrom(
          poac,
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

        await testPayout(poac, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        // another payout has occured we need to account for perToken as well
        senderAccount = await getAccountInformation(poac, sender)
        receiverAccount = await getAccountInformation(poac, receiver)

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

        await testClaimAllPayouts(poac, whitelistedPoaBuyers)
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

        await testPayout(poac, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        senderAccount = await getAccountInformation(poac, sender)
        receiverAccount = await getAccountInformation(poac, receiver)

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

        await testApprove(poac, spender, senderAccount.tokenBalance, {
          from: sender
        })
        await testTransferFrom(
          poac,
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

        await testPayout(poac, fmr, {
          from: custodian,
          value: defaultPayoutAmount,
          gasPrice
        })

        // another payout has occured we need to account for perToken as well
        senderAccount = await getAccountInformation(poac, sender)
        receiverAccount = await getAccountInformation(poac, receiver)

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

        await testClaimAllPayouts(poac, whitelistedPoaBuyers)
      })
    })

    describe('transfer 100% -> payout', () => {
      it('should have correct currentPayout and claims all users', async () => {
        const sender = whitelistedPoaBuyers[0]
        const receiver = whitelistedPoaBuyers[1]

        let senderAccount = await getAccountInformation(poac, sender)
        let receiverAccount = await getAccountInformation(poac, receiver)

        await testTransfer(poac, receiver, senderAccount.tokenBalance, {
          from: sender
        })

        await testPayout(poac, fmr, {
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

        senderAccount = await getAccountInformation(poac, sender)
        receiverAccount = await getAccountInformation(poac, receiver)
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

        await testClaimAllPayouts(poac, whitelistedPoaBuyers)
      })
    })

    describe('transfer 50% -> payout', () => {
      it('should have correct currentPayout and claims all users', async () => {
        const sender = whitelistedPoaBuyers[0]
        const receiver = whitelistedPoaBuyers[1]

        let senderAccount = await getAccountInformation(poac, sender)
        let receiverAccount = await getAccountInformation(poac, receiver)

        await testTransfer(
          poac,
          receiver,
          senderAccount.tokenBalance.div(2).floor(),
          {
            from: sender
          }
        )

        await testPayout(poac, fmr, {
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

        senderAccount = await getAccountInformation(poac, sender)
        receiverAccount = await getAccountInformation(poac, receiver)
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

        await testClaimAllPayouts(poac, whitelistedPoaBuyers)
      })
    })

    describe('transferFrom 100% -> payout', () => {
      it('should have correct currentPayout and claims all users', async () => {
        const sender = whitelistedPoaBuyers[0]
        const receiver = whitelistedPoaBuyers[1]
        const spender = whitelistedPoaBuyers[2]

        let senderAccount = await getAccountInformation(poac, sender)
        let receiverAccount = await getAccountInformation(poac, receiver)

        await testApprove(poac, spender, senderAccount.tokenBalance, {
          from: sender
        })

        await testTransferFrom(
          poac,
          sender,
          receiver,
          senderAccount.tokenBalance,
          {
            from: spender
          }
        )

        await testPayout(poac, fmr, {
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

        senderAccount = await getAccountInformation(poac, sender)
        receiverAccount = await getAccountInformation(poac, receiver)
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

        await testClaimAllPayouts(poac, whitelistedPoaBuyers)
      })
    })

    describe('transferFrom 50% -> payout', () => {
      it('should have correct currentPayout and claims all users', async () => {
        const sender = whitelistedPoaBuyers[0]
        const receiver = whitelistedPoaBuyers[1]
        const spender = whitelistedPoaBuyers[2]

        let senderAccount = await getAccountInformation(poac, sender)
        let receiverAccount = await getAccountInformation(poac, receiver)

        await testApprove(poac, spender, senderAccount.tokenBalance, {
          from: sender
        })

        await testTransferFrom(
          poac,
          sender,
          receiver,
          senderAccount.tokenBalance.div(2).floor(),
          {
            from: spender
          }
        )

        await testPayout(poac, fmr, {
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

        senderAccount = await getAccountInformation(poac, sender)
        receiverAccount = await getAccountInformation(poac, receiver)

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

        await testClaimAllPayouts(poac, whitelistedPoaBuyers)
      })
    })
  })
})
