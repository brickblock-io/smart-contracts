const PoaToken = artifacts.require('PoaToken')
const BigNumber = require('bignumber.js')
const {
  owner,
  broker,
  setupPoaProxyAndEcosystem,
  testProxyUnchanged
} = require('../../helpers/poa')
const { addToken } = require('../../helpers/pmr')

describe('when using PoaToken as a master for proxies', () => {
  contract('PoaToken proxy/master', () => {
    let poam
    let pmr
    let reg

    beforeEach('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poam = contracts.poam
      pmr = contracts.pmr
      reg = contracts.reg
    })

    it('should not affect proxy storage when master is changed', async () => {
      const newToken = await addToken(pmr, { from: broker })
      // wrap proxy in PoaToken definition
      const poa = await PoaToken.at(newToken.tokenAddress)
      // collect data on current proxy state
      const state = await testProxyUnchanged(poa, true, null)
      // need the stub in order to set this up...
      await poam.setupContract(
        'MASTER',
        'MST',
        'EUR',
        owner,
        owner,
        reg.address,
        new BigNumber(1e18),
        // 100 ish years in the future
        new BigNumber(Date.now()).div(1000).add(60 * 60 * 24 * 30 * 12 * 100),
        // 100 year funding timeout
        new BigNumber(Date.now()).div(1000).add(60 * 60 * 24 * 30 * 12 * 100),
        // 100 year activation timeout
        new BigNumber(Date.now()).div(1000).add(60 * 60 * 24 * 30 * 12 * 100),
        new BigNumber(1)
      )
      // compare previous state to current state
      await testProxyUnchanged(poa, false, state)
    })
  })
})
