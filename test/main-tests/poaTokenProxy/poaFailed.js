const {
  bbkContributors,
  issuer,
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
  testManualCheckForTimeout,
  testStartPreFunding,
  testStartFiatSale,
  testStartEthSale,
  testTerminate,
  testTransfer,
  testTransferFrom,
  testUnpause,
  testUpdateProofOfCustody,
  timeTravelToFundingPeriod,
  timeTravelToFundingPeriodTimeout,
  timeTravelToEthFundingPeriod,
  whitelistedEthInvestors,
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
      await testStartPreFunding(poa, { from: issuer, gasPrice })

      await timeTravelToEthFundingPeriod(poa)

      // move from `PreFunding` to `EthFunding` stage
      await testStartEthSale(poa)

      // purchase tokens to reclaim when failed
      await testBuyTokens(poa, {
        from: whitelistedEthInvestors[0],
        value: tokenBuyAmount,
        gasPrice,
      })
      await testBuyTokens(poa, {
        from: whitelistedEthInvestors[1],
        value: tokenBuyAmount,
        gasPrice,
      })

      await testBuyTokens(poa, {
        from: whitelistedEthInvestors[2],
        value: tokenBuyAmount,
        gasPrice,
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
        { callPoaDirectly: false },
      ])
    })

    it('should NOT startEthSale, even if owner', async () => {
      await testWillThrow(testStartEthSale, [poa, { from: owner }])
    })

    it('should NOT buy, even if whitelisted', async () => {
      await testWillThrow(testBuyTokens, [
        poa,
        { from: whitelistedEthInvestors[0], value: 3e17, gasPrice },
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
        { callPoaDirectly: true },
      ])
    })

    it('should NOT payout, even if issuer', async () => {
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { from: issuer, value: 1e18, gasPrice },
      ])
    })

    it('should NOT claim since there are no payouts', async () => {
      await testWillThrow(testClaim, [
        poa,
        { from: whitelistedEthInvestors[0] },
      ])
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
        whitelistedEthInvestors[1],
        1e17,
        {
          from: whitelistedEthInvestors[0],
        },
      ])
    })

    it('should NOT approve', async () => {
      await testWillThrow(testApprove, [
        poa,
        whitelistedEthInvestors[1],
        1e17,
        {
          from: whitelistedEthInvestors[0],
        },
      ])
    })

    it('should NOT transferFrom', async () => {
      // in theory would need approval put here for the sake of demonstrating
      // that approval was attempted as well.
      await testWillThrow(testApprove, [
        poa,
        whitelistedEthInvestors[1],
        1e17,
        {
          from: whitelistedEthInvestors[0],
        },
      ])
      await testWillThrow(testTransferFrom, [
        poa,
        whitelistedEthInvestors[0],
        bbkContributors[0],
        1e17,
        {
          from: whitelistedEthInvestors[1],
        },
      ])
    })

    // start core stage functionality

    it('should manualCheckForTimeout', async () => {
      await testManualCheckForTimeout(poa)
    })

    it('should NOT manualCheckForFundingSuccessful', async () => {
      await testWillThrow(poa.manualCheckForFundingSuccessful, [])
    })

    it('should NOT be able to call manualCheckForTimeout again, even if owner', async () => {
      await testWillThrow(testManualCheckForTimeout, [poa, { from: owner }])
    })

    it('should reclaim', async () => {
      await testReclaim(poa, { from: whitelistedEthInvestors[0] }, true)
    })

    it('should reclaim all tokens', async () => {
      await testReclaimAll(poa, whitelistedEthInvestors)
    })
  })
})

describe("when in 'Preview' stage but funding period is over", async () => {
  contract('PoaTokenProxy', () => {
    let poa

    before('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa

      await timeTravelToFundingPeriodTimeout(poa)
    })

    it('should manualCheckForTimeout', async () => {
      await testManualCheckForTimeout(poa)
    })
  })
})

describe("when in 'PreFunding' stage but funding period is over", async () => {
  contract('PoaTokenProxy', () => {
    let poa

    before('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa

      // move from `Pending` to `PreFunding` stage
      await testStartPreFunding(poa, { from: issuer, gasPrice })

      await timeTravelToFundingPeriodTimeout(poa)
    })

    it('should manualCheckForTimeout', async () => {
      await testManualCheckForTimeout(poa)
    })
  })
})

describe("when in 'FiatFunding' stage but funding period is over", async () => {
  contract('PoaTokenProxy', () => {
    let poa

    before('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa

      // move from `Preview` to `PreFunding` stage
      await testStartPreFunding(poa, { from: issuer, gasPrice })

      await timeTravelToFundingPeriod(poa)

      // move from `PreFunding` to `FiatFunding` stage
      await testStartFiatSale(poa, { from: issuer, gasPrice })

      await timeTravelToFundingPeriodTimeout(poa)
    })

    it('should testManualCheckForTimeout', async () => {
      await testManualCheckForTimeout(poa)
    })
  })
})
