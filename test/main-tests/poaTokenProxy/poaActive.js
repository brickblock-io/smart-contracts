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
  testPause,
  testUnpause,
  testUpdateProofOfCustody,
  testTransfer,
  testApprove,
  testTransferFrom,
  testTerminate,
  testActiveBalances,
  defaultBuyAmount,
  testToggleWhitelistTransfers,
  newIpfsHashArray32,
  testPayActivationFee
} = require('../../helpers/poa')
const {
  testWillThrow,
  timeTravel,
  gasPrice
} = require('../../helpers/general.js')

describe("when in 'Active' stage", () => {
  contract('PoaTokenProxy', () => {
    let poa
    let fmr
    const commitments = []

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
        value: defaultBuyAmount,
        gasPrice
      })

      // save for testing token balances once Active
      commitments.push({
        address: whitelistedPoaBuyers[0],
        amount: defaultBuyAmount
      })

      const commitAmount = await testBuyRemainingTokens(poa, {
        from: whitelistedPoaBuyers[1],
        gasPrice
      })

      // save for testing token balances once Active
      commitments.push({
        address: whitelistedPoaBuyers[1],
        amount: commitAmount
      })

      // Set proof of custody
      await testUpdateProofOfCustody(poa, defaultIpfsHashArray32, {
        from: custodian
      })

      // Pay the initial fee
      await testPayActivationFee(poa, fmr)

      // move into "Active" stage
      await testActivate(poa, fmr, {
        from: custodian
      })

      // clean out broker balance for easier debugging
      await testBrokerClaim(poa)
    })

    it('should have correct token balances once in Active stage', async () => {
      await testActiveBalances(poa, commitments)
    })

    it('should be unpaused', async () => {
      await testPaused(poa, false)
    })

    it('should NOT unpause when already unpaused', async () => {
      await testWillThrow(testUnpause, [poa, { from: owner }])
    })

    it('should NOT pause if NOT owner', async () => {
      await testWillThrow(testPause, [poa, { from: whitelistedPoaBuyers[0] }])
    })

    it('should pause if owner', async () => {
      await testPause(poa, { from: owner })
    })

    it('should NOT pause if already paused', async () => {
      await testWillThrow(testPause, [poa, { from: owner }])
    })

    it('should NOT unpause if NOT owner', async () => {
      await testWillThrow(testUnpause, [poa, { from: whitelistedPoaBuyers[0] }])
    })

    it('should unpause if owner', async () => {
      await testUnpause(poa, { from: owner })
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
      await testWillThrow(testActivate, [poa, fmr, { from: custodian }])
    })

    it('should NOT reclaim, even if owning tokens', async () => {
      await testWillThrow(testReclaim, [poa, { from: whitelistedPoaBuyers[0] }])
    })

    it('should NOT checkFundingSuccessful', async () => {
      await testWillThrow(poa.checkFundingSuccessful, [])
    })

    // start core stage functionality

    it('should NOT claim if no payouts', async () => {
      await testWillThrow(testClaim, [poa, { from: whitelistedPoaBuyers[0] }])
    })

    it('should payout as broker OR custodian', async () => {
      await testPayout(poa, fmr, { value: 2e18, from: broker, gasPrice })
      await testPayout(poa, fmr, { value: 2e18, from: custodian, gasPrice })
    })

    it('should NOT payout as broker if payout is too low', async () => {
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { value: 100, from: broker, gasPrice }
      ])
    })

    it('should NOT payout as NOT broker or custodian', async () => {
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { value: 2e18, from: owner, gasPrice }
      ])
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { value: 2e18, from: bbkContributors[0], gasPrice }
      ])
    })

    it('should claim if payout has been made', async () => {
      await testClaim(poa, { from: whitelistedPoaBuyers[0] })
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
        [
          newIpfsHashArray32[0],
          newIpfsHashArray32[1].slice(newIpfsHashArray32[1].length - 2)
        ],
        {
          from: custodian
        }
      ])

      // wrong hashing algo
      await testWillThrow(testUpdateProofOfCustody, [
        poa,
        [newIpfsHashArray32[0].replace('Qm', 'Zr'), newIpfsHashArray32[1]],
        {
          from: custodian
        }
      ])
    })

    it('should transfer to NOT whitelisted addresses when whitelistTransfers=false', async () => {
      await testTransfer(poa, custodian, 1e17, {
        from: whitelistedPoaBuyers[0]
      })
    })

    it('should approve', async () => {
      await testApprove(poa, whitelistedPoaBuyers[1], 1e17, {
        from: whitelistedPoaBuyers[0]
      })
    })

    it('should transferFrom to NOT whitelisted address when whitelistTransfers=false', async () => {
      await testTransferFrom(poa, whitelistedPoaBuyers[0], custodian, 1e17, {
        from: whitelistedPoaBuyers[1]
      })
    })

    it('should NOT toggleWhitelistTransfers if NOT owner', async () => {
      await testWillThrow(testToggleWhitelistTransfers, [
        poa,
        { from: custodian }
      ])
    })

    it('should toggleWhitelistTransfers to true if owner', async () => {
      const whitelistTransfers = await testToggleWhitelistTransfers(poa, {
        from: owner
      })
      assert(
        whitelistTransfers,
        'transfers/transferFroms should require whitelisting now'
      )
    })

    it('should NOT transfer to NOT whitelisted address', async () => {
      await testWillThrow(testTransfer, [
        poa,
        custodian,
        1e17,
        { from: whitelistedPoaBuyers[0] }
      ])
    })

    it('should still approve when whitelistTransfers is enabled when whitelistTransfers=true', async () => {
      await testApprove(poa, whitelistedPoaBuyers[1], 1e17, {
        from: whitelistedPoaBuyers[0]
      })
    })

    it('should NOT transferFrom to NOT whitelisted address when whitelistTransfers=true', async () => {
      await testWillThrow(testTransferFrom, [
        poa,
        whitelistedPoaBuyers[0],
        custodian,
        1e17,
        { from: whitelistedPoaBuyers[1] }
      ])
    })

    it('should transfer to whitelisted addresses when whitelistTransfers=true', async () => {
      await testTransfer(poa, whitelistedPoaBuyers[1], 1e17, {
        from: whitelistedPoaBuyers[0]
      })
    })

    it('should transferFrom to whitelisted address when whitelistTransfers=true', async () => {
      await testTransferFrom(
        poa,
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
      await testTerminate(poa, { from: custodian })
    })
  })
})
