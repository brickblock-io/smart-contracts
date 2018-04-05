const PoaManager = artifacts.require('PoaManager.sol')
const {
  structToObject,
  tupleToObject,
  setupRegistry,
  testWillThrow
} = require('../helpers/general')

const placeholderBroker = {
  address: '0x0000000000000000000000000000000000000000',
  active: false
}

const placeholderToken = {
  address: '0x0000000000000000000000000000000000000000',
  active: false
}

describe('after the contract is created', () => {
  contract('PoaManager', accounts => {
    let pmr
    const owner = accounts[0]

    before('setup PoaManager', async () => {
      const { registry } = await setupRegistry()
      pmr = await PoaManager.new(registry.address)
    })

    it('should set the owner as msg.sender on creation', async () => {
      const newOwner = await pmr.owner()
      assert.equal(newOwner, owner)
    })
  })
})

describe('when adjusting brokers', () => {
  contract('PoaManager', accounts => {
    let pmr
    const broker1 = accounts[1]
    const broker2 = accounts[2]
    const broker3 = accounts[3]

    before('setup contract state', async () => {
      const { registry } = await setupRegistry()
      pmr = await PoaManager.new(registry.address)
    })

    it('should have one placeholder broker in the brokers list', async () => {
      const brokers = await pmr.listBrokers()
      const formattedBrokers = structToObject(brokers)
      const expectedBrokers = [placeholderBroker]
      assert.deepEqual(
        formattedBrokers,
        expectedBrokers,
        'there should only be a single placeholder broker'
      )
    })

    it('should add and list brokers', async () => {
      await pmr.addBroker(broker1)
      const brokers = await pmr.listBrokers()
      const formattedBrokers = structToObject(brokers)
      const expectedBrokers = [
        placeholderBroker,
        {
          address: broker1,
          active: true
        }
      ]
      assert.deepEqual(
        formattedBrokers,
        expectedBrokers,
        'the brokers list should match the expectedBrokers'
      )
    })

    it('should get the single broker previously added', async () => {
      const broker = await pmr.getBroker(broker1)
      const formattedBroker = tupleToObject(broker)
      const expectedBroker = {
        address: broker1,
        active: true
      }
      assert.deepEqual(
        formattedBroker,
        expectedBroker,
        'the broker from getBroker should match expectedBroker'
      )
    })

    it('should add the previously added broker to brokerIndexMap', async () => {
      const brokerIndex = await pmr.brokerIndexMap(broker1)
      const broker = await pmr.getBroker(broker1)
      const formattedBroker = tupleToObject(broker)
      assert(
        brokerIndex.toNumber() > 0,
        'the first non-placeholder entry into brokers should be position 1 in array'
      )
      assert.equal(
        formattedBroker.address,
        broker1,
        'the address should match broker1 when using the index from contract'
      )
    })

    it('should add brokers in the correct order', async () => {
      await pmr.addBroker(broker2)
      const brokers = await pmr.listBrokers()
      const formattedBrokers = structToObject(brokers)
      const expectedBrokers = [
        placeholderBroker,
        {
          address: broker1,
          active: true
        },
        {
          address: broker2,
          active: true
        }
      ]
      assert.deepEqual(
        formattedBrokers,
        expectedBrokers,
        'the brokers list should match the expectedBrokers'
      )
    })

    it('should deactivate a broker when the broker is active', async () => {
      const preBroker = await pmr.getBroker(broker1)
      const preBrokerFormatted = tupleToObject(preBroker)
      assert(
        preBrokerFormatted.active,
        'the broker before the operation should be active'
      )

      await pmr.deactivateBroker(broker1)

      const postBroker = await pmr.getBroker(broker1)
      const postBrokerFormatted = tupleToObject(postBroker)
      assert.equal(
        true,
        postBrokerFormatted.active != true,
        'the broker after the operation should be inactive'
      )
    })

    it('should NOT deactivate a broker when the broker is already inactive', async () => {
      await testWillThrow(pmr.deactivateBroker, [broker1])
    })

    it('should activate a broker when the broker is inactive', async () => {
      const preBroker = await pmr.getBroker(broker1)
      const preBrokerFormatted = tupleToObject(preBroker)
      assert.equal(
        true,
        preBrokerFormatted.active === false,
        'the broker before the operation should be inactive'
      )

      await pmr.activateBroker(broker1)

      const postBroker = await pmr.getBroker(broker1)
      const postBrokerFormatted = tupleToObject(postBroker)
      assert(
        postBrokerFormatted.active,
        'the broker after the operation should be active'
      )
    })

    it('should NOT activate a broker which is already active', async () => {
      await testWillThrow(pmr.activateBroker, [broker1])
    })

    it('should get the broker status', async () => {
      const preBroker = await pmr.getBroker(broker1)
      const preBrokerFormatted = tupleToObject(preBroker)
      assert(
        preBrokerFormatted.active,
        'the broker before the operation should be inactive'
      )
      const preBrokerStatus = await pmr.brokerStatus(broker1)
      assert(
        preBrokerStatus === preBrokerFormatted.active,
        'the statuses should be the same for the same address'
      )
      await pmr.deactivateBroker(broker1)
      const postBrokerStatus = await pmr.brokerStatus(broker1)
      assert(
        postBrokerStatus === false,
        'the broker should show false after being deactivated'
      )
    })

    it('should NOT add brokers that have already been added', async () => {
      await testWillThrow(pmr.addBroker, [broker2])
    })

    it('should NOT allow broker registration from NON owner', async () => {
      await testWillThrow(pmr.addBroker, [broker3, { from: broker3 }])
    })
  })
})

describe('when adjusting tokens', () => {
  contract('PoaManager', accounts => {
    let pmr
    let savedToken
    const activeBroker = accounts[1]
    const inactiveBroker = accounts[2]
    const custodian = accounts[5]

    before('setup contract state', async () => {
      const { registry } = await setupRegistry()
      pmr = await PoaManager.new(registry.address)
      await pmr.addBroker(activeBroker)
      await pmr.addBroker(inactiveBroker)
      await pmr.deactivateBroker(inactiveBroker)
    })

    it('should start with a placeholder token in tokens', async () => {
      const tokens = await pmr.listTokens()
      const formattedTokens = structToObject(tokens)
      const expectedTokens = [placeholderToken]
      assert.deepEqual(
        formattedTokens,
        expectedTokens,
        'the contact should start with a placeholder token in tokens'
      )
    })

    it('should add a token when sending as an active broker with enough ACT and approved for contract to spend', async () => {
      const watcher = pmr.TokenAdded()
      await pmr.addToken('test', 'TST', custodian, 1000, 1e18, {
        from: activeBroker
      })
      const events = await watcher.get()
      assert(
        events.length > 0 && events[0].event === 'TokenAdded',
        'there should be an event named TokenAdded'
      )
      const loggedAddress = events[0].args._token
      const savedTokenAddress = await pmr.getToken(loggedAddress)
      const savedTokenIndex = await pmr.tokenIndexMap(loggedAddress)
      const formattedSavedTokenAddress = tupleToObject(savedTokenAddress)
      assert(
        savedTokenIndex != 0,
        'the token index should never be set to 0 unless it was never set'
      )
      assert.equal(
        loggedAddress,
        formattedSavedTokenAddress.address,
        'the token addresses should match'
      )
      // TODO: we shouldn't be setting variables that other tests rely on like this
      // we should use lifecycle events (such as "before")
      savedToken = loggedAddress
    })

    it('should NOT add a token from a deactivated broker', async () => {
      await testWillThrow(pmr.addToken, [
        'test2',
        'TS2',
        custodian,
        1000,
        1e18,
        { from: inactiveBroker }
      ])
    })

    it('should NOT add a token from a non-broker', async () => {
      const preToken = await pmr.getToken(savedToken)
      const preTokenStatus = tupleToObject(preToken).active
      assert(preTokenStatus, 'the token should be active')
      await testWillThrow(pmr.addToken, [
        'test2',
        'TS2',
        custodian,
        1000,
        1e18,
        {
          from: accounts[4]
        }
      ])
    })

    it('should NOT deactivate an active token when NOT owner', async () => {
      const preToken = await pmr.getToken(savedToken)
      const preTokenStatus = tupleToObject(preToken).active
      assert(preTokenStatus, 'the token should be active')
      await testWillThrow(pmr.deactivateToken, [
        savedToken,
        { from: activeBroker }
      ])
    })

    it('should deactivate an active token when owner', async () => {
      const preToken = await pmr.getToken(savedToken)
      const preTokenStatus = tupleToObject(preToken).active
      assert(preTokenStatus, 'the token should be active')
      await pmr.deactivateToken(savedToken)
      const postToken = await pmr.getToken(savedToken)
      const postTokenStatus = tupleToObject(postToken).active
      assert.equal(
        true,
        postTokenStatus === false,
        'the token should be deactivated'
      )
    })

    it('should NOT deactivate an already inactive token', async () => {
      const preToken = await pmr.getToken(savedToken)
      const preTokenStatus = tupleToObject(preToken).active
      assert.equal(
        true,
        preTokenStatus === false,
        'the token should be inactive'
      )
      await testWillThrow(pmr.deactivateToken, [savedToken])
    })

    it('should NOT activate an inactive token when NOT owner', async () => {
      const preToken = await pmr.getToken(savedToken)
      const preTokenStatus = tupleToObject(preToken).active
      assert.equal(
        true,
        preTokenStatus === false,
        'the token should be inactive'
      )
      await testWillThrow(pmr.activateToken, [
        savedToken,
        { from: activeBroker }
      ])
    })

    it('should activate an inactive token when owner', async () => {
      const preToken = await pmr.getToken(savedToken)
      const preTokenStatus = tupleToObject(preToken).active
      assert.equal(
        true,
        preTokenStatus === false,
        'the token should be inactive'
      )
      await pmr.activateToken(savedToken)
      const postToken = await pmr.getToken(savedToken)
      const postTokenStatus = tupleToObject(postToken).active
      assert(postTokenStatus, 'the token should be activated')
    })

    it('should NOT activate an already active token', async () => {
      const preToken = await pmr.getToken(savedToken)
      const preTokenStatus = tupleToObject(preToken).active
      assert(preTokenStatus, 'the token should be active')
      await testWillThrow(pmr.activateToken, [savedToken])
    })
  })
})
