const {
  owner,
  custodian,
  bbkContributors,
  whitelistedPoaBuyers,
  defaultIpfsHash,
  setupPoaAndEcosystem,
  testStartSale,
  testBuyTokens,
  determineNeededTimeTravel,
  testActivate,
  testPayout,
  testClaim,
  testReclaim,
  fundingTimeoutContract,
  testSetFailed,
  testReclaimAll,
  testPaused,
  testUnpause,
  testUpdateProofOfCustody,
  testTransfer,
  testApprove,
  testTransferFrom,
  testTerminate
} = require('../../helpers/poac')
const {
  testWillThrow,
  timeTravel,
  gasPrice
} = require('../../helpers/general.js')
const BigNumber = require('bignumber.js')

describe('when in Failed (stage 3)', () => {
  contract('PoaTokenConcept', () => {
    const tokenBuyAmount = new BigNumber(5e17)
    let poac
    let fmr

    before('setup contracts', async () => {
      const contracts = await setupPoaAndEcosystem()
      poac = contracts.poac
      fmr = contracts.fmr

      // move into Funding
      const neededTime = await determineNeededTimeTravel(poac)
      await timeTravel(neededTime)
      await testStartSale(poac)

      // purchase tokens to reclaim when failed
      await testBuyTokens(poac, {
        from: whitelistedPoaBuyers[0],
        value: tokenBuyAmount,
        gasPrice
      })
      await testBuyTokens(poac, {
        from: whitelistedPoaBuyers[1],
        value: tokenBuyAmount,
        gasPrice
      })

      await testBuyTokens(poac, {
        from: whitelistedPoaBuyers[2],
        value: tokenBuyAmount,
        gasPrice
      })

      await fundingTimeoutContract(poac)
    })

    it('should start paused', async () => {
      await testPaused(poac, true)
    })

    it('should NOT unpause, even if owner', async () => {
      await testWillThrow(testUnpause, [poac, { from: owner }])
    })

    it('should NOT startSale, even if owner', async () => {
      await testWillThrow(testStartSale, [poac, { from: owner }])
    })

    it('should NOT buy, even if whitelisted', async () => {
      await testWillThrow(testBuyTokens, [
        poac,
        { from: whitelistedPoaBuyers[0], value: 3e17, gasPrice }
      ])
    })

    it('should NOT activate, even if custodian', async () => {
      await testWillThrow(testActivate, [
        poac,
        fmr,
        defaultIpfsHash,
        { from: custodian }
      ])
    })

    it('should NOT terminate, even if custodian', async () => {
      await testWillThrow(testTerminate, [poac, { from: custodian }])
    })

    it('should NOT payout, even if custodian', async () => {
      await testWillThrow(testPayout, [
        poac,
        fmr,
        { from: custodian, value: 1e18, gasPrice }
      ])
    })

    it('should NOT claim since there are no payouts', async () => {
      await testWillThrow(testClaim, [poac, { from: whitelistedPoaBuyers[0] }])
    })

    it('should NOT updateProofOfCustody, even if valid and from custodian', async () => {
      await testWillThrow(testUpdateProofOfCustody, [
        poac,
        defaultIpfsHash,
        { from: custodian }
      ])
    })

    it('should NOT transfer', async () => {
      await testWillThrow(testTransfer, [
        poac,
        whitelistedPoaBuyers[1],
        1e17,
        {
          from: whitelistedPoaBuyers[0]
        }
      ])
    })

    it('should NOT approve', async () => {
      await testWillThrow(testApprove, [
        poac,
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
        poac,
        whitelistedPoaBuyers[1],
        1e17,
        {
          from: whitelistedPoaBuyers[0]
        }
      ])
      await testWillThrow(testTransferFrom, [
        poac,
        whitelistedPoaBuyers[0],
        bbkContributors[0],
        1e17,
        {
          from: whitelistedPoaBuyers[1]
        }
      ])
    })

    // start core stage functionality

    it('should setFailed', async () => {
      await testSetFailed(poac)
    })

    it('should NOT setFailed again, even if owner', async () => {
      await testWillThrow(testSetFailed, [poac, { from: owner }])
    })

    it('should reclaim', async () => {
      await testReclaim(poac, { from: whitelistedPoaBuyers[0] }, true)
    })

    it('should reclaim all tokens', async () => {
      await testReclaimAll(poac, whitelistedPoaBuyers)
    })
  })
})
