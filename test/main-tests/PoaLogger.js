const {
  testPreviewToPreFundingEvent,
  testPreFundingToFiatFundingEvent,
  testFiatFundingToEthFundingEvent,
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

describe('when using PoaLogger to log PoaToken events', () => {
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

    it('should log transitition from Preview to PreFunding stage', async () => {
      await testPreviewToPreFundingEvent(poa, reg, pmr, log)
    })

    it('should log transitition from PreFunding to FiatFunding stage', async () => {
      await testPreFundingToFiatFundingEvent(poa, reg, pmr, log)
    })

    it('should log transitition from FiatFunding to EthFunding stage', async () => {
      await testFiatFundingToEthFundingEvent(poa, reg, pmr, log)
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
