const {
  owner,
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
  testClaim,
  testReclaim,
  testSetFailed,
  testPaused,
  testPause,
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

describe('when in Active (stage 4)', () => {
  contract('PoaTokenConcept', () => {
    const newIpfsHash = 'Qmd286K6pohQcTKYqnS1YhWrCiS4gz7Xi34sdwMe9USZ7u'
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

      // move into Pending
      await testBuyTokens(poac, {
        from: whitelistedPoaBuyers[0],
        value: 1e18,
        gasPrice
      })

      await testBuyRemainingTokens(poac, {
        from: whitelistedPoaBuyers[1],
        gasPrice
      })

      // move into Active
      await testActivate(poac, fmr, defaultIpfsHash, {
        from: custodian
      })

      // clean out broker balance for easier debugging
      await testBrokerClaim(poac)
    })

    it('should be unpaused', async () => {
      await testPaused(poac, false)
    })

    it('should NOT unpause when already unpaused', async () => {
      await testWillThrow(testUnpause, [poac, { from: owner }])
    })

    it('should NOT pause if NOT owner', async () => {
      await testWillThrow(testPause, [poac, { from: whitelistedPoaBuyers[0] }])
    })

    it('should pause if owner', async () => {
      await testPause(poac, { from: owner })
    })

    it('should NOT pause if already paused', async () => {
      await testWillThrow(testPause, [poac, { from: owner }])
    })

    it('should NOT unpause if NOT owner', async () => {
      await testWillThrow(testUnpause, [
        poac,
        { from: whitelistedPoaBuyers[0] }
      ])
    })

    it('should unpause if owner', async () => {
      await testUnpause(poac, { from: owner })
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

    it('should NOT setFailed, even if owner', async () => {
      await testWillThrow(testSetFailed, [poac, { from: owner }])
    })

    it('should NOT activate, even if custodian', async () => {
      await testWillThrow(testActivate, [
        poac,
        fmr,
        defaultIpfsHash,
        { from: custodian }
      ])
    })

    it('should NOT reclaim, even if owning tokens', async () => {
      await testWillThrow(testReclaim, [
        poac,
        { from: whitelistedPoaBuyers[0] }
      ])
    })

    // start core stage functionality

    it('should NOT claim if no payouts', async () => {
      await testWillThrow(testClaim, [poac, { from: whitelistedPoaBuyers[0] }])
    })

    it('should payout as custodian', async () => {
      await testPayout(poac, fmr, { value: 2e18, from: custodian, gasPrice })
    })

    it('should NOT payout as custodian if payout is too low', async () => {
      await testWillThrow(testPayout, [
        poac,
        fmr,
        { value: 100, from: custodian, gasPrice }
      ])
    })

    it('should NOT payout as NOT custodian', async () => {
      await testWillThrow(testPayout, [
        poac,
        fmr,
        { value: 2e18, from: owner, gasPrice }
      ])
    })

    it('should claim if payout has been made', async () => {
      await testClaim(poac, { from: whitelistedPoaBuyers[0] })
    })

    it('should update proofOfCustody if custodian', async () => {
      await testUpdateProofOfCustody(poac, newIpfsHash, { from: custodian })
    })

    it('should NOT update proofOfCustody if NOT custodian', async () => {
      await testWillThrow(testUpdateProofOfCustody, [
        poac,
        newIpfsHash,
        { from: owner }
      ])
    })

    it('should NOT update proofOfCustody if NOT valid ipfsHash', async () => {
      // invalid length
      await testWillThrow(testUpdateProofOfCustody, [
        poac,
        newIpfsHash.slice(0, newIpfsHash.length - 2),
        { from: owner }
      ])

      // wrong hashing algo
      await testWillThrow(testUpdateProofOfCustody, [
        poac,
        'Zr' + newIpfsHash.slice(2),
        { from: owner }
      ])
    })

    it('should transfer', async () => {
      await testTransfer(poac, whitelistedPoaBuyers[1], 1e17, {
        from: whitelistedPoaBuyers[0]
      })
    })

    it('should approve', async () => {
      await testApprove(poac, whitelistedPoaBuyers[1], 1e17, {
        from: whitelistedPoaBuyers[0]
      })
    })

    it('should transferFrom', async () => {
      await testTransferFrom(
        poac,
        whitelistedPoaBuyers[0],
        whitelistedPoaBuyers[2],
        1e17,
        {
          from: whitelistedPoaBuyers[1]
        }
      )
    })

    // test for owner done through contract setup test for Terminated stage
    it('should allow terminating if owner or custodian', async () => {
      await testTerminate(poac, { from: custodian })
    })
  })
})
