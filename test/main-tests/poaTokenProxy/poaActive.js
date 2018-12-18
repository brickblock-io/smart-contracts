const {
  bbkContributors,
  issuer,
  custodian,
  defaultBuyAmount,
  defaultIpfsHashArray32,
  newIpfsHashArray32,
  owner,
  setupPoaProxyAndEcosystem,
  testActivate,
  testActiveBalances,
  testApprove,
  testIssuerClaim,
  testBuyRemainingTokens,
  testBuyTokens,
  testClaim,
  testPause,
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

describe("when in 'Active' stage", () => {
  contract('PoaTokenProxy', () => {
    let poa
    let fmr
    let pmr
    const commitments = []

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
        value: defaultBuyAmount,
        gasPrice,
      })

      // save for testing token balances once Active
      commitments.push({
        address: whitelistedEthInvestors[0],
        amount: defaultBuyAmount,
      })

      const commitAmount = await testBuyRemainingTokens(poa, {
        from: whitelistedEthInvestors[1],
        gasPrice,
      })

      // save for testing token balances once Active
      commitments.push({
        address: whitelistedEthInvestors[1],
        amount: commitAmount,
      })

      // Set proof of custody
      await testUpdateProofOfCustody(poa, defaultIpfsHashArray32, {
        from: custodian,
      })

      // Pay the initial fee
      await testPayActivationFee(poa, fmr)

      // move into "Active" stage
      await testActivate(poa, fmr, {
        from: custodian,
      })

      // clean out issuer balance for easier debugging
      await testIssuerClaim(poa)
    })

    it('should have correct token balances once in Active stage', async () => {
      await testActiveBalances(poa, commitments)
    })

    it('should be unpaused', async () => {
      await testPaused(poa, false)
    })

    it('should NOT unpause when already unpaused', async () => {
      await testWillThrow(testUnpause, [
        poa,
        pmr,
        { from: owner },
        { callPoaDirectly: false },
      ])
    })

    it('should NOT pause if NOT owner', async () => {
      await testWillThrow(testPause, [
        poa,
        pmr,
        { from: whitelistedEthInvestors[0] },
        { callPoaDirectly: true },
      ])
    })

    it('should pause if owner', async () => {
      await testPause(poa, pmr, { from: owner }, { callPoaDirectly: false })
    })

    it('should NOT pause if already paused', async () => {
      await testWillThrow(testPause, [
        poa,
        pmr,
        { from: owner },
        { callPoaDirectly: false },
      ])
    })

    it('should NOT unpause if NOT owner', async () => {
      await testWillThrow(testUnpause, [
        poa,
        pmr,
        { from: whitelistedEthInvestors[0] },
        { callPoaDirectly: true },
      ])
    })

    it('should unpause if owner', async () => {
      await testUnpause(poa, pmr, { from: owner }, { callPoaDirectly: false })
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

    it('should NOT reclaim, even if owning tokens', async () => {
      await testWillThrow(testReclaim, [
        poa,
        { from: whitelistedEthInvestors[0] },
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

    it('should payout as issuer OR custodian', async () => {
      await testPayout(poa, fmr, { value: 2e18, from: issuer, gasPrice })
      await testPayout(poa, fmr, { value: 2e18, from: custodian, gasPrice })
    })

    it('should NOT payout as issuer if payout is too low', async () => {
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { value: 100, from: issuer, gasPrice },
      ])
    })

    it('should NOT payout as NOT issuer or custodian', async () => {
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { value: 2e18, from: owner, gasPrice },
      ])
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { value: 2e18, from: bbkContributors[0], gasPrice },
      ])
    })

    it('should claim if payout has been made', async () => {
      await testClaim(poa, { from: whitelistedEthInvestors[0] })
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
        [
          newIpfsHashArray32[0],
          newIpfsHashArray32[1].slice(newIpfsHashArray32[1].length - 2),
        ],
        {
          from: custodian,
        },
      ])

      // wrong hashing algo
      await testWillThrow(testUpdateProofOfCustody, [
        poa,
        [newIpfsHashArray32[0].replace('Qm', 'Zr'), newIpfsHashArray32[1]],
        {
          from: custodian,
        },
      ])
    })

    it('should approve', async () => {
      await testApprove(poa, whitelistedEthInvestors[1], 1e17, {
        from: whitelistedEthInvestors[0],
      })
    })

    it('should NOT transfer to NOT whitelisted address', async () => {
      await testWillThrow(testTransfer, [
        poa,
        custodian,
        1e17,
        { from: whitelistedEthInvestors[0] },
      ])
    })

    it('should NOT transferFrom to NOT whitelisted address', async () => {
      await testWillThrow(testTransferFrom, [
        poa,
        whitelistedEthInvestors[0],
        custodian,
        1e17,
        { from: whitelistedEthInvestors[1] },
      ])
    })

    it('should transfer to whitelisted addresses', async () => {
      await testTransfer(poa, whitelistedEthInvestors[1], 1e17, {
        from: whitelistedEthInvestors[0],
      })
    })

    it('should transferFrom to whitelisted address', async () => {
      await testTransferFrom(
        poa,
        whitelistedEthInvestors[0],
        whitelistedEthInvestors[2],
        1e17,
        {
          from: whitelistedEthInvestors[1],
        }
      )
    })

    // test for owner done through contract setup test for Terminated stage
    it('should allow terminating if owner or custodian', async () => {
      await testTerminate(
        poa,
        pmr,
        { from: custodian },
        { callPoaDirectly: true }
      )
    })
  })
})
