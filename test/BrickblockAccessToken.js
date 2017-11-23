const BrickblockAccessToken = artifacts.require('BrickblockAccessToken.sol')
const BrickblockFountainStub = artifacts.require('BrickblockFountainStub.sol')
const BrickblockFountain = artifacts.require('BrickblockFountain.sol')
const BigNumber = require('bignumber.js')

describe('after the contract is created', () => {
  contract('BrickblockAccessToken', accounts => {
    let act
    const owner = accounts[0]

    before('setup BrickblockAccessToken', async () => {
      act = await BrickblockAccessToken.deployed()
    })

    it('should set the owner as msg.sender on creation', async () => {
      const newOwner = await act.owner()
      assert.equal(newOwner, owner)
    })

    it('should start with a total supply of 0', async () => {
      const totalSupply = await act.totalSupply()
      assert.equal(totalSupply.toNumber(), 0, 'the total supply should be 0')
    })

    it('should have 18 decimals set', async () => {
      const decimals = await act.decimals()
      assert.equal(decimals.toNumber(), 18, 'the decimals should be 18')
    })
  })
})

describe('when changing the fountain address', () => {
  contract('BrickblockAccessToken', accounts => {
    let act
    const owner = accounts[0]
    let fountain
    let altFountain

    before('setup BrickblockAccessToken', async () => {
      act = await BrickblockAccessToken.deployed()
      fountain = await BrickblockFountain.deployed()
      altFountain = await BrickblockFountainStub.new()
    })

    it('should start with the accompanied migration address of fountain', async () => {
      const savedFountain = await act.fountainAddress()
      assert.equal(
        savedFountain,
        fountain.address,
        'the fountain should be set to the deployed fountain by migrations'
      )
    })

    it('should NOT set the fountain if the address is the same', async () => {
      try {
        await act.changeFountainAddress(fountain.address)
        assert(
          false,
          'the contract should throw when changing fountain when NOT owner'
        )
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'message should contain invalid opcode'
        )
      }
    })

    it('should NOT set the fountain when NOT owner', async () => {
      try {
        await act.changeFountainAddress.sendTransaction(altFountain.address, {
          from: accounts[1]
        })
        assert(
          false,
          'the contract should throw when changing fountain when NOT owner'
        )
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'message should contain invalid opcode'
        )
      }
    })

    it('should NOT set the fountain when NOT a contract', async () => {
      try {
        await act.changeFountainAddress(accounts[2])
        assert(
          false,
          'the contract should throw when changing fountain when NOT a contract'
        )
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'message should contain invalid opcode'
        )
      }
    })

    it('should NOT set the fountain when address is the same as self', async () => {
      try {
        await act.changeFountainAddress(act.address)
        assert(
          false,
          'the contract should throw when changing fountain to address same as self'
        )
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'message should contain invalid opcode'
        )
      }
    })

    it('should NOT set the fountain when address is the same as owner', async () => {
      try {
        await act.changeFountainAddress(owner)
        assert(
          false,
          'the contract should throw when changing fountain to address same as owner'
        )
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'message should contain invalid opcode'
        )
      }
    })

    it('should set the fountain when owner, fountainAddress is contract, is NOT same as this, and is NOT set to the address of the owner', async () => {
      const preFountain = await act.fountainAddress()
      assert.equal(
        preFountain,
        fountain.address,
        'the fountain should the address set in initial migrations'
      )
      await act.changeFountainAddress(altFountain.address)
      const postFountain = await act.fountainAddress()
      assert.equal(
        postFountain,
        altFountain.address,
        'the fountain addresses does NOT match that just sent'
      )
    })
  })
})

describe('when minting', () => {
  contract('BrickblockAccessToken', accounts => {
    let act
    const owner = accounts[0]
    let fountain
    let recipient = accounts[1]
    const amount = new BigNumber(1e24)

    before('setup BrickblockAccessToken', async () => {
      act = await BrickblockAccessToken.deployed()
      fountain = await BrickblockFountainStub.new()
      await act.changeFountainAddress(fountain.address)
      await fountain.changeAccessTokenAddress(act.address)
    })

    it('should mint when owner', async () => {
      const preBalance = await act.balanceOf(recipient)
      await act.mint(recipient, amount)
      const postBalance = await act.balanceOf(recipient)
      assert.equal(
        postBalance.minus(preBalance).toString(),
        amount.toString(),
        'the balance should be incremented by amount'
      )
    })

    it('should mint when fountain', async () => {
      const preBalance = await act.balanceOf(recipient)
      await fountain.simulateFountainMint(recipient, amount)
      const postBalance = await act.balanceOf(recipient)
      assert.equal(
        postBalance.minus(preBalance).toString(),
        amount.toString(),
        'the balance should be incremented by amount'
      )
    })

    it('should NOT mint when not fountain or owner', async () => {
      try {
        await act.mint.sendTransaction(accounts[3], amount, {
          from: accounts[3]
        })
        assert(
          false,
          'the contract should throw when trying to mint from NOT owner or fountain'
        )
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'invalid opcode should be in the error'
        )
      }
    })
  })
})
