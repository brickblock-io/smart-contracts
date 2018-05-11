const {
  custodian,
  whitelistedPoaBuyers,
  setupPoaAndEcosystem,
  testWeiToFiatCents,
  testFiatCentsToWei,
  testWeiToTokens,
  testCalculateFee,
  testFallback,
  testChangeCustodianAddress
} = require('../../helpers/poac')
const { testWillThrow } = require('../../helpers/general.js')
const BigNumber = require('bignumber.js')

describe('when testing stage independent functions', () => {
  contract('PoaTokenConcept', () => {
    let poac

    before('setup contracts', async () => {
      const contracts = await setupPoaAndEcosystem()
      poac = contracts.poac
    })

    it('should use weiToFiatCents to return correct value', async () => {
      await testWeiToFiatCents(poac, new BigNumber('1e18'))
    })

    it('should use fiatCentsToWei to return correct value', async () => {
      await testFiatCentsToWei(poac, new BigNumber('3e4'))
    })

    it('should use weiToTokens to calculate correct value', async () => {
      await testWeiToTokens(poac, new BigNumber('1e18'))
    })

    it('should calculate correct fee', async () => {
      await testCalculateFee(poac, new BigNumber('1e18'))
    })

    it('should NOT changeCustodianAddress when NOT custodian', async () => {
      await testWillThrow(testChangeCustodianAddress, [
        poac,
        whitelistedPoaBuyers[1],
        { from: whitelistedPoaBuyers[2] }
      ])
    })

    it('should change changeCustodianAddress', async () => {
      await testChangeCustodianAddress(poac, whitelistedPoaBuyers[2], {
        from: custodian
      })
    })

    it('should NOT allow payable fallback to run', async () => {
      await testFallback({
        from: whitelistedPoaBuyers[0],
        value: 3e17,
        to: poac.address
      })
    })
  })
})
