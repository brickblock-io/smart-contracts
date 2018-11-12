const assert = require('assert')
const PoaProxy = artifacts.require('PoaProxy')
const PoaToken = artifacts.require('PoaToken')
const PoaCrowdsale = artifacts.require('PoaCrowdsale')
const IPoaTokenCrowdsale = artifacts.require('IPoaTokenCrowdsale')
const UpgradedPoa = artifacts.require('UpgradedPoa')

const { testWillThrow } = require('../helpers/general')
const {
  checkPreInitializedStorage,
  initializeContract,
  checkPostInitializedStorage,
  enterActiveStage,
  checkPostActiveStorage,
  checkPostIsUpgradedStorage,
} = require('../helpers/pxy')
const {
  testApprove,
  whitelistedPoaBuyers,
  setupEcosystem,
  testSetCurrencyRate,
  defaultFiatCurrency,
  defaultFiatRate,
  defaultFiatRatePenalty,
  owner,
} = require('../helpers/poa')

describe('when using PoaProxy contract to proxy a PoaToken', () => {
  contract('PoaProxy/PoaToken', accounts => {
    let poatm
    let poacm
    let upoam
    let pxy
    let poa
    let reg
    let fmr
    let pmr

    before('setup contracts', async () => {
      // this sets PoaManager contract as owner in registry... storage will reflect that
      const contracts = await setupEcosystem()
      reg = contracts.reg
      fmr = contracts.fmr
      pmr = contracts.pmr
      const { exr, exp } = contracts
      poatm = await PoaToken.new()
      poacm = await PoaCrowdsale.new()
      upoam = await UpgradedPoa.new()
      pxy = await PoaProxy.new(poatm.address, poacm.address, reg.address)
      poa = await IPoaTokenCrowdsale.at(pxy.address)

      // set registry entries for ease of testing addresses
      await reg.updateContractAddress('PoaTokenMaster', poatm.address)
      await reg.updateContractAddress('PoaCrowdsaleMaster', poacm.address)

      // setup currency so that initialization will pass
      await testSetCurrencyRate(
        exr,
        exp,
        defaultFiatCurrency,
        defaultFiatRate,
        defaultFiatRatePenalty,
        {
          from: owner,
          value: 1e18,
        }
      )

      assert.equal(
        poa.address,
        pxy.address,
        'poa and pxy should have the same address'
      )
    })

    it('should have proxy addresses in storage before initialization', async () => {
      await checkPreInitializedStorage(poa, reg)
    })

    it('should initializeContract', async () => {
      await initializeContract(poa, reg)
    })

    it('should have new storage after initializing token and crowdsale', async () => {
      await checkPostInitializedStorage(poa, reg, pmr)
    })

    it('should move to active poa stage', async () => {
      await enterActiveStage(poa, fmr)
    })

    it('should approve', async () => {
      await testApprove(poa, whitelistedPoaBuyers[1], 3e18, {
        from: whitelistedPoaBuyers[0],
      })
    })

    it('should have correct storage after entering active', async () => {
      await checkPostActiveStorage(poa, reg, pmr)
    })

    it('should NOT upgrade to new master if NOT PoaManager (accounts[0] for test)', async () => {
      await testWillThrow(pxy.proxyChangeTokenMaster, [
        upoam.address,
        { from: accounts[1] },
      ])
    })

    it('should upgrade to new master with additional functionality and storage', async () => {
      const preTokenMaster = await pxy.poaTokenMaster()

      // first must update the contract registry
      await reg.updateContractAddress('PoaTokenMaster', upoam.address)
      // then can upgrade the proxy
      await pmr.upgradeToken(pxy.address)

      const postTokenMaster = await pxy.poaTokenMaster()

      assert.equal(
        preTokenMaster,
        poatm.address,
        'old master should be equal to poatm.address'
      )
      assert.equal(
        postTokenMaster,
        upoam.address,
        'new master should be equal to upoam.address'
      )
    })

    it('should have the same storage as before', async () => {
      await checkPostActiveStorage(poa, reg, pmr)
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
      await checkPostIsUpgradedStorage(poa, reg, pmr)
    })
  })
})
