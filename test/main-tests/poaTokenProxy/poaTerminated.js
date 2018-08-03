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
  testBuyRemainingTokens,
  testActivate,
  testBrokerClaim,
  testPayout,
  testClaim,
  testReclaim,
  testSetStageToTimedOut,
  testPaused,
  testUnpause,
  testUpdateProofOfCustody,
  testTransfer,
  testApprove,
  testTransferFrom,
  testTerminate
} = require('../../helpers/poa')
const {
  testWillThrow,
  timeTravel,
  gasPrice
} = require('../../helpers/general.js')

describe("when in 'Terminated' stage", () => {
  contract('PoaTokenProxy', () => {
    const newIpfsHash = 'Qmd286K6pohQcTKYqnS1YhWrCiS4gz7Xi34sdwMe9USZ7u'
    const newIpfsHashArray32 = [
      web3.toHex(newIpfsHash.slice(0, 32)),
      web3.toHex(newIpfsHash.slice(32))
    ]
    let poa
    let fmr

    before('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa
      fmr = contracts.fmr

      // move into "EthFunding" stage
      const neededTime = await determineNeededTimeTravel(poa)
      await timeTravel(neededTime)
      await testStartEthSale(poa)

      // move into "FundingSuccessful" stage
      await testBuyTokens(poa, {
        from: whitelistedPoaBuyers[0],
        value: 1e18,
        gasPrice
      })

      await testBuyRemainingTokens(poa, {
        from: whitelistedPoaBuyers[1],
        gasPrice
      })

      // move into "Active" stage
      await testActivate(poa, fmr, defaultIpfsHashArray32, {
        from: custodian
      })

      // clean out broker balance for easier debugging
      await testBrokerClaim(poa)

      // move into "Terminated" stage
      //⚠️  also acts as a test terminating as owner rather than custodian
      await testTerminate(poa, { from: owner })
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

    it('should NOT setStageToTimedOut, even if owner', async () => {
      await testWillThrow(testSetStageToTimedOut, [poa, { from: owner }])
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

    it('should NOT reclaim, even if owning tokens', async () => {
      await testWillThrow(testReclaim, [poa, { from: whitelistedPoaBuyers[0] }])
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

    it('should NOT checkFundingSuccessful', async () => {
      await testWillThrow(poa.checkFundingSuccessful, [])
    })
    // start core stage functionality

    it('should NOT claim if no payouts', async () => {
      await testWillThrow(testClaim, [poa, { from: whitelistedPoaBuyers[0] }])
    })

    it('should payout as broker', async () => {
      await testPayout(poa, fmr, { value: 2e18, from: broker, gasPrice })
    })

    it('should NOT payout as broker if payout is too low', async () => {
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { value: 100, from: broker, gasPrice }
      ])
    })

    it('should NOT payout as NOT broker', async () => {
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { value: 2e18, from: owner, gasPrice }
      ])
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { value: 2e18, from: whitelistedPoaBuyers[0], gasPrice }
      ])
    })

    it('should claim if payout has been made', async () => {
      await testClaim(poa, { from: whitelistedPoaBuyers[0] }, true)
    })

    it('should update proofOfCustody if custodian', async () => {
      await testUpdateProofOfCustody(poa, newIpfsHashArray32, {
        from: custodian
      })
    })

    it('should NOT update proofOfCustody if NOT custodian', async () => {
      await testWillThrow(testUpdateProofOfCustody, [
        poa,
        newIpfsHashArray32,
        { from: owner }
      ])
    })

    it('should NOT update proofOfCustody if NOT valid ipfsHash', async () => {
      // invalid length
      await testWillThrow(testUpdateProofOfCustody, [
        poa,
        [newIpfsHashArray32[0], newIpfsHashArray32[1] + 'invalidExtraStuff'],
        { from: owner }
      ])

      // wrong hashing algo
      await testWillThrow(testUpdateProofOfCustody, [
        poa,
        [newIpfsHashArray32[0], 'Zr' + newIpfsHashArray32[1].slice(2)],
        { from: owner }
      ])
    })
  })
})
