const ContractRegistry = artifacts.require('ContractRegistry')
const RemoteContractStub = artifacts.require('stubs/RemoteContractStub')
const BrokenRemoteContractStub = artifacts.require(
  'stubs/BrokenRemoteContractStub'
)
const RemoteContractUserStub = artifacts.require('stubs/RemoteContractUserStub')
const { testWillThrow } = require('../helpers/general')

const assert = require('assert')
const BigNumber = require('bignumber.js')

describe('when using the contract registry', () => {
  contract('ContractRegistry', accounts => {
    const initialTestNumber = new BigNumber(123)
    const notOwner = accounts[1]
    const contractNameInRegistry = 'TestName'
    let reg
    let brokenGrc
    let fixedGrc
    let grcu

    before('setup Registry', async () => {
      reg = await ContractRegistry.new()
      brokenGrc = await BrokenRemoteContractStub.new(initialTestNumber)
      grcu = await RemoteContractUserStub.new(reg.address)
    })

    it('should error when no address for string key', async () => {
      await testWillThrow(reg.getContractAddress, [contractNameInRegistry])
    })

    it('should NOT set an address if NOT owner', async () => {
      await testWillThrow(reg.updateContractAddress, [
        contractNameInRegistry,
        brokenGrc.address,
        { from: notOwner }
      ])
    })

    it('should set an address', async () => {
      await reg.updateContractAddress(contractNameInRegistry, brokenGrc.address)
      const postValue = await reg.getContractAddress(contractNameInRegistry)
      assert.equal(
        postValue,
        brokenGrc.address,
        'the address should be set to the grc address'
      )
    })

    describe('when using the remote contract through the registry', () => {
      it('should get the testNumber from remote contract', async () => {
        const testNumber = await grcu.remoteTestNumber()

        assert.equal(testNumber.toString(), initialTestNumber.toString())
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
        assert.equal(newNumber.toString(), postNumber.toString())
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
        fixedGrc = await RemoteContractStub.new(initialTestNumber)
        await reg.updateContractAddress(
          contractNameInRegistry,
          fixedGrc.address
        )
        const updatedAddress = await reg.getContractAddress(
          contractNameInRegistry
        )

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

      it('should not allow updating with the same address', async () => {
        await testWillThrow(reg.updateContractAddress, [
          contractNameInRegistry,
          fixedGrc.address
        ])
      })

      it('should not allow updating when the address is not a contract', async () => {
        await testWillThrow(reg.updateContractAddress, [
          contractNameInRegistry,
          '0x00000000000000000000000000000000'
        ])
      })
    })
  })
})
