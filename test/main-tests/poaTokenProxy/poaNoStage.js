const {
  custodian,
  setupPoaProxyAndEcosystem,
  testCalculateFee,
  testChangeCustodianAddress,
  testFallback,
  testFiatCentsToWei,
  testWeiToFiatCents,
  whitelistedEthInvestors,
} = require('../../helpers/poa')
const { testWillThrow } = require('../../helpers/general.js')
const BigNumber = require('bignumber.js')

describe('when testing stage independent functions', () => {
  contract('PoaTokenProxy', () => {
    let poa

    before('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa
    })

    it('should use weiToFiatCents to return correct value', async () => {
      await testWeiToFiatCents(poa, new BigNumber('1e18'))
    })

    it('should use fiatCentsToWei to return correct value', async () => {
      await testFiatCentsToWei(poa, new BigNumber('3e4'))
    })

    it('should calculate correct fee', async () => {
      await testCalculateFee(poa, new BigNumber('1e18'))
    })

    it('should NOT changeCustodianAddress when NOT custodian', async () => {
      await testWillThrow(testChangeCustodianAddress, [
        poa,
        whitelistedEthInvestors[1],
        { from: whitelistedEthInvestors[2] },
      ])
    })

    it('should change changeCustodianAddress', async () => {
      await testChangeCustodianAddress(poa, whitelistedEthInvestors[2], {
        from: custodian,
      })
    })

    it('should NOT allow payable fallback to run', async () => {
      await testFallback({
        from: whitelistedEthInvestors[0],
        value: 3e17,
        to: poa.address,
      })
    })
  })
})
