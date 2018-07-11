const IPoaTokenCrowdsale = artifacts.require('IPoaTokenCrowdsale')
const { checkForEvent, testWillThrow } = require('../helpers/general')
const {
  addToken,
  setupPoaManager,
  moveTokenToActive,
  testPauseToken,
  testUnpauseToken,
  testTerminateToken,
  testToggleWhitelistTransfers
} = require('../helpers/pmr')

describe('when creating a new instance of the contract', () => {
  contract('PoaManager', accounts => {
    let pmr
    const owner = accounts[0]

    before('setup contract state', async () => {
      const contracts = await setupPoaManager()
      pmr = contracts.pmr
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
    // used for testing happy path (paired with owner address)
    const addedBroker = accounts[1]
    // used to testing listing / delisting and unhappy path (paired with notOwner address)
    const anotherBroker = accounts[2]
    const notOwner = accounts[9]

    before('setup contract state', async () => {
      const contracts = await setupPoaManager()
      pmr = contracts.pmr
    })

    it('should be created with an empty brokerAddressList', async () => {
      const actual = await pmr.getBrokerAddressList()
      const expected = []
      assert.deepEqual(actual, expected, 'list should be empty')
    })

    describe('when adding a broker', () => {
      it('should emit BrokerAddedEvent', async () => {
        checkForEvent(
          'BrokerAddedEvent',
          {
            broker: addedBroker
          },
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

      it('should set active value to true after adding broker', async () => {
        const actual = await pmr.getBrokerStatus(addedBroker)
        const expected = true
        assert.equal(actual, expected, 'addedBroker starts listed')
      })

      it('should error when trying to add a broker from notOwner address', async () => {
        await testWillThrow(pmr.addBroker, [
          anotherBroker,
          {
            from: notOwner
          }
        ])
      })

      it('should allow for more brokers to be added', async () => {
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
        await testWillThrow(pmr.addBroker, [anotherBroker])
      })
    })

    describe('when delisting a broker', () => {
      it('should emit BrokerStatusChangedEvent', async () => {
        checkForEvent(
          'BrokerStatusChangedEvent',
          {
            broker: addedBroker,
            active: false
          },
          await pmr.delistBroker(addedBroker)
        )
      })

      it('should set active value to false after delisting', async () => {
        const actual = await pmr.getBrokerStatus(addedBroker)
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
        await testWillThrow(pmr.delistBroker, [
          anotherBroker,
          {
            from: notOwner
          }
        ])
      })
    })

    describe('when listing a broker', () => {
      it('should emit BrokerStatusChangedEvent', async () => {
        checkForEvent(
          'BrokerStatusChangedEvent',
          {
            broker: addedBroker,
            active: true
          },
          await pmr.listBroker(addedBroker)
        )
      })

      it('should set active value to true after listing', async () => {
        const actual = await pmr.getBrokerStatus(addedBroker)
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
        await testWillThrow(pmr.listBroker, [
          anotherBroker,
          {
            from: notOwner
          }
        ])
      })
    })

    describe('when removing a broker', () => {
      it('should emit BrokerRemovedEvent', async () => {
        checkForEvent(
          'BrokerRemovedEvent',
          {
            broker: addedBroker
          },
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

      it('should error when trying to getBrokerStatus of removed broker', async () => {
        await testWillThrow(pmr.getBrokerStatus, [addedBroker])
      })

      it('should error when trying to remove a broker from notOwner address', async () => {
        await testWillThrow(pmr.removeBroker, [
          anotherBroker,
          {
            from: notOwner
          }
        ])
      })

      it('should allow for all brokers to be removed', async () => {
        await pmr.removeBroker(anotherBroker)

        const actual = await pmr.getBrokerAddressList()
        const expected = []
        assert.deepEqual(
          actual,
          expected,
          'brokerAddressList should not contain removed brokers'
        )
      })

      it('should error when trying to remove a broker that has already been removed', async () => {
        await testWillThrow(pmr.removeBroker, [anotherBroker])
      })
    })
  })
})

describe('when calling token functions', () => {
  contract('PoaManager', accounts => {
    // PoaManager
    let pmr
    // used for testing happy path (paired with owner address)
    let addedToken
    // used to testing listing / delisting and unhappy path (paired with notOwner address)
    let anotherToken
    const listedBroker = accounts[1]
    const delistedBroker = accounts[2]
    const notBroker = accounts[8]
    const notOwner = accounts[9]

    before('setup contract state', async () => {
      const contracts = await setupPoaManager()
      pmr = contracts.pmr
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
      it('should emit TokenAddedEvent', async () => {
        const { txReceipt, tokenAddress } = await addToken(pmr, {
          from: listedBroker
        })

        // setting this here for use in following tests in this contract block
        addedToken = tokenAddress

        checkForEvent(
          'TokenAddedEvent',
          {
            token: addedToken
          },
          txReceipt
        )
      })

      it('should have the PoaManager as the owner', async () => {
        const poaToken = await IPoaTokenCrowdsale.at(addedToken)
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

      it('should set active value to false after adding a token', async () => {
        const actual = await pmr.getTokenStatus(addedToken)
        const expected = false
        assert.equal(actual, expected, 'added token starts delisted')
      })

      it('should allow for more tokens to be added', async () => {
        const { tokenAddress } = await addToken(pmr, {
          from: listedBroker
        })

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
        await testWillThrow(addToken, [
          pmr,
          {
            from: delistedBroker
          }
        ])
      })

      it('should error when trying to add a token from a non broker address', async () => {
        await testWillThrow(addToken, [
          pmr,
          {
            from: notBroker
          }
        ])
      })
    })

    describe('when listing a token', () => {
      it('should emit TokenStatusChangedEvent', async () => {
        checkForEvent(
          'TokenStatusChangedEvent',
          {
            token: addedToken,
            active: true
          },
          await pmr.listToken(addedToken)
        )
      })

      it('should set active value to true after listing', async () => {
        const actual = await pmr.getTokenStatus(addedToken)
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
        await testWillThrow(pmr.listToken, [
          anotherToken,
          {
            from: notOwner
          }
        ])
      })
    })

    describe('when delisting a token', () => {
      it('should emit TokenStatusChangedEvent', async () => {
        checkForEvent(
          'TokenStatusChangedEvent',
          {
            token: addedToken,
            active: false
          },
          await pmr.delistToken(addedToken)
        )
      })

      it('should set active value to false after delisting', async () => {
        const actual = await pmr.getTokenStatus(addedToken)
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
        await testWillThrow(pmr.delistToken, [
          anotherToken,
          {
            from: notOwner
          }
        ])
      })
    })

    describe('when removing a token', () => {
      it('should emit TokenRemovedEvent', async () => {
        checkForEvent(
          'TokenRemovedEvent',
          {
            token: addedToken
          },
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

      it('should error when trying to getTokenStatus of removed token', async () => {
        await testWillThrow(pmr.getTokenStatus, [addedToken])
      })

      it('should error when trying to remove a token from notOwner address', async () => {
        await testWillThrow(pmr.removeToken, [
          anotherToken,
          {
            from: notOwner
          }
        ])
      })

      it('should allow for all tokens to be removed', async () => {
        await pmr.removeToken(anotherToken)

        const actual = await pmr.getTokenAddressList()
        const expected = []
        assert.deepEqual(
          actual,
          expected,
          'tokenAddressList should not contain removed tokens'
        )
      })

      it('should error when trying to remove a token that has already been removed', async () => {
        await testWillThrow(pmr.removeToken, [anotherToken])
      })
    })
  })
})

describe('when calling token convenience functions', () => {
  contract('PoaManager', accounts => {
    let pmr
    let fmr
    const owner = accounts[0]
    // must be accounts[1] in order to work with poa helpers
    const broker = accounts[1]
    const notOwner = accounts[2]
    let addedToken

    before('setup contract state', async () => {
      const contracts = await setupPoaManager()
      pmr = contracts.pmr
      fmr = contracts.fmr

      await pmr.addBroker(broker)
      const { tokenAddress: addedTokenAddress } = await addToken(pmr, {
        from: broker
      })
      await pmr.listToken(addedTokenAddress, {
        from: owner
      })
      addedToken = await IPoaTokenCrowdsale.at(addedTokenAddress)
      await moveTokenToActive(addedToken, fmr)
    })

    describe('when pausing a token', () => {
      it('should error when caller is notOwner', async () => {
        await testWillThrow(testPauseToken, [
          pmr,
          addedToken,
          {
            from: notOwner
          }
        ])
      })

      it('should pause the addedToken', async () => {
        await testPauseToken(pmr, addedToken, {
          from: owner
        })
      })
    })

    describe('when unpausing a token', () => {
      it('should error when caller is notOwner', async () => {
        await testWillThrow(testUnpauseToken, [
          pmr,
          addedToken,
          {
            from: notOwner
          }
        ])
      })

      it('should unpause the addedToken', async () => {
        await testUnpauseToken(pmr, addedToken, {
          from: owner
        })
      })
    })

    describe('when terminating a token', () => {
      it('should NOT terminate when caller is notOwner', async () => {
        await testWillThrow(testTerminateToken, [
          pmr,
          addedToken,
          {
            from: notOwner
          }
        ])
      })

      it('should terminate the addedToken when owner', async () => {
        await testTerminateToken(pmr, addedToken)
      })
    })

    describe('when toggle whitelistTransfers', () => {
      it('should NOT toggle toggleWhitelistTransfers when NOT owner', async () => {
        await testWillThrow(testToggleWhitelistTransfers, [
          pmr,
          addedToken,
          {
            from: notOwner
          }
        ])
      })

      it('should toggle toggleWhitelistTransfers when owner', async () => {
        await testToggleWhitelistTransfers(pmr, addedToken, { from: owner })
      })
    })
  })
})
