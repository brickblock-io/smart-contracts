const PoaManager = artifacts.require('PoaManager.sol')
const PoaToken = artifacts.require('PoaToken.sol')
const {
  checkForEvent,
  setupRegistry,
  testWillThrow
} = require('../helpers/general')
const { addToken } = require('../helpers/pmr')

describe('when creating a new instance of the contract', () => {
  contract('PoaManager', accounts => {
    let pmr
    const owner = accounts[0]

    before('setup contract state', async () => {
      const { registry } = await setupRegistry()
      pmr = await PoaManager.new(registry.address)
    })

    it('should set the owner as msg.sender on creation', async () => {
      assert.equal(
        await pmr.owner(),
        owner,
        'owner will be the address that created the contract'
      )
    })
  })
})

describe('when calling broker functions', () => {
  contract('PoaManager', accounts => {
    let pmr
    const addedBroker = accounts[1]
    const anotherBroker = accounts[2]
    const notOwner = accounts[9]

    before('setup contract state', async () => {
      const { registry } = await setupRegistry()
      pmr = await PoaManager.new(registry.address)
    })

    it('should be created with an empty brokerAddressList', async () => {
      const actual = await pmr.getBrokerAddressList()
      const expected = []
      assert.deepEqual(actual, expected, 'list should be empty')
    })

    describe('when adding a broker', () => {
      it('should emit BrokerAdded', async () => {
        checkForEvent(
          'BrokerAdded',
          { broker: addedBroker },
          await pmr.addBroker(addedBroker)
        )
      })

      it('should include new broker in brokerAddressList', async () => {
        const actual = await pmr.getBrokerAddressList()
        const expected = [addedBroker]
        assert.deepEqual(
          actual,
          expected,
          'brokerAddressList should contain addedBroker'
        )
      })

      it('should set active value to true', async () => {
        const actual = await pmr.getStatus(addedBroker)
        const expected = true
        assert.equal(actual, expected, 'addedBroker starts listed')
      })

      it('should allow for many brokers to be added', async () => {
        await pmr.addBroker(anotherBroker)

        const actual = await pmr.getBrokerAddressList()
        const expected = [addedBroker, anotherBroker]
        assert.deepEqual(
          actual,
          expected,
          'brokerAddressList should contain all added brokers'
        )
      })

      it('should error when trying to add a broker that has already been added', async () => {
        await testWillThrow(pmr.addBroker, [addedBroker])
      })

      it('should error when trying to add a broker from notOwner address', async () => {
        await testWillThrow(pmr.addBroker, [addedBroker, { from: notOwner }])
      })
    })

    describe('when deactivating a broker', () => {
      it('should emit BrokerStatusChanged', async () => {
        checkForEvent(
          'BrokerStatusChanged',
          {
            broker: addedBroker,
            active: false
          },
          await pmr.delistBroker(addedBroker)
        )
      })

      it('should set active value to false', async () => {
        const actual = await pmr.getStatus(addedBroker)
        const expected = false
        assert.equal(
          actual,
          expected,
          'delisted broker has active value set to false'
        )
      })

      it('should error when trying to delist a broker address that is already delisted', async () => {
        await testWillThrow(pmr.delistBroker, [addedBroker])
      })

      it('should error when trying to delist a broker from notOwner address', async () => {
        await testWillThrow(pmr.delistBroker, [addedBroker, { from: notOwner }])
      })
    })

    describe('when activating a broker', () => {
      it('should emit BrokerStatusChanged', async () => {
        checkForEvent(
          'BrokerStatusChanged',
          {
            broker: addedBroker,
            active: true
          },
          await pmr.listBroker(addedBroker)
        )
      })

      it('should set active value to true', async () => {
        const actual = await pmr.getStatus(addedBroker)
        const expected = true
        assert.equal(
          actual,
          expected,
          'listed broker has active value set to true'
        )
      })

      it('should error when trying to list a broker address that is already listed', async () => {
        await testWillThrow(pmr.listBroker, [addedBroker])
      })

      it('should error when trying to list a broker from notOwner address', async () => {
        await testWillThrow(pmr.listBroker, [addedBroker, { from: notOwner }])
      })
    })

    describe('when removing a broker', () => {
      it('should emit BrokerRemoved', async () => {
        checkForEvent(
          'BrokerRemoved',
          { broker: addedBroker },
          await pmr.removeBroker(addedBroker)
        )
      })

      it('should remove broker from brokerAddressList', async () => {
        const actual = await pmr.getBrokerAddressList()
        const expected = [anotherBroker]
        assert.deepEqual(
          actual,
          expected,
          'brokerAddressList should not contain addedBroker'
        )
      })

      it('should error when trying to getStatus of removed broker', async () => {
        await testWillThrow(pmr.getStatus, [addedBroker])
      })

      it('should allow for many brokers to be removed', async () => {
        await pmr.removeBroker(anotherBroker)

        const actual = await pmr.getBrokerAddressList()
        const expected = []
        assert.deepEqual(
          actual,
          expected,
          'brokerAddressList should not contain removed brokers'
        )
      })

      it('should error when trying to add a broker that has already been removed', async () => {
        await testWillThrow(pmr.removeBroker, [addedBroker])
      })

      it('should error when trying to add a broker from notOwner address', async () => {
        await testWillThrow(pmr.removeBroker, [addedBroker, { from: notOwner }])
      })
    })
  })
})

describe('when calling token functions', () => {
  contract('PoaManager', accounts => {
    let pmr
    let addedToken
    let anotherToken
    const listedBroker = accounts[1]
    const delistedBroker = accounts[2]
    const custodian = accounts[5]
    const notBroker = accounts[8]
    const notOwner = accounts[9]

    before('setup contract state', async () => {
      const { registry } = await setupRegistry()
      pmr = await PoaManager.new(registry.address)
      await pmr.addBroker(listedBroker)
      await pmr.addBroker(delistedBroker)
      await pmr.delistBroker(delistedBroker)
    })

    it('should be created with an empty tokenAddressList', async () => {
      const actual = await pmr.getTokenAddressList()
      const expected = []
      assert.deepEqual(actual, expected, 'list should be empty')
    })

    describe('when adding a token', () => {
      it('should emit TokenAdded', async () => {
        const { txReceipt, tokenAddress } = await addToken(
          pmr,
          custodian,
          listedBroker
        )

        // setting this here for use in following tests in this contract block
        addedToken = tokenAddress

        checkForEvent('TokenAdded', { token: addedToken }, txReceipt)
      })

      it('should have the PoaManager as the owner', async () => {
        const poaToken = await PoaToken.at(addedToken)
        assert.equal(
          await poaToken.owner(),
          pmr.address,
          'the PoaManager will be the owner of all PoaToken'
        )
      })

      it('should include new token in tokenAddressList', async () => {
        const actual = await pmr.getTokenAddressList()
        const expected = [addedToken]

        assert.deepEqual(
          actual,
          expected,
          'tokenAddressList should contain added token'
        )
      })

      it('should set active value to false', async () => {
        const actual = await pmr.getStatus(addedToken)
        const expected = false
        assert.equal(actual, expected, 'added token starts delisted')
      })

      it('should allow for many tokens to be added', async () => {
        const { tokenAddress } = await addToken(pmr, custodian, listedBroker)

        // setting this here for use in following tests in this contract block
        anotherToken = tokenAddress

        const actual = (await pmr.getTokenAddressList()).length
        const expected = 2
        assert.equal(
          actual,
          expected,
          'tokenAddressList should contain all added tokens'
        )
      })

      it('should error when trying to add a token from a delisted broker address', async () => {
        await testWillThrow(pmr.addToken, [
          'test-another',
          'ANT',
          custodian,
          1000,
          1e18,
          {
            from: delistedBroker
          }
        ])
      })

      it('should error when trying to add a token from a non broker address', async () => {
        await testWillThrow(pmr.addToken, [
          'test-another',
          'ANT',
          custodian,
          1000,
          1e18,
          {
            from: notBroker
          }
        ])
      })
    })

    describe('when activating a token', () => {
      it('should emit TokenStatusChanged', async () => {
        checkForEvent(
          'TokenStatusChanged',
          { token: addedToken, active: true },
          await pmr.listToken(addedToken)
        )
      })

      it('should set active value to true', async () => {
        const actual = await pmr.getStatus(addedToken)
        const expected = true
        assert.equal(
          actual,
          expected,
          'delisted token has active value set to true'
        )
      })

      it('should error when trying to list a token address that is already listed', async () => {
        await testWillThrow(pmr.listToken, [addedToken])
      })

      it('should error when trying to list a token from notOwner address', async () => {
        await testWillThrow(pmr.listToken, [addedToken, { from: notOwner }])
      })
    })

    describe('when deactivating a token', () => {
      it('should emit TokenStatusChanged', async () => {
        checkForEvent(
          'TokenStatusChanged',
          { token: addedToken, active: false },
          await pmr.delistToken(addedToken)
        )
      })

      it('should set active value to false', async () => {
        const actual = await pmr.getStatus(addedToken)
        const expected = false
        assert.equal(
          actual,
          expected,
          'delisted token has active value set to false'
        )
      })

      it('should error when trying to delist a token address that is already delisted', async () => {
        await testWillThrow(pmr.delistToken, [addedToken])
      })

      it('should error when trying to delist a token from notOwner address', async () => {
        await testWillThrow(pmr.delistToken, [addedToken, { from: notOwner }])
      })
    })

    describe('when removing a token', () => {
      it('should emit TokenRemoved', async () => {
        checkForEvent(
          'TokenRemoved',
          { token: addedToken },
          await pmr.removeToken(addedToken)
        )
      })

      it('should remove token from tokenAddressList', async () => {
        const actual = await pmr.getTokenAddressList()
        const expected = [anotherToken]
        assert.deepEqual(
          actual,
          expected,
          'tokenAddressList should not contain addedToken'
        )
      })

      it('should error when trying to getStatus of removed token', async () => {
        await testWillThrow(pmr.getStatus, [addedToken])
      })

      it('should allow for many tokens to be removed', async () => {
        await pmr.removeToken(anotherToken)

        const actual = await pmr.getTokenAddressList()
        const expected = []
        assert.deepEqual(
          actual,
          expected,
          'tokenAddressList should not contain removed tokens'
        )
      })

      it('should error when trying to add a token that has already been removed', async () => {
        await testWillThrow(pmr.removeToken, [addedToken])
      })

      it('should error when trying to add a token from notOwner address', async () => {
        await testWillThrow(pmr.removeToken, [addedToken, { from: notOwner }])
      })
    })
  })
})

describe('when calling token convenience functions', () => {
  contract('PoaManager', accounts => {
    let pmr
    const owner = accounts[0]
    const notOwner = accounts[1]
    const broker = accounts[2]
    const custodian = accounts[3]
    let listedToken
    let delistedToken

    before('setup contract state', async () => {
      const { registry } = await setupRegistry()
      pmr = await PoaManager.new(registry.address, { from: owner })

      await pmr.addBroker(broker)

      const { tokenAddress: listedTokenAddress } = await addToken(
        pmr,
        custodian,
        broker
      )
      pmr.listToken(listedTokenAddress, { from: owner })
      listedToken = PoaToken.at(listedTokenAddress)

      const { tokenAddress: delistedTokenAddress } = await addToken(
        pmr,
        custodian,
        broker
      )
      delistedToken = PoaToken.at(delistedTokenAddress)
    })

    describe('when pausing a token', () => {
      it('should error when caller is notOwner', async () => {
        await testWillThrow(pmr.pauseToken, [
          listedToken.address,
          { from: notOwner }
        ])
      })

      it('should pause the listedToken', async () => {
        assert.equal(
          await listedToken.paused(),
          false,
          'token should begin unpaused'
        )

        await pmr.pauseToken(listedToken.address, { from: owner })

        assert.equal(
          await listedToken.paused(),
          true,
          'token should then become paused'
        )
      })

      it('should error when token is not listed', async () => {
        assert.equal(
          await delistedToken.paused(),
          false,
          'token should begin unpaused'
        )

        await testWillThrow(pmr.pauseToken, [delistedToken.address])
      })
    })

    describe('when unpausing a token', () => {
      it('should error when caller is notOwner', async () => {
        await testWillThrow(pmr.unpauseToken, [
          listedToken.address,
          { from: notOwner }
        ])
      })

      it('should unpause the listedToken', async () => {
        assert.equal(
          await listedToken.paused(),
          true,
          'token should begin paused'
        )

        await pmr.unpauseToken(listedToken.address, { from: owner })

        assert.equal(
          await listedToken.paused(),
          false,
          'token should then become unpaused'
        )
      })

      it('should error when token is not listed', async () => {
        await pmr.listToken(delistedToken.address)
        await pmr.pauseToken(delistedToken.address)
        await pmr.delistToken(delistedToken.address)

        assert.equal(
          await delistedToken.paused(),
          true,
          'token should begin paused'
        )

        await testWillThrow(pmr.unpauseToken, [delistedToken.address])
      })
    })
  })
})