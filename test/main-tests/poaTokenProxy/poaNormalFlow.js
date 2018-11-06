const {
  broker,
  custodian,
  defaultIpfsHashArray32,
  setupPoaProxyAndEcosystem,
  testActivate,
  testBrokerClaim,
  testBuyRemainingTokens,
  testBuyTokens,
  testClaimAllPayouts,
  testPayActivationFee,
  testPayout,
  testStartPreFunding,
  testStartEthSale,
  testUpdateProofOfCustody,
  timeTravelToEthFundingPeriod,
  whitelistedPoaBuyers
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
      await testStartPreFunding(poa, { from: broker, gasPrice })
    })

    it('should move from PreFunding to EthFunding after startTimeForEthFundingPeriod', async () => {
      await timeTravelToEthFundingPeriod(poa)

      // move from `PreFunding` to `EthFunding` stage
      await testStartEthSale(poa)
    })

    it('should allow buying', async () => {
      await testBuyTokens(poa, {
        from: whitelistedPoaBuyers[0],
        value: 5e17,
        gasPrice
      })
    })

    it("should buy all remaining tokens, moving to 'FundingSuccessful' stage", async () => {
      await testBuyRemainingTokens(poa, {
        from: whitelistedPoaBuyers[1],
        gasPrice
      })
    })

    it('should update proof of custody', async () => {
      await testUpdateProofOfCustody(poa, defaultIpfsHashArray32, {
        from: custodian
      })
    })

    it('broker should pay initial fee', async () => {
      await testPayActivationFee(poa, fmr)
    })

    it('should activate with ipfs hash from custodian', async () => {
      await testActivate(poa, fmr, {
        from: custodian
      })
    })

    it('should claim contract funding as broker', async () => {
      await testBrokerClaim(poa)
    })

    it('should allow payouts by broker', async () => {
      await testPayout(poa, fmr, {
        from: broker,
        value: 2e18,
        gasPrice
      })
    })

    it('should allow all token holders to claim', async () => {
      await testClaimAllPayouts(poa, whitelistedPoaBuyers)
    })
  })
})
