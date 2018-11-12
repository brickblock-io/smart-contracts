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
  testSetStageToTimedOut,
  testStartPreFunding,
  testStartEthSale,
  testStartFiatSale,
  testTerminate,
  testTransfer,
  testTransferFrom,
  testUnpause,
  testUpdateProofOfCustody,
  timeTravelToFundingPeriod,
  timeTravelToEthFundingPeriod,
  whitelistedPoaBuyers,
} = require('../../helpers/poa')
const { testWillThrow, gasPrice } = require('../../helpers/general.js')

describe("when in 'PreFunding' stage", async () => {
  contract('PoaTokenProxy', () => {
    let poa
    let fmr
    let pmr

    before('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa
      fmr = contracts.fmr
      pmr = contracts.pmr

      // move from `Pending` to `PreFunding` stage
      await testStartPreFunding(poa, { from: broker, gasPrice })
    })

    it('should start paused', async () => {
      await testPaused(poa, true)
    })

    it('should NOT unpause, even if owner', async () => {
      await testWillThrow(testUnpause, [
        poa,
        pmr,
        { from: owner },
        { callPoaDirectly: false },
      ])
    })

    it('should NOT buy, even if whitelisted', async () => {
      await testWillThrow(testBuyTokens, [
        poa,
        { from: whitelistedPoaBuyers[0], value: 3e17, gasPrice },
      ])
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
        { callPoaDirectly: true },
      ])
    })

    it('should NOT reclaim', async () => {
      await testWillThrow(testReclaim, [poa, { from: whitelistedPoaBuyers[0] }])
    })

    it('should NOT payout, even if broker', async () => {
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { from: broker, value: 1e18, gasPrice },
      ])
    })

    it('should NOT claim since there are no payouts', async () => {
      await testWillThrow(testClaim, [poa, { from: whitelistedPoaBuyers[0] }])
    })

    it('should NOT updateProofOfCustody, even if valid and from custodian', async () => {
      await testWillThrow(testUpdateProofOfCustody, [
        poa,
        defaultIpfsHashArray32,
        { from: custodian },
      ])
    })

    it('should NOT transfer', async () => {
      await testWillThrow(testTransfer, [
        poa,
        whitelistedPoaBuyers[1],
        1e17,
        {
          from: whitelistedPoaBuyers[0],
        },
      ])
    })

    it('should NOT approve', async () => {
      await testWillThrow(testApprove, [
        poa,
        whitelistedPoaBuyers[1],
        1e17,
        {
          from: whitelistedPoaBuyers[0],
        },
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
          from: whitelistedPoaBuyers[0],
        },
      ])
      await testWillThrow(testTransferFrom, [
        poa,
        whitelistedPoaBuyers[0],
        bbkContributors[0],
        1e17,
        {
          from: whitelistedPoaBuyers[1],
        },
      ])
    })

    it('should NOT checkFundingSuccessful', async () => {
      await testWillThrow(poa.checkFundingSuccessful, [])
    })

    it("should NOT move to 'FiatFunding' stage by ANYONE", async () => {
      await Promise.all(
        [broker, custodian, owner, whitelistedPoaBuyers[0]].map(
          async fromAddress => {
            await testWillThrow(testStartFiatSale, [
              poa,
              { from: fromAddress, gasPrice },
            ])
          }
        )
      )
    })

    it("should NOT move to 'EthFunding' stage by ANYONE", async () => {
      await Promise.all(
        [broker, custodian, owner, whitelistedPoaBuyers[0]].map(
          async fromAddress => {
            await testWillThrow(testStartEthSale, [
              poa,
              { from: fromAddress, gasPrice },
            ])
          }
        )
      )
    })
  })
})

describe("when in 'PreFunding' stage and funding periods are reached", async () => {
  contract('PoaTokenProxy', () => {
    let poa

    beforeEach('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa

      // move from `Pending` to `PreFunding` stage
      await testStartPreFunding(poa, { from: broker, gasPrice })
    })

    it("should move to 'FiatFunding' stage by ANYONE when startTimeForFundingPeriod is reached", async () => {
      await timeTravelToFundingPeriod(poa)

      // move from `PreFunding` to `FiatFunding` stage
      await testStartFiatSale(poa, { from: whitelistedPoaBuyers[0], gasPrice })
    })

    it("should move to 'EthFunding' stage by ANYONE when startTimeForFundingPeriod+durationForFiatFundingPeriod is reached", async () => {
      await timeTravelToEthFundingPeriod(poa)

      // move from `PreFunding` to `EthFunding` stage
      await testStartEthSale(poa, { from: whitelistedPoaBuyers[0], gasPrice })
    })
  })
})
