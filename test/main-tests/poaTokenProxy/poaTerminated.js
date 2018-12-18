const {
  bbkContributors,
  issuer,
  custodian,
  defaultIpfsHashArray32,
  owner,
  setupPoaProxyAndEcosystem,
  testActivate,
  testApprove,
  testIssuerClaim,
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

describe("when in 'Terminated' stage", () => {
  contract('PoaTokenProxy', () => {
    const newIpfsHash = 'Qmd286K6pohQcTKYqnS1YhWrCiS4gz7Xi34sdwMe9USZ7u'
    const newIpfsHashArray32 = [
      web3.toHex(newIpfsHash.slice(0, 32)),
      web3.toHex(newIpfsHash.slice(32)),
    ]
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
      await testBuyTokens(poa, {
        from: whitelistedEthInvestors[0],
        value: 1e18,
        gasPrice,
      })

      await testBuyRemainingTokens(poa, {
        from: whitelistedEthInvestors[1],
        gasPrice,
      })

      // Set proof of custody
      await testUpdateProofOfCustody(poa, defaultIpfsHashArray32, {
        from: custodian,
      })

      // Pay the initial fee
      await testPayActivationFee(poa, fmr)

      // move into 'Active' stage
      await testActivate(poa, fmr, {
        from: custodian,
      })

      // clean out issuer balance for easier debugging
      await testIssuerClaim(poa)

      // move into 'Terminated' stage
      //⚠️  also acts as a test terminating as owner rather than custodian
      await testTerminate(poa, pmr, { from: owner }, { callPoaDirectly: false })
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

    it('should NOT manualCheckForTimeout, even if owner', async () => {
      await testWillThrow(testManualCheckForTimeout, [poa, { from: owner }])
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

    it('should NOT reclaim, even if owning tokens', async () => {
      await testWillThrow(testReclaim, [
        poa,
        { from: whitelistedEthInvestors[0] },
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

    it('should NOT manualCheckForFundingSuccessful', async () => {
      await testWillThrow(poa.manualCheckForFundingSuccessful, [])
    })
    // start core stage functionality

    it('should NOT claim if no payouts', async () => {
      await testWillThrow(testClaim, [
        poa,
        { from: whitelistedEthInvestors[0] },
      ])
    })

    it('should payout as issuer', async () => {
      await testPayout(poa, fmr, { value: 2e18, from: issuer, gasPrice })
    })

    it('should NOT payout as issuer if payout is too low', async () => {
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { value: 100, from: issuer, gasPrice },
      ])
    })

    it('should NOT payout as NOT issuer', async () => {
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { value: 2e18, from: owner, gasPrice },
      ])
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { value: 2e18, from: whitelistedEthInvestors[0], gasPrice },
      ])
    })

    it('should claim if payout has been made', async () => {
      await testClaim(poa, { from: whitelistedEthInvestors[0] }, true)
    })

    it('should update proofOfCustody if custodian', async () => {
      await testUpdateProofOfCustody(poa, newIpfsHashArray32, {
        from: custodian,
      })
    })

    it('should NOT update proofOfCustody if NOT custodian', async () => {
      await testWillThrow(testUpdateProofOfCustody, [
        poa,
        newIpfsHashArray32,
        { from: owner },
      ])
    })

    it('should NOT update proofOfCustody if NOT valid ipfsHash', async () => {
      // invalid length
      await testWillThrow(testUpdateProofOfCustody, [
        poa,
        [newIpfsHashArray32[0], newIpfsHashArray32[1] + 'invalidExtraStuff'],
        { from: owner },
      ])

      // wrong hashing algo
      await testWillThrow(testUpdateProofOfCustody, [
        poa,
        [newIpfsHashArray32[0], 'Zr' + newIpfsHashArray32[1].slice(2)],
        { from: owner },
      ])
    })
  })
})
