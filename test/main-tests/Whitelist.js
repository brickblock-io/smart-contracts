// Utils
const { testWillThrow } = require('../helpers/general')
const { addAddress, removeAddress } = require('../helpers/whitelist')

// contract under test
const Whitelist = artifacts.require('./Whitelist.sol')

describe('when deployed', () => {
  contract('Whitelist', accounts => {
    const [ownerAddress, addressToWhitelist, anyAddress] = accounts

    let whitelistContract
    before('setup contract', async () => {
      whitelistContract = await Whitelist.new({ from: ownerAddress })
    })

    describe('initial state', () => {
      it('should start with owner set as contract creator', async () => {
        assert.equal(
          await whitelistContract.owner(),
          ownerAddress,
          'should be the contract creator'
        )

        assert.equal(
          await whitelistContract.owner({ from: anyAddress }),
          ownerAddress,
          'should be public state'
        )
      })

      it('should start unpaused', async () => {
        assert.equal(await whitelistContract.paused(), false, 'should be false')

        assert.equal(
          await whitelistContract.paused({ from: anyAddress }),
          false,
          'should be public state'
        )
      })
    })

    describe('when contract is unpaused', () => {
      describe('when ownerAddress is sending transactions', () => {
        it('should add an address', async () => {
          await addAddress({
            addressToWhitelist,
            ownerAddress,
            whitelistContract,
          })
        })

        it('should not add an already whitelisted address', async () => {
          assert.equal(
            await whitelistContract.whitelisted(addressToWhitelist),
            true,
            'address should be whitelisted'
          )

          await testWillThrow(whitelistContract.addAddress, [
            addressToWhitelist,
            { from: ownerAddress },
          ])
        })

        it('should allow anyone to see whitelisted status of an address', async () => {
          assert.equal(
            await whitelistContract.whitelisted(addressToWhitelist, {
              from: anyAddress,
            }),
            true,
            'should be public state'
          )
        })

        it('should remove an address', async () => {
          await removeAddress({
            addressToWhitelist,
            ownerAddress,
            whitelistContract,
          })
        })

        it('should not remove an already non-whitelisted address', async () => {
          await testWillThrow(whitelistContract.removeAddress, [
            addressToWhitelist,
            { from: ownerAddress },
          ])
        })

        it('should allow anyone to see non-whitelisted status of an address', async () => {
          assert.equal(
            await whitelistContract.whitelisted(addressToWhitelist, {
              from: anyAddress,
            }),
            false,
            'should be public state'
          )
        })
      })

      describe('when a non-owner address is sending transactions', () => {
        it('should fail to add an address', async () => {
          await testWillThrow(whitelistContract.addAddress, [
            addressToWhitelist,
            { from: anyAddress },
          ])
        })

        it('should fail to remove an address', async () => {
          await testWillThrow(whitelistContract.removeAddress, [
            addressToWhitelist,
            { from: anyAddress },
          ])
        })
      })
    })

    describe('when contract is paused', () => {
      before(async () => {
        await whitelistContract.pause({ from: ownerAddress })

        assert.equal(await whitelistContract.paused(), true, 'should be true')

        assert.equal(
          await whitelistContract.paused({ from: anyAddress }),
          true,
          'should be public state'
        )
      })

      it('should add an address', async () => {
        await addAddress({
          addressToWhitelist,
          ownerAddress,
          whitelistContract,
          isPaused: true,
        })
      })

      it('should return false for a whitelisted address', async () => {
        assert.equal(
          await whitelistContract.whitelisted(addressToWhitelist),
          false,
          'always returns false when paused'
        )
      })

      it('should remove an address', async () => {
        await removeAddress({
          addressToWhitelist,
          ownerAddress,
          whitelistContract,
          isPaused: true,
        })
      })

      it('should return false for a non-whitelisted address', async () => {
        assert.equal(
          await whitelistContract.whitelisted(addressToWhitelist),
          false,
          'always returns false when paused'
        )
      })
    })
  })
})
