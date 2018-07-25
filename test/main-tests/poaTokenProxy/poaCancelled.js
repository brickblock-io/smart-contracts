const {
  owner,
  broker,
  custodian,
  bbkContributors,
  whitelistedPoaBuyers,
  defaultIpfsHashArray32,
  setupPoaProxyAndEcosystem,
  testStartEthSale,
  testBuyTokens,
  determineNeededTimeTravel,
  testActivate,
  testPayout,
  testClaim,
  testPaused,
  testUnpause,
  testUpdateProofOfCustody,
  testTransfer,
  testApprove,
  testTransferFrom,
  testTerminate,
  testStartFiatSale,
  testBuyTokensWithFiat,
  testSetCancelled
} = require('../../helpers/poa')
const {
  testWillThrow,
  timeTravel,
  gasPrice
} = require('../../helpers/general.js')

describe('when in Cancelled', () => {
  contract('PoaToken', accounts => {
    let poa
    let fmr
    const fiatInvestor = accounts[3]

    before('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa
      fmr = contracts.fmr

      // move into "FiatFunding" stagew
      const neededTime = await determineNeededTimeTravel(poa)
      await timeTravel(neededTime)
      await testStartFiatSale(poa, { from: broker, gasPrice })
      await testBuyTokensWithFiat(poa, fiatInvestor, 100000, {
        from: custodian,
        gasPrice
      })

      await testSetCancelled(poa, custodian, true)
    })

    it('should start paused', async () => {
      await testPaused(poa, true)
    })

    it('should NOT unpause, even if owner', async () => {
      await testWillThrow(testUnpause, [poa, { from: owner }])
    })

    it('should NOT startEthSale, even if owner', async () => {
      await testWillThrow(testStartEthSale, [poa, { from: owner }])
    })

    it('should NOT buy, even if whitelisted', async () => {
      await testWillThrow(testBuyTokens, [
        poa,
        { from: whitelistedPoaBuyers[0], value: 3e17, gasPrice }
      ])
    })

    it('should NOT activate, even if custodian', async () => {
      await testWillThrow(testActivate, [
        poa,
        fmr,
        defaultIpfsHashArray32,
        { from: custodian }
      ])
    })

    it('should NOT terminate, even if custodian', async () => {
      await testWillThrow(testTerminate, [poa, { from: custodian }])
    })

    it('should NOT payout, even if broker', async () => {
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { from: broker, value: 1e18, gasPrice }
      ])
    })

    it('should NOT claim since there are no payouts', async () => {
      await testWillThrow(testClaim, [poa, { from: whitelistedPoaBuyers[0] }])
    })

    it('should NOT updateProofOfCustody, even if valid and from custodian', async () => {
      await testWillThrow(testUpdateProofOfCustody, [
        poa,
        defaultIpfsHashArray32,
        { from: custodian }
      ])
    })

    it('should NOT transfer', async () => {
      await testWillThrow(testTransfer, [
        poa,
        whitelistedPoaBuyers[1],
        1e17,
        {
          from: whitelistedPoaBuyers[0]
        }
      ])
    })

    it('should NOT approve', async () => {
      await testWillThrow(testApprove, [
        poa,
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
        poa,
        whitelistedPoaBuyers[1],
        1e17,
        {
          from: whitelistedPoaBuyers[0]
        }
      ])
      await testWillThrow(testTransferFrom, [
        poa,
        whitelistedPoaBuyers[0],
        bbkContributors[0],
        1e17,
        {
          from: whitelistedPoaBuyers[1]
        }
      ])
    })

    // start core stage functionality

    it('should NOT allow FiatFunding', async () => {
      await testWillThrow(testBuyTokensWithFiat, [
        poa,
        fiatInvestor,
        100000,
        {
          from: custodian,
          gasPrice
        }
      ])
    })

    it('should NOT allow EthFunding', async () => {
      await testWillThrow(testBuyTokens, [
        poa,
        {
          from: whitelistedPoaBuyers[0],
          value: 5e17,
          gasPrice
        }
      ])
    })
  })
})
