const BigNumber = require('bignumber.js')
const leftPad = require('left-pad')

const BrickblockWhitelist = artifacts.require('./BrickblockWhitelist.sol')

describe('when deployed', () => {
  contract('BrickblockWhitelist', accounts => {
    const ownerAddress = accounts[0]
    const investor1Address = accounts[1]
    const investor2Address = accounts[2]
    let whitelist

    before('setup contract and relevant accounts', async () => {
      whitelist = await BrickblockWhitelist.deployed()
    })

    it('should have the owner set to contract creator', async () => {
      const contractOwnerAddress = await whitelist.owner()
      assert.equal(
        contractOwnerAddress,
        ownerAddress,
        'the owner should match the address the contract was deployed from'
      )
    })

    it('should whitelist an address', async () => {
      const preInvestor1Status = await whitelist.whitelisted(investor1Address)
      assert(!preInvestor1Status, 'the investor status should start as false')
      await whitelist.addAddress(investor1Address)
      const postInvestor1Status = await whitelist.whitelisted(investor1Address)
      assert(
        postInvestor1Status,
        'the investor status should be changed to true'
      )
    })

    it('should not whitelist an already whitelisted address', async () => {
      try {
        await whitelist.addAddress(investor1Address)
        assert(false, 'the contract should throw')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'error message should contain invalid opcode'
        )
      }
    })

    it('should de-whitelist and address', async () => {
      const preInvestor1Status = await whitelist.whitelisted(investor1Address)
      assert(preInvestor1Status, 'the investor status should be true')
      await whitelist.removeAddress(investor1Address)
      const postInvestor1Status = await whitelist.whitelisted(investor1Address)
      assert(
        !postInvestor1Status,
        'the investor status should be changed to false'
      )
    })

    it('should not de-whitelist an already de-whitelisted address', async () => {
      try {
        await whitelist.removeAddress(investor1Address)
        assert(false, 'the contract should throw')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'error message should contain invalid opcode'
        )
      }
    })
  })
})
