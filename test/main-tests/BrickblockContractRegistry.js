const BrickblockContractRegistry = artifacts.require('BrickblockContractRegistry')
const GenericRemoteContract = artifacts.require('GenericRemoteContract')
const BrokenGenericRemoteContract = artifacts.require('BrokenGenericRemoteContract')
const GenericRemoteContractUser = artifacts.require('GenericRemoteContractUser')
const assert = require('assert')
const BigNumber = require('bignumber.js')

describe('when using the contract registry', () => {
  contract('BrickblockContractRegistry', accounts => {
    const owner = accounts[0]
    const notOwner = accounts[1]
    const initialTestNumber = new BigNumber(123)
    let bbr
    let brokenGrc
    let fixedGrc
    let grcu

    before('setup bbr', async () => {
      bbr = await BrickblockContractRegistry.new()
      brokenGrc = await BrokenGenericRemoteContract.new(
        initialTestNumber
      )
      grcu = await GenericRemoteContractUser.new(bbr.address)
    })

    it('should set an address', async () => {
      const preValue = await bbr.getContractAddress('testName')
      assert.equal(
        preValue,
        '0x' + '0'.repeat(40),
        'the uninitialized value should be address(0)'
      )
      await bbr.updateContract('testName', brokenGrc.address)
      const postValue = await bbr.getContractAddress('testName')
      assert.equal(
        postValue,
        brokenGrc.address,
        'the address should be set to the grc address'
      )
    })

    describe('when using the remote contract through the registry', () => {
      it('should get the testNumber from remote contract', async () => {
        const testNumber = await grcu.remoteTestNumber()

        assert.equal(
          testNumber.toString(),
          initialTestNumber.toString()
        )
      })

      it('should set the testNumber on remote contract', async () => {
        const newNumber = new BigNumber(321)
        const preNumber = await grcu.remoteTestNumber()

        await grcu.remoteSetNumber(newNumber)

        const postNumber = await grcu.remoteTestNumber()

        assert(
          preNumber.toString() != postNumber.toString(),
          'the number should be different'
        )
        assert.equal(
          newNumber.toString(),
          postNumber.toString()
        )
      })

      it('should return an incorrect value when adding on broken contract', async () => {
        const brokenValue = await grcu.remoteAdd(1, 1)
        assert.equal(
          brokenValue.toString(),
          new BigNumber(2).add(3).toString(),
          'the broken value should be the two numbers added plus 3'
        )
      })
    })

    describe('when updating the broken contract in the registry', () => {
      it('should change the contract address in registry', async () => {
        fixedGrc = await GenericRemoteContract.new(
          initialTestNumber
        )
        await bbr.updateContract('testName', fixedGrc.address)
        const updatedAddress = await bbr.getContractAddress('testName')

        assert.equal(
          updatedAddress,
          fixedGrc.address,
          'the updated address should match the new contract address'
        )
      })

      it('should now return the correct value', async () => {
        const value = await grcu.remoteAdd(1, 1)
        assert.equal(
          value.toString(),
          new BigNumber(2).toString(),
          'the value should match the expected value'
        )
      })
    })
  })
})
