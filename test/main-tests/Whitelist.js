const Whitelist = artifacts.require('./Whitelist.sol')

const { testWillThrow } = require('../helpers/general')

describe('when deployed', () => {
  contract('Whitelist', accounts => {
    const ownerAddress = accounts[0]
    const investor1Address = accounts[1]
    let wht

    before('setup contract and relevant accounts', async () => {
      wht = await Whitelist.new()
    })

    it('should have the owner set to contract creator', async () => {
      const contractOwnerAddress = await wht.owner()
      assert.equal(
        contractOwnerAddress,
        ownerAddress,
        'the owner should match the address the contract was deployed from'
      )
    })

    it('should whitelist an address', async () => {
      const preInvestor1Status = await wht.whitelisted(investor1Address)
      assert(!preInvestor1Status, 'the investor status should start as false')
      await wht.addAddress(investor1Address)
      const postInvestor1Status = await wht.whitelisted(investor1Address)
      assert(
        postInvestor1Status,
        'the investor status should be changed to true'
      )
    })

    it('should not whitelist an already whitelisted address', async () => {
      await testWillThrow(wht.addAddress, [
        investor1Address,
        { from: ownerAddress }
      ])
    })

    it('should de-whitelist and address', async () => {
      const preInvestor1Status = await wht.whitelisted(investor1Address)
      assert(preInvestor1Status, 'the investor status should be true')
      await wht.removeAddress(investor1Address)
      const postInvestor1Status = await wht.whitelisted(investor1Address)
      assert(
        !postInvestor1Status,
        'the investor status should be changed to false'
      )
    })

    it('should not de-whitelist an already de-whitelisted address', async () => {
      await testWillThrow(wht.removeAddress, [
        investor1Address,
        { from: ownerAddress }
      ])
    })

    it('should NOT whitelist as NOT owner', async () => {
      await testWillThrow(wht.addAddress, [
        investor1Address,
        { from: investor1Address }
      ])
    })

    it('should NOT de-whitelist as NOT owner', async () => {
      await testWillThrow(wht.removeAddress, [
        investor1Address,
        { from: investor1Address }
      ])
    })
  })
})
