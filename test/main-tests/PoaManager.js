const PoaManager = artifacts.require('PoaManager.sol')
const {
  checkForEvent,
  setupRegistry,
  testWillThrow
} = require('../helpers/general')

describe('when creating a new instance of the contract', () => {
  contract('PoaManager', accounts => {
    let pmr
    const owner = accounts[0]

    before('setup PoaManager', async () => {
      const { registry } = await setupRegistry()
      pmr = await PoaManager.new(registry.address)
    })

    it('should set the owner as msg.sender on creation', async () => {
      const newOwner = await pmr.owner()
      assert.equal(
        newOwner,
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
        assert.ok(actual === expected, 'addedBroker starts activated')
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
          await pmr.deactivateBroker(addedBroker)
        )
      })

      it('should set active value to false', async () => {
        const actual = await pmr.getStatus(addedBroker)
        const expected = false
        assert.ok(
          actual === expected,
          'deactivated broker has active value set to false'
        )
      })

      it('should error when trying to deactivate a broker address that is already deactivated', async () => {
        await testWillThrow(pmr.deactivateBroker, [addedBroker])
      })

      it('should error when trying to deactivate a broker from notOwner address', async () => {
        await testWillThrow(pmr.deactivateBroker, [
          addedBroker,
          { from: notOwner }
        ])
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
          await pmr.activateBroker(addedBroker)
        )
      })

      it('should set active value to true', async () => {
        const actual = await pmr.getStatus(addedBroker)
        const expected = true
        assert.ok(
          actual === expected,
          'activated broker has active value set to true'
        )
      })

      it('should error when trying to activate a broker address that is already activated', async () => {
        await testWillThrow(pmr.activateBroker, [addedBroker])
      })

      it('should error when trying to activate a broker from notOwner address', async () => {
        await testWillThrow(pmr.activateBroker, [
          addedBroker,
          { from: notOwner }
        ])
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
    const activatedBroker = accounts[1]
    const deactivatedBroker = accounts[2]
    const custodian = accounts[5]
    const notBroker = accounts[8]
    const notOwner = accounts[9]

    before('setup contract state', async () => {
      const { registry } = await setupRegistry()
      pmr = await PoaManager.new(registry.address)
      await pmr.addBroker(activatedBroker)
      await pmr.addBroker(deactivatedBroker)
      await pmr.deactivateBroker(deactivatedBroker)
    })

    it('should be created with an empty tokenAddressList', async () => {
      const actual = await pmr.getTokenAddressList()
      const expected = []
      assert.deepEqual(actual, expected, 'list should be empty')
    })

    describe('when adding a token', () => {
      it('should emit TokenAdded', async () => {
        const txReceipt = await pmr.addToken(
          'test',
          'TST',
          custodian,
          1000,
          1e18,
          {
            from: activatedBroker
          }
        )

        // setting this here for use in following tests in this contract block
        //
        // Note: this is not ideal since we read from the event before calling `checkForEvent`
        addedToken = txReceipt.logs[0].args.token

        checkForEvent('TokenAdded', { token: addedToken }, txReceipt)
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

      it('should set active value to true', async () => {
        const actual = await pmr.getStatus(addedToken)
        const expected = true
        assert.equal(actual, expected, 'added token starts activated')
      })

      it('should allow for many tokens to be added', async () => {
        const txReceipt = await pmr.addToken(
          'test-another',
          'ANT',
          custodian,
          1000,
          1e18,
          {
            from: activatedBroker
          }
        )

        // setting this here for use in following tests in this contract block
        anotherToken = txReceipt.logs[0].args.token

        const actual = (await pmr.getTokenAddressList()).length
        const expected = 2
        assert.equal(
          actual,
          expected,
          'tokenAddressList should contain all added tokens'
        )
      })

      it('should error when trying to add a token from a deactivated broker address', async () => {
        await testWillThrow(pmr.addToken, [
          'test-another',
          'ANT',
          custodian,
          1000,
          1e18,
          {
            from: deactivatedBroker
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

    describe('when deactivating a token', () => {
      it('should emit TokenStatusChanged', async () => {
        checkForEvent(
          'TokenStatusChanged',
          { token: addedToken, active: false },
          await pmr.deactivateToken(addedToken)
        )
      })

      it('should set active value to false', async () => {
        const actual = await pmr.getStatus(addedToken)
        const expected = false
        assert.equal(
          actual,
          expected,
          'deactivated token has active value set to false'
        )
      })

      it('should error when trying to deactivate a token address that is already deactivated', async () => {
        await testWillThrow(pmr.deactivateToken, [addedToken])
      })

      it('should error when trying to deactivate a token from notOwner address', async () => {
        await testWillThrow(pmr.deactivateToken, [
          addedToken,
          { from: notOwner }
        ])
      })
    })

    describe('when activating a token', () => {
      it('should emit TokenStatusChanged', async () => {
        checkForEvent(
          'TokenStatusChanged',
          { token: addedToken, active: true },
          await pmr.activateToken(addedToken)
        )
      })

      it('should set active value to true', async () => {
        const actual = await pmr.getStatus(addedToken)
        const expected = true
        assert.equal(
          actual,
          expected,
          'deactivated token has active value set to true'
        )
      })

      it('should error when trying to activate a token address that is already activated', async () => {
        await testWillThrow(pmr.activateToken, [addedToken])
      })

      it('should error when trying to activate a token from notOwner address', async () => {
        await testWillThrow(pmr.activateToken, [addedToken, { from: notOwner }])
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
