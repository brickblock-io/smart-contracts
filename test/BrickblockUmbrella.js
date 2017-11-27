const BrickblockUmbrella = artifacts.require('BrickblockUmbrella.sol')
const POAToken = artifacts.require('POAToken.sol')
const BrickblockAccessToken = artifacts.require('BrickblockAccessToken.sol')

// assumes even length arrays of addresses and statuses for Broker or Token
function structToObject(arrayResponse) {
  const addressIndex = 0
  const statusIndex = 1
  const addresses = arrayResponse[addressIndex]
  const statuses = arrayResponse[statusIndex]
  let objectResponse = []
  for (i = 0; i < addresses.length; i++) {
    objectResponse.push({
      address: addresses[i],
      active: statuses[i]
    })
  }

  return objectResponse
}

// assumes that passed in tuple from contract is a Broker or Token
function tupleToObject(tupleArray) {
  const address = tupleArray[0]
  const active = tupleArray[1]
  return {
    address,
    active
  }
}

const placeholderBroker = {
  address: '0x0000000000000000000000000000000000000000',
  active: false
}

const placeholderToken = {
  address: '0x0000000000000000000000000000000000000000',
  active: false
}

describe('after the contract is created', () => {
  contract('BrickblockUmbrella', accounts => {
    let bbu
    let owner = accounts[0]

    before('setup BrickblockUmbrella', async () => {
      bbu = await BrickblockUmbrella.deployed()
    })

    it('should set the owner as msg.sender on creation', async () => {
      const newOwner = await bbu.owner()
      assert.equal(newOwner, owner)
    })
  })
})

describe('when adjusting brokers', () => {
  contract('BrickblockUmbrella', accounts => {
    let bbu
    const owner = accounts[0]
    const broker1 = accounts[1]
    const broker2 = accounts[2]
    const broker3 = accounts[3]

    before('setup contract state', async () => {
      bbu = await BrickblockUmbrella.deployed()
    })

    it('should have one placeholder broker in the brokers list', async () => {
      const brokers = await bbu.listBrokers()
      const formattedBrokers = structToObject(brokers)
      const expectedBrokers = [placeholderBroker]
      assert.deepEqual(
        formattedBrokers,
        expectedBrokers,
        'there should only be a single placeholder broker'
      )
    })

    it('should add and list brokers', async () => {
      await bbu.addBroker(broker1)
      const brokers = await bbu.listBrokers()
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
      const broker = await bbu.getBroker(broker1)
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
      const brokerIndex = await bbu.brokerIndexMap(broker1)
      const broker = await bbu.getBroker(broker1)
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
      await bbu.addBroker(broker2)
      const brokers = await bbu.listBrokers()
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
      const preBroker = await bbu.getBroker(broker1)
      const preBrokerFormatted = tupleToObject(preBroker)
      assert(
        preBrokerFormatted.active,
        'the broker before the operation should be active'
      )

      await bbu.deactivateBroker(broker1)

      const postBroker = await bbu.getBroker(broker1)
      const postBrokerFormatted = tupleToObject(postBroker)
      assert.equal(
        true,
        postBrokerFormatted.active != true,
        'the broker after the operation should be inactive'
      )
    })

    it('should NOT deactivate a broker when the broker is already inactive', async () => {
      try {
        await bbu.deactivateBroker(broker1)
        assert(
          false,
          'the contract should throw when trying to deactivate a deactivated broker'
        )
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'invalid opcode shoudl be in the error'
        )
      }
    })

    it('should activate a broker when the broker is inactive', async () => {
      const preBroker = await bbu.getBroker(broker1)
      const preBrokerFormatted = tupleToObject(preBroker)
      assert.equal(
        true,
        preBrokerFormatted.active === false,
        'the broker before the operation should be inactive'
      )

      await bbu.activateBroker(broker1)

      const postBroker = await bbu.getBroker(broker1)
      const postBrokerFormatted = tupleToObject(postBroker)
      assert(
        postBrokerFormatted.active,
        'the broker after the operation should be active'
      )
    })

    it('should NOT activate a broker which is already active', async () => {
      try {
        await bbu.activateBroker(broker1)
        assert(false)
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'invalid opcode should be in the error'
        )
      }
    })

    it('should NOT add brokers that have already been added', async () => {
      try {
        await bbu.addBroker(broker2)
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'invalid opcode should be in the error'
        )
      }
    })

    it('should only allow broker registration from owner address', async () => {
      try {
        await bbu.addBroker.sendTransaction(broker3, { from: broker3 })
        assert(false, 'Expected to throw')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error should include invalid opcode'
        )
      }
    })
  })
})

describe('when adjusting tokens', () => {
  contract('BrickblockUmbrella', accounts => {
    let bbu
    let savedToken
    const owner = accounts[0]
    const activeBroker = accounts[1]
    const inactiveBroker = accounts[2]
    const custodian = accounts[3]

    before('setup contract state', async () => {
      bbu = await BrickblockUmbrella.deployed()
      await bbu.addBroker(activeBroker)
      await bbu.addBroker(inactiveBroker)
      await bbu.deactivateBroker(inactiveBroker)
    })

    it('should start with a placeholder token in tokens', async () => {
      const tokens = await bbu.listTokens()
      const formattedTokens = structToObject(tokens)
      const expectedTokens = [placeholderToken]
      assert.deepEqual(
        formattedTokens,
        expectedTokens,
        'the contact should start with a placeholder token in tokens'
      )
    })

    it('should add a token when sending as a valid broker and get a token', async () => {
      const watcher = bbu.TokenAdded()
      await bbu.addToken.sendTransaction('test', 'TST', custodian, 1000, 1e18, {
        from: activeBroker
      })
      const events = await watcher.get()
      assert(
        events.length > 0 && events[0].event === 'TokenAdded',
        'there should be an event named TokenAdded'
      )
      const loggedAddress = events[0].args._token
      const savedTokenAddress = await bbu.getToken(loggedAddress)
      const savedTokenIndex = await bbu.tokenIndexMap(loggedAddress)
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
      try {
        await bbu.addToken.sendTransaction(
          'test2',
          'TS2',
          custodian,
          1000,
          1e18,
          { from: inactiveBroker }
        )
        assert(false, 'inactive brokers shouldn NOT be able to add tokens')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'invalid opcode should be in the error'
        )
      }
    })

    it('should NOT add a token from a non-broker', async () => {
      const preToken = await bbu.getToken(savedToken)
      const preTokenStatus = tupleToObject(preToken).active
      assert(preTokenStatus, 'the token should be active')
      try {
        await bbu.addToken.sendTransaction(
          'test2',
          'TS2',
          custodian,
          1000,
          1e18,
          { from: accounts[4] }
        )
        assert(false, 'non brokers shouldn NOT be able to add tokens')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'invalid opcode should be in the error'
        )
      }
    })

    it('should NOT deactivate an active token when NOT owner', async () => {
      const preToken = await bbu.getToken(savedToken)
      const preTokenStatus = tupleToObject(preToken).active
      assert(preTokenStatus, 'the token should be active')
      try {
        await bbu.deactivateToken.sendTransaction(savedToken, {
          from: activeBroker
        })
        assert(false, 'non-owners should NOT be able to deactivate a token')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'invalid opcode should be in the error'
        )
      }
    })

    it('should deactivate an active token when owner', async () => {
      const preToken = await bbu.getToken(savedToken)
      const preTokenStatus = tupleToObject(preToken).active
      assert(preTokenStatus, 'the token should be active')
      await bbu.deactivateToken(savedToken)
      const postToken = await bbu.getToken(savedToken)
      const postTokenStatus = tupleToObject(postToken).active
      assert.equal(
        true,
        postTokenStatus === false,
        'the token should be deactivated'
      )
    })

    it('should NOT deactivate an already inactive token', async () => {
      const preToken = await bbu.getToken(savedToken)
      const preTokenStatus = tupleToObject(preToken).active
      assert.equal(
        true,
        preTokenStatus === false,
        'the token should be inactive'
      )
      try {
        await bbu.deactivateToken(savedToken)
        assert(
          false,
          'deactivated tokens should not be able to be deactivated again'
        )
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'invalid opcode should be in the error'
        )
      }
    })

    it('should NOT activate an inactive token when NOT owner', async () => {
      const preToken = await bbu.getToken(savedToken)
      const preTokenStatus = tupleToObject(preToken).active
      assert.equal(
        true,
        preTokenStatus === false,
        'the token should be inactive'
      )
      try {
        await bbu.activateToken.sendTransaction(savedToken, {
          from: activeBroker
        })
        assert(
          false,
          'deactivated tokens should not be able to be activated by non-owners'
        )
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'invalid opcode should be in the error'
        )
      }
    })

    it('should activate an inactive token when owner', async () => {
      const preToken = await bbu.getToken(savedToken)
      const preTokenStatus = tupleToObject(preToken).active
      assert.equal(
        true,
        preTokenStatus === false,
        'the token should be inactive'
      )
      await bbu.activateToken(savedToken)
      const postToken = await bbu.getToken(savedToken)
      const postTokenStatus = tupleToObject(postToken).active
      assert(postTokenStatus, 'the token should be activated')
    })

    it('should NOT activate an already active token', async () => {
      const preToken = await bbu.getToken(savedToken)
      const preTokenStatus = tupleToObject(preToken).active
      assert(preTokenStatus, 'the token should be active')
      try {
        await bbu.activateToken(savedToken)
        assert(
          false,
          'deactivated tokens should not be able to be deactivated again'
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
