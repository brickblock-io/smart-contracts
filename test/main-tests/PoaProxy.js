const assert = require('assert')
const PoaProxy = artifacts.require('PoaProxy')
const PoaToken = artifacts.require('PoaToken')
const UpgradedPoa = artifacts.require('UpgradedPoa')
const { testWillThrow } = require('../helpers/general')
const {
  checkPreSetupStorage,
  setupContract,
  checkPostSetupStorage,
  enterActiveStage,
  checkPostActiveStorage,
  checkPostIsUpgradedStorage
} = require('../helpers/pxy')
const {
  testApprove,
  whitelistedPoaBuyers,
  setupPoaAndEcosystem
} = require('../helpers/poa')

describe('when using PoaProxy contract to proxy a PoaToken', () => {
  contract('PoaProxy/PoaToken', accounts => {
    let poam
    let upoam
    let pxy
    let poa
    let reg
    let fmr

    before('setup contracts', async () => {
      // this sets PoaManager contract as owner in registry... storage will reflect that
      const contracts = await setupPoaAndEcosystem()
      reg = contracts.reg
      fmr = contracts.fmr
      poam = await PoaToken.new()
      upoam = await UpgradedPoa.new()
      pxy = await PoaProxy.new(poam.address, reg.address)
      poa = await PoaToken.at(pxy.address)
      assert.equal(
        poa.address,
        pxy.address,
        'poa and pxy should have the same address'
      )
    })

    it('should have no storage sequential storage', async () => {
      await checkPreSetupStorage(poa)
    })

    it('should setupContract', async () => {
      await setupContract(poa, reg)
    })

    it('should have new storage after poa.setupContract', async () => {
      await checkPostSetupStorage(poa, reg)
    })

    it('should move to active poa stage', async () => {
      await enterActiveStage(poa, fmr)
    })

    it('should approve', async () => {
      await testApprove(poa, whitelistedPoaBuyers[1], 3e18, {
        from: whitelistedPoaBuyers[0]
      })
    })

    it('should have correct storage after entering active', async () => {
      await checkPostActiveStorage(poa, reg)
    })

    it('should NOT upgrade to new master if NOT PoaManager (accounts[0] for test)', async () => {
      await testWillThrow(pxy.proxyChangeMaster, [
        upoam.address,
        { from: accounts[1] }
      ])
    })

    it('should upgrade to new master with additional functionality and storage', async () => {
      const preMaster = await pxy.proxyMasterContract()

      await pxy.proxyChangeMaster(upoam.address)

      const postMaster = await pxy.proxyMasterContract()

      assert.equal(
        preMaster,
        poam.address,
        'old master should be equal to poam.address'
      )
      assert.equal(
        postMaster,
        upoam.address,
        'new master should be equal to upoam.address'
      )
    })

    it('should have the same storage as before', async () => {
      await checkPostActiveStorage(poa, reg)
      poa = UpgradedPoa.at(pxy.address)
    })

    it('should use added functionality to change isUpgraded', async () => {
      const preIsUpgraded = await poa.isUpgraded()

      await poa.setUpgrade()

      const postIsUpgraded = await poa.isUpgraded()

      assert(!preIsUpgraded, 'preIsUpgraded should be false')
      assert(postIsUpgraded, 'postIsUpgraded should be true')
    })

    it('should have new storage for new bool isUpgraded after being set', async () => {
      await checkPostIsUpgradedStorage(poa, reg)
    })
  })
})
