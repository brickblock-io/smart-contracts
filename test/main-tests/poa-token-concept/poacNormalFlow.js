const {
  custodian,
  whitelistedPoaBuyers,
  defaultIpfsHash,
  setupPoaAndEcosystem,
  testStartSale,
  testBuyTokens,
  determineNeededTimeTravel,
  testBuyRemainingTokens,
  testActivate,
  testBrokerClaim,
  testPayout,
  testClaimAllPayouts
} = require('../../helpers/poac')
const { timeTravel, gasPrice } = require('../../helpers/general.js')

describe("when going through Poa's normal flow", async () => {
  contract('PoaTokenConcept', () => {
    let fmr
    let poac

    before('setup contracts', async () => {
      const contracts = await setupPoaAndEcosystem()
      poac = contracts.poac
      fmr = contracts.fmr
    })

    it('should move from PreFunding to Funding after startTime', async () => {
      const neededTime = await determineNeededTimeTravel(poac)
      await timeTravel(neededTime)
      await testStartSale(poac)
    })

    it('should allow buying', async () => {
      await testBuyTokens(poac, {
        from: whitelistedPoaBuyers[0],
        value: 5e17,
        gasPrice
      })
    })

    it('should buy all remaining tokens, moving to Pending', async () => {
      await testBuyRemainingTokens(poac, {
        from: whitelistedPoaBuyers[1],
        gasPrice
      })
    })

    it('should activate with ipfs hash from custodian', async () => {
      await testActivate(poac, fmr, defaultIpfsHash, {
        from: custodian
      })
    })

    it('should claim contract funding as broker', async () => {
      await testBrokerClaim(poac)
    })

    it('should payout from custodian', async () => {
      await testPayout(poac, fmr, {
        from: custodian,
        value: 2e18,
        gasPrice
      })
    })

    it('should allow all token holders to claim', async () => {
      await testClaimAllPayouts(poac, whitelistedPoaBuyers)
    })
  })
})
