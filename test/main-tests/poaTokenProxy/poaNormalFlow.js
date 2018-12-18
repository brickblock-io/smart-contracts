const {
  issuer,
  custodian,
  defaultIpfsHashArray32,
  setupPoaProxyAndEcosystem,
  testActivate,
  testIssuerClaim,
  testBuyRemainingTokens,
  testBuyTokens,
  testClaimAllPayouts,
  testPayActivationFee,
  testPayout,
  testStartPreFunding,
  testStartEthSale,
  testUpdateProofOfCustody,
  timeTravelToEthFundingPeriod,
  whitelistedEthInvestors,
} = require('../../helpers/poa')
const { gasPrice } = require('../../helpers/general.js')

describe("when going through Poa's normal flow", async () => {
  contract('PoaTokenProxy', () => {
    let fmr
    let poa

    before('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa
      fmr = contracts.fmr
    })

    it("should move from 'Preview' to 'PreFunding' stage", async () => {
      await testStartPreFunding(poa, { from: issuer, gasPrice })
    })

    it('should move from PreFunding to EthFunding after startTimeForEthFundingPeriod', async () => {
      await timeTravelToEthFundingPeriod(poa)

      // move from `PreFunding` to `EthFunding` stage
      await testStartEthSale(poa)
    })

    it('should allow buying', async () => {
      await testBuyTokens(poa, {
        from: whitelistedEthInvestors[0],
        value: 5e17,
        gasPrice,
      })
    })

    it("should buy all remaining tokens, moving to 'FundingSuccessful' stage", async () => {
      await testBuyRemainingTokens(poa, {
        from: whitelistedEthInvestors[1],
        gasPrice,
      })
    })

    it('should update proof of custody', async () => {
      await testUpdateProofOfCustody(poa, defaultIpfsHashArray32, {
        from: custodian,
      })
    })

    it('issuer should pay initial fee', async () => {
      await testPayActivationFee(poa, fmr)
    })

    it('should activate with ipfs hash from custodian', async () => {
      await testActivate(poa, fmr, {
        from: custodian,
      })
    })

    it('should claim contract funding as issuer', async () => {
      await testIssuerClaim(poa)
    })

    it('should allow payouts by issuer', async () => {
      await testPayout(poa, fmr, {
        from: issuer,
        value: 2e18,
        gasPrice,
      })
    })

    it('should allow all token holders to claim', async () => {
      await testClaimAllPayouts(poa, whitelistedEthInvestors)
    })
  })
})
