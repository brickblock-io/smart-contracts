const {
  testPreFundingToFundingEvent,
  testBuyTokensEvents,
  testBuyRemainingTokensEvents,
  testActivateEvents,
  testPayoutEvents,
  testClaimEvents,
  testTerminateEvents,
  testChangeCustodianEvents,
  testReclaimEvents
} = require('../helpers/log')
const { setupPoaProxyAndEcosystem } = require('../helpers/poa')

describe('when using Brickblock logger to log PoaToken events', () => {
  contract('PoaLogger', () => {
    let poa
    let log
    let pmr
    let reg
    let fmr
    before('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa
      log = contracts.log
      pmr = contracts.pmr
      reg = contracts.reg
      fmr = contracts.fmr

      await pmr.listToken(poa.address)
    })

    it('should log stage events', async () => {
      await testPreFundingToFundingEvent(poa, reg, pmr, log)
    })

    it('should log buy events', async () => {
      await testBuyTokensEvents(poa, reg, pmr, log)
      await testBuyRemainingTokensEvents(poa, reg, pmr, log)
    })

    it('should log proof of custody updated events', async () => {
      await testActivateEvents(poa, reg, pmr, fmr, log)
    })

    it('should log payout events', async () => {
      await testPayoutEvents(poa, reg, pmr, fmr, log)
    })

    it('should log claim events', async () => {
      await testClaimEvents(poa, reg, pmr, log)
    })

    it('should log terminated events', async () => {
      await testTerminateEvents(poa, reg, pmr, log)
    })

    it('should log custodian changed events', async () => {
      await testChangeCustodianEvents(poa, reg, pmr, log)
    })

    it('should log reclaim events', async () => {
      await testReclaimEvents()
    })
  })
})
