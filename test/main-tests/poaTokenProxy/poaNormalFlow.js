const {
  broker,
  custodian,
  whitelistedPoaBuyers,
  defaultIpfsHashArray32,
  setupPoaProxyAndEcosystem,
  testStartEthSale,
  testBuyTokens,
  determineNeededTimeTravel,
  testBuyRemainingTokens,
  testActivate,
  testBrokerClaim,
  testPayout,
  testClaimAllPayouts
} = require('../../helpers/poa')
const { timeTravel, gasPrice } = require('../../helpers/general.js')

describe("when going through Poa's normal flow", async () => {
  contract('PoaTokenProxy', () => {
    let fmr
    let poa

    before('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa
      fmr = contracts.fmr
    })

    it('should move from PreFunding to EthFunding after startTime', async () => {
      const neededTime = await determineNeededTimeTravel(poa)
      await timeTravel(neededTime)
      await testStartEthSale(poa)
    })

    it('should allow buying', async () => {
      await testBuyTokens(poa, {
        from: whitelistedPoaBuyers[0],
        value: 5e17,
        gasPrice
      })
    })

    it('should buy all remaining tokens, moving to Pending', async () => {
      await testBuyRemainingTokens(poa, {
        from: whitelistedPoaBuyers[1],
        gasPrice
      })
    })

    it('should activate with ipfs hash from custodian', async () => {
      await testActivate(poa, fmr, defaultIpfsHashArray32, {
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
