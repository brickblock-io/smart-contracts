const BigNumber = require('bignumber.js')
const {
  bbkContributors,
  broker,
  custodian,
  defaultIpfsHashArray32,
  determineNeededTimeTravel,
  getRemainingAmountInWeiDuringEthFunding,
  owner,
  setupPoaProxyAndEcosystem,
  testActivate,
  testApprove,
  testBuyRemainingTokens,
  testBuyTokens,
  testClaim,
  testPaused,
  testPayout,
  testReclaim,
  testSetStageToTimedOut,
  testStartPreFunding,
  testStartEthSale,
  testTerminate,
  testTransfer,
  testTransferFrom,
  testUnpause,
  testUpdateProofOfCustody,
  whitelistedPoaBuyers
} = require('../../helpers/poa')
const {
  testWillThrow,
  gasPrice,
  getGasUsed,
  getEtherBalance
} = require('../../helpers/general.js')
const { timeTravel } = require('helpers')

describe("when in 'EthFunding' stage", () => {
  contract('PoaTokenProxy', () => {
    let poa
    let fmr
    let pmr

    before('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa
      fmr = contracts.fmr
      pmr = contracts.pmr

      // move from `Preview` to `PreFunding` stage
      await testStartPreFunding(poa, { from: broker, gasPrice })

      // move from `PreFunding` to `EthFunding` stage
      const neededTime = await determineNeededTimeTravel(poa)
      await timeTravel(neededTime)
      await testStartEthSale(poa)
    })

    it('should start paused', async () => {
      await testPaused(poa, true)
    })

    it('should NOT unpause, even if owner', async () => {
      await testWillThrow(testUnpause, [
        poa,
        pmr,
        { from: owner },
        { callPoaDIrectly: false }
      ])
    })

    it('should NOT startEthSale, even if owner', async () => {
      await testWillThrow(testStartEthSale, [poa, { from: owner }])
    })

    it('should NOT setStageToTimedOut', async () => {
      await testWillThrow(testSetStageToTimedOut, [poa, { from: owner }])
    })

    it('should NOT activate, even if custodian', async () => {
      await testWillThrow(testActivate, [poa, fmr, { from: custodian }])
    })

    it('should NOT terminate, even if custodian', async () => {
      await testWillThrow(testTerminate, [
        poa,
        pmr,
        { from: custodian },
        { callPoaDirectly: true }
      ])
    })

    it('should NOT reclaim, even if owning tokens', async () => {
      await testWillThrow(testReclaim, [poa, { from: whitelistedPoaBuyers[0] }])
    })

    it('should NOT payout, even if broker', async () => {
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { from: broker, value: 1e18, gasPrice }
      ])
    })

    it('should NOT claim since there are no payouts', async () => {
      await testWillThrow(testClaim, [poa, { from: whitelistedPoaBuyers[0] }])
    })

    it('should NOT updateProofOfCustody, even if valid and from custodian', async () => {
      await testWillThrow(testUpdateProofOfCustody, [
        poa,
        defaultIpfsHashArray32,
        { from: custodian }
      ])
    })

    it('should NOT transfer', async () => {
      await testWillThrow(testTransfer, [
        poa,
        whitelistedPoaBuyers[1],
        1e17,
        {
          from: whitelistedPoaBuyers[0]
        }
      ])
    })

    it('should NOT approve', async () => {
      await testWillThrow(testApprove, [
        poa,
        whitelistedPoaBuyers[1],
        1e17,
        {
          from: whitelistedPoaBuyers[0]
        }
      ])
    })

    it('should NOT transferFrom', async () => {
      // in theory would need approval put here for the sake of demonstrating
      // that approval was attempted as well.
      await testWillThrow(testApprove, [
        poa,
        whitelistedPoaBuyers[1],
        1e17,
        {
          from: whitelistedPoaBuyers[0]
        }
      ])
      await testWillThrow(testTransferFrom, [
        poa,
        whitelistedPoaBuyers[0],
        bbkContributors[0],
        1e17,
        {
          from: whitelistedPoaBuyers[1]
        }
      ])
    })

    // start core stage functionality

    it('should allow buying', async () => {
      await testBuyTokens(poa, {
        from: whitelistedPoaBuyers[0],
        value: 5e17,
        gasPrice
      })
    })

    it('should move into pending when all tokens are bought', async () => {
      await testBuyRemainingTokens(poa, {
        from: whitelistedPoaBuyers[1],
        gasPrice
      })
    })
  })
})

describe("when in 'EthFunding' stage", () => {
  contract('PoaTokenProxy', () => {
    let poa

    beforeEach('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa

      // move from `Preview` to `PreFunding` stage
      await testStartPreFunding(poa, { from: broker, gasPrice })

      // move from `PreFunding` to `EthFunding` stage
      const neededTime = await determineNeededTimeTravel(poa)
      await timeTravel(neededTime)
      await testStartEthSale(poa)
      await testBuyTokens(poa, {
        from: whitelistedPoaBuyers[0],
        value: 5e17,
        gasPrice
      })
    })

    it('should refund the extra amount if it exceeds the funding goal', async () => {
      const buyer = whitelistedPoaBuyers[0]
      const extraAmount = new BigNumber(1e18)
      const remainingBuyableEth = await getRemainingAmountInWeiDuringEthFunding(
        poa
      )
      const amount = remainingBuyableEth.plus(extraAmount)
      const preBalance = await getEtherBalance(buyer)
      const tx = await poa.buy({
        from: buyer,
        value: amount,
        gasPrice
      })
      const postBalance = await getEtherBalance(buyer)
      const gasUsed = await getGasUsed(tx)
      const gasCost = new BigNumber(gasUsed).mul(gasPrice)

      const expectedRefundAmount = extraAmount.sub(gasCost)
      const expectedPostBalance = preBalance
        .sub(amount)
        .plus(expectedRefundAmount)

      assert.equal(
        postBalance.toString(),
        expectedPostBalance.toString(),
        'Actual balance should match the expected.'
      )
    })

    it('should NOT refund if the amount does not exceeds the funding goal', async () => {
      const buyer = whitelistedPoaBuyers[0]
      const remainingBuyableEth = await getRemainingAmountInWeiDuringEthFunding(
        poa
      )
      const preBalance = await getEtherBalance(buyer)
      const tx = await poa.buy({
        from: buyer,
        value: remainingBuyableEth,
        gasPrice
      })
      const postBalance = await getEtherBalance(buyer)
      const gasUsed = await getGasUsed(tx)
      const gasCost = new BigNumber(gasUsed).mul(gasPrice)

      const expectedPostBalance = preBalance
        .sub(remainingBuyableEth)
        .sub(gasCost)

      assert.equal(
        postBalance.toString(),
        expectedPostBalance.toString(),
        'Actual balance should match the expected.'
      )
    })
  })
})
