const {
  bbkContributors,
  issuer,
  custodian,
  defaultIpfsHashArray32,
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
  testManualCheckForTimeout,
  testStartPreFunding,
  testStartEthSale,
  testTerminate,
  testTransfer,
  testTransferFrom,
  testUnpause,
  testUpdateProofOfCustody,
  timeTravelToEthFundingPeriod,
  whitelistedEthInvestors,
} = require('../../helpers/poa')
const { testWillThrow, gasPrice } = require('../../helpers/general.js')

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
      await testStartPreFunding(poa, { from: issuer, gasPrice })

      await timeTravelToEthFundingPeriod(poa)

      // move from `PreFunding` to `EthFunding` stage
      await testStartEthSale(poa)

      // move into `FundingSuccessful` stage
      await testBuyRemainingTokens(poa, {
        from: whitelistedEthInvestors[1],
        gasPrice,
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

    it('should NOT manualCheckForTimeout', async () => {
      await testWillThrow(testManualCheckForTimeout, [poa, { from: owner }])
    })

    it('should NOT terminate, even if custodian', async () => {
      await testWillThrow(testTerminate, [
        poa,
        pmr,
        { from: custodian },
        { callPoaDirectly: true },
      ])
    })

    it('should NOT reclaim, even if owning tokens', async () => {
      await testWillThrow(testReclaim, [
        poa,
        { from: whitelistedEthInvestors[0] },
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

    it('should updateProofOfCustody', async () => {
      await testUpdateProofOfCustody(poa, defaultIpfsHashArray32, {
        from: custodian,
      })
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

    it('should NOT manualCheckForFundingSuccessful', async () => {
      await testWillThrow(poa.manualCheckForFundingSuccessful, [])
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
        from: custodian,
      })
    })
  })
})

describe("when in paying activation fee in 'FundingSuccessful' stage", () => {
  contract('PoaTokenProxy', () => {
    let poa
    let fmr

    beforeEach('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa
      fmr = contracts.fmr

      // move from `Preview` to `PreFunding` stage
      await testStartPreFunding(poa, { from: issuer, gasPrice })

      await timeTravelToEthFundingPeriod(poa)

      // move from `PreFunding` to `EthFunding` stage
      await testStartEthSale(poa)

      // move into `FundingSuccessful` stage
      await testBuyRemainingTokens(poa, {
        from: whitelistedEthInvestors[1],
        gasPrice,
      })
    })

    it('should NOT accept fee that is more than 0.5% lower than the calculated total fee', async () => {
      /*
       * Default funding goal is €500,000.00
       * So the expected fee is €2,500
       *
       * €2,500 against the defaultFiatRate of €33,333 per ETH are:
       * €2,500 / €33,333 per ETH = 0,07500075 ETH
       */
      const expectedTotalFeeInWei = await poa.calculateTotalFee()
      const underThresholdFee = expectedTotalFeeInWei
        .div(1000)
        .mul(994) // 0.6% lower
        .floor()

      await testWillThrow(testPayActivationFee, [
        poa,
        fmr,
        { value: underThresholdFee },
      ])
    })

    it('should NOT accept fee that is more than 0.5% higher than the calculated total fee', async () => {
      const expectedTotalFeeInWei = await poa.calculateTotalFee()
      const overThresholdFee = expectedTotalFeeInWei
        .div(1000)
        .mul(1006) // 0.6% higher
        .floor()

      await testWillThrow(testPayActivationFee, [
        poa,
        fmr,
        { value: overThresholdFee },
      ])
    })

    it('should accept fee that is lower than the calculated fee, but only less than 0.5% lower', async () => {
      const expectedTotalFeeInWei = await poa.calculateTotalFee()
      const validLowFee = expectedTotalFeeInWei
        .div(1000)
        .mul(996) // 0.4% lower
        .floor()

      await testPayActivationFee(poa, fmr, {
        value: validLowFee,
      })
    })

    it('should accept fee that is higher than the calculated fee, but only less than 0.5% higher', async () => {
      const expectedTotalFeeInWei = await poa.calculateTotalFee()
      const validHighFee = expectedTotalFeeInWei
        .div(1000)
        .mul(1004) // 0.4% higher
        .floor()

      await testPayActivationFee(poa, fmr, {
        value: validHighFee,
      })
    })
  })
})
