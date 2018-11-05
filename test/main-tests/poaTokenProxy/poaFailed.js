const {
  bbkContributors,
  broker,
  custodian,
  defaultIpfsHashArray32,
  owner,
  setupPoaProxyAndEcosystem,
  testActivate,
  testApprove,
  testBuyTokens,
  testClaim,
  testPaused,
  testPayout,
  testReclaim,
  testReclaimAll,
  testSetStageToTimedOut,
  testStartPreFunding,
  testStartEthSale,
  testTerminate,
  testTransfer,
  testTransferFrom,
  testUnpause,
  testUpdateProofOfCustody,
  timeTravelToFundingPeriodTimeout,
  timeTravelToEthFundingPeriod,
  whitelistedPoaBuyers
} = require('../../helpers/poa')
const { testWillThrow, gasPrice } = require('../../helpers/general.js')
const BigNumber = require('bignumber.js')

describe("when in 'TimedOut' stage", () => {
  contract('PoaTokenProxy', () => {
    const tokenBuyAmount = new BigNumber(5e17)
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

      // time travel to start of ETH funding period
      await timeTravelToEthFundingPeriod(poa)

      // move from `PreFunding` to `EthFunding` stage
      await testStartEthSale(poa)

      // purchase tokens to reclaim when failed
      await testBuyTokens(poa, {
        from: whitelistedPoaBuyers[0],
        value: tokenBuyAmount,
        gasPrice
      })
      await testBuyTokens(poa, {
        from: whitelistedPoaBuyers[1],
        value: tokenBuyAmount,
        gasPrice
      })

      await testBuyTokens(poa, {
        from: whitelistedPoaBuyers[2],
        value: tokenBuyAmount,
        gasPrice
      })

      await timeTravelToFundingPeriodTimeout(poa)
    })

    it('should start paused', async () => {
      await testPaused(poa, true)
    })

    it('should NOT unpause, even if owner', async () => {
      await testWillThrow(testUnpause, [
        poa,
        pmr,
        { from: owner },
        { callPoaDirectly: false }
      ])
    })

    it('should NOT startEthSale, even if owner', async () => {
      await testWillThrow(testStartEthSale, [poa, { from: owner }])
    })

    it('should NOT buy, even if whitelisted', async () => {
      await testWillThrow(testBuyTokens, [
        poa,
        { from: whitelistedPoaBuyers[0], value: 3e17, gasPrice }
      ])
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

    it('should setTimedOut', async () => {
      await testSetStageToTimedOut(poa)
    })

    it('should NOT checkFundingSuccessful', async () => {
      await testWillThrow(poa.checkFundingSuccessful, [])
    })

    it('should NOT be able to call setStageToTimedOut again, even if owner', async () => {
      await testWillThrow(testSetStageToTimedOut, [poa, { from: owner }])
    })

    it('should reclaim', async () => {
      await testReclaim(poa, { from: whitelistedPoaBuyers[0] }, true)
    })

    it('should reclaim all tokens', async () => {
      await testReclaimAll(poa, whitelistedPoaBuyers)
    })
  })
})
