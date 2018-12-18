const IPoaTokenCrowdsale = artifacts.require('IPoaTokenCrowdsale')
const { checkForEvent, testWillThrow } = require('../helpers/general')
const {
  addToken,
  setupPoaManager,
  moveTokenToActive,
  testPauseToken,
  testUnpauseToken,
  testTerminateToken,
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

describe('when calling issuer functions', () => {
  contract('PoaManager', accounts => {
    let pmr
    // used for testing happy path (paired with owner address)
    const addedIssuer = accounts[1]
    // used to testing listing / delisting and unhappy path (paired with notOwner address)
    const anotherIssuer = accounts[2]
    const notOwner = accounts[9]

    before('setup contract state', async () => {
      const contracts = await setupPoaManager()
      pmr = contracts.pmr
    })

    it('should be created with an empty issuerAddressList', async () => {
      const actual = await pmr.getIssuerAddressList()
      const expected = []
      assert.deepEqual(actual, expected, 'list should be empty')
    })

    describe('when adding an issuer', () => {
      it('isRegisteredIssuer should return false before adding an issuer', async () => {
        const isRegisteredIssuer = await pmr.isRegisteredIssuer(addedIssuer)

        assert.equal(
          isRegisteredIssuer,
          false,
          'isRegisteredIssuer should return false'
        )
      })

      it('should emit IssuerAdded', async () => {
        checkForEvent(
          'IssuerAdded',
          {
            issuer: addedIssuer,
          },
          await pmr.addIssuer(addedIssuer)
        )
      })

      it('isRegisteredIssuer should return true after adding an issuer', async () => {
        const isRegisteredIssuer = await pmr.isRegisteredIssuer(addedIssuer)

        assert.equal(
          isRegisteredIssuer,
          true,
          'isRegisteredIssuer should return true'
        )
      })

      it('should include new issuer in issuerAddressList', async () => {
        const actual = await pmr.getIssuerAddressList()
        const expected = [addedIssuer]
        assert.deepEqual(
          actual,
          expected,
          'issuerAddressList should contain addedIssuer'
        )
      })

      it('should set active value to true after adding issuer', async () => {
        const actual = await pmr.getIssuerStatus(addedIssuer)
        const expected = true
        assert.equal(actual, expected, 'addedIssuer starts listed')
      })

      it('should error when trying to add an issuer from notOwner address', async () => {
        await testWillThrow(pmr.addIssuer, [
          anotherIssuer,
          {
            from: notOwner,
          },
        ])
      })

      it('should allow for more issuers to be added', async () => {
        await pmr.addIssuer(anotherIssuer)

        const actual = await pmr.getIssuerAddressList()
        const expected = [addedIssuer, anotherIssuer]
        assert.deepEqual(
          actual,
          expected,
          'issuerAddressList should contain all added issuers'
        )
      })

      it('should error when trying to add an issuer that has already been added', async () => {
        await testWillThrow(pmr.addIssuer, [anotherIssuer])
      })
    })

    describe('when delisting an issuer', () => {
      it('should emit IssuerStatusChanged', async () => {
        checkForEvent(
          'IssuerStatusChanged',
          {
            issuer: addedIssuer,
            active: false,
          },
          await pmr.delistIssuer(addedIssuer)
        )
      })

      it('should set active value to false after delisting', async () => {
        const actual = await pmr.getIssuerStatus(addedIssuer)
        const expected = false
        assert.equal(
          actual,
          expected,
          'delisted issuer has active value set to false'
        )
      })

      it('should error when trying to delist an issuer address that is already delisted', async () => {
        await testWillThrow(pmr.delistIssuer, [addedIssuer])
      })

      it('should error when trying to delist an issuer from notOwner address', async () => {
        await testWillThrow(pmr.delistIssuer, [
          anotherIssuer,
          {
            from: notOwner,
          },
        ])
      })
    })

    describe('when listing an issuer', () => {
      it('should emit IssuerStatusChanged', async () => {
        checkForEvent(
          'IssuerStatusChanged',
          {
            issuer: addedIssuer,
            active: true,
          },
          await pmr.listIssuer(addedIssuer)
        )
      })

      it('should set active value to true after listing', async () => {
        const actual = await pmr.getIssuerStatus(addedIssuer)
        const expected = true
        assert.equal(
          actual,
          expected,
          'listed issuer has active value set to true'
        )
      })

      it('should error when trying to list an issuer address that is already listed', async () => {
        await testWillThrow(pmr.listIssuer, [addedIssuer])
      })

      it('should error when trying to list an issuer from notOwner address', async () => {
        await testWillThrow(pmr.listIssuer, [
          anotherIssuer,
          {
            from: notOwner,
          },
        ])
      })
    })

    describe('when removing an issuer', () => {
      it('should emit IssuerRemoved', async () => {
        checkForEvent(
          'IssuerRemoved',
          {
            issuer: addedIssuer,
          },
          await pmr.removeIssuer(addedIssuer)
        )
      })

      it('should remove issuer from issuerAddressList', async () => {
        const actual = await pmr.getIssuerAddressList()
        const expected = [anotherIssuer]
        assert.deepEqual(
          actual,
          expected,
          'issuerAddressList should not contain addedIssuer'
        )
      })

      it('should error when trying to getIssuerStatus of removed issuer', async () => {
        await testWillThrow(pmr.getIssuerStatus, [addedIssuer])
      })

      it('should error when trying to remove an issuer from notOwner address', async () => {
        await testWillThrow(pmr.removeIssuer, [
          anotherIssuer,
          {
            from: notOwner,
          },
        ])
      })

      it('should allow for all issuers to be removed', async () => {
        await pmr.removeIssuer(anotherIssuer)

        const actual = await pmr.getIssuerAddressList()
        const expected = []
        assert.deepEqual(
          actual,
          expected,
          'issuerAddressList should not contain removed issuers'
        )
      })

      it('should error when trying to remove an issuer that has already been removed', async () => {
        await testWillThrow(pmr.removeIssuer, [anotherIssuer])
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
    const listedIssuer = accounts[1]
    const delistedIssuer = accounts[2]
    const notIssuer = accounts[8]
    const notOwner = accounts[9]

    before('setup contract state', async () => {
      const contracts = await setupPoaManager()
      pmr = contracts.pmr
      await pmr.addIssuer(listedIssuer)
      await pmr.addIssuer(delistedIssuer)
      await pmr.delistIssuer(delistedIssuer)
    })

    it('should be created with an empty tokenAddressList', async () => {
      const actual = await pmr.getTokenAddressList()
      const expected = []
      assert.deepEqual(actual, expected, 'list should be empty')
    })

    describe('when adding a token', () => {
      it('should emit TokenAdded', async () => {
        const { txReceipt, tokenAddress } = await addToken(pmr, {
          from: listedIssuer,
        })

        // setting this here for use in following tests in this contract block
        addedToken = tokenAddress

        checkForEvent(
          'TokenAdded',
          {
            token: addedToken,
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
          from: listedIssuer,
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

      it('should error when trying to add a token from a delisted issuer address', async () => {
        await testWillThrow(addToken, [
          pmr,
          {
            from: delistedIssuer,
          },
        ])
      })

      it('should error when trying to add a token from a non issuer address', async () => {
        await testWillThrow(addToken, [
          pmr,
          {
            from: notIssuer,
          },
        ])
      })
    })

    describe('when listing a token', () => {
      it('should emit TokenStatusChanged', async () => {
        checkForEvent(
          'TokenStatusChanged',
          {
            token: addedToken,
            active: true,
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
            from: notOwner,
          },
        ])
      })
    })

    describe('when delisting a token', () => {
      it('should emit TokenStatusChanged', async () => {
        checkForEvent(
          'TokenStatusChanged',
          {
            token: addedToken,
            active: false,
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
            from: notOwner,
          },
        ])
      })
    })

    describe('when removing a token', () => {
      it('should emit TokenRemoved', async () => {
        checkForEvent(
          'TokenRemoved',
          {
            token: addedToken,
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
            from: notOwner,
          },
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
    const issuer = accounts[1]
    const notOwner = accounts[2]
    let addedToken

    before('setup contract state', async () => {
      const contracts = await setupPoaManager()
      pmr = contracts.pmr
      fmr = contracts.fmr

      await pmr.addIssuer(issuer)
      const { tokenAddress: addedTokenAddress } = await addToken(pmr, {
        from: issuer,
      })
      await pmr.listToken(addedTokenAddress, {
        from: owner,
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
            from: notOwner,
          },
        ])
      })

      it('should pause the addedToken', async () => {
        assert.equal(
          await addedToken.paused(),
          false,
          'token should begin unpaused'
        )

        await testPauseToken(pmr, addedToken, {
          from: owner,
        })

        assert.equal(
          await addedToken.paused(),
          true,
          'token should then become paused'
        )
      })
    })

    describe('when unpausing a token', () => {
      it('should error when caller is notOwner', async () => {
        await testWillThrow(testUnpauseToken, [
          pmr,
          addedToken,
          {
            from: notOwner,
          },
        ])
      })

      it('should unpause the addedToken', async () => {
        assert.equal(
          await addedToken.paused(),
          true,
          'token should begin paused'
        )
        await testUnpauseToken(pmr, addedToken, {
          from: owner,
        })
        assert.equal(
          await addedToken.paused(),
          false,
          'token should then become unpaused'
        )
      })
    })

    describe('when terminating a token', () => {
      it('should NOT terminate when caller is notOwner', async () => {
        await testWillThrow(testTerminateToken, [
          pmr,
          addedToken,
          {
            from: notOwner,
          },
        ])
      })

      it('should terminate the addedToken when owner', async () => {
        await testTerminateToken(pmr, addedToken)
      })
    })
  })
})
