const {
  bbkContributors,
  broker,
  custodian,
  defaultIpfsHashArray32,
  determineNeededTimeTravel,
  owner,
  setupPoaProxyAndEcosystem,
  testActivate,
  testApprove,
  testBuyRemainingTokens,
  testBuyTokens,
  testClaim,
  testPaused,
  testPayActivationFee,
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
const { testWillThrow, gasPrice } = require('../../helpers/general.js')
const { timeTravel } = require('helpers')

describe("when in 'FundingSuccessful' stage", () => {
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

      // move into "FundingSuccessful" stage
      await testBuyRemainingTokens(poa, {
        from: whitelistedPoaBuyers[1],
        gasPrice
      })
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

    it('should NOT setStageToTimedOut', async () => {
      await testWillThrow(testSetStageToTimedOut, [poa, { from: owner }])
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

    it('should updateProofOfCustody', async () => {
      await testUpdateProofOfCustody(poa, defaultIpfsHashArray32, {
        from: custodian
      })
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

    it('should NOT checkFundingSuccessful', async () => {
      await testWillThrow(poa.checkFundingSuccessful, [])
    })

    // start core stage functionality
    it('should pay activation fee', async () => {
      await testPayActivationFee(poa, fmr)
    })

    it('should NOT allow paying initial fee more than once', async () => {
      await testWillThrow(testPayActivationFee, [poa, fmr])
    })

    it('should move into Active when activated', async () => {
      await testActivate(poa, fmr, {
        from: custodian
      })
    })
  })
})
