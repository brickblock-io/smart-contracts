const BBT = artifacts.require("./BrickblockToken.sol")
const Fountain = artifacts.require("./BrickblockFountain.sol")
const { createTokenCert } = require('../helpers/crypto')
const BigNumber = require('bignumber.js')

async function mint(bbt, accounts, ammount) {
  const owner = web3.eth.accounts[0]
  return Promise.all(accounts.map( async (account) => {
    console.log(account, ammount)
    return bbt.distributeTokens(account, ammount, {
        from: owner
    })
  }))
}

describe('Upgrade Process', () => {

  describe('upgrade functions before dead', () => {
    contract('BrickblockToken', accounts => {
      const owner = accounts[0]
      let successor, bbt    
      before('call upgrade with ancestor', async ()=> {
        bbt = await BBT.deployed()
      })

      // evacuate is an successor only function, as long as we can't change or set that,
      // no one can call evacuate  
      it('should be impossible to call evacuate', async () => {
        try {
          await bbt.evacuate()
          assert(false, 'calling evacuate did not throw')
        } catch(error) {
          if(error.code === 'ERR_ASSERTION' )
            throw error        
        }
      })

      it('should fail when rescue is called without an predecessor', async () => {
        try {
          await bbt.rescue()
          assert(false, 'we expected an invalid opcode error here')
        } catch(error) {
          if(error.code === 'ERR_ASSERTION')
            throw error
        }
      })

      it('should be impossible to call  upgrade with zero value', async () => {
        try {
          await bbt.upgrade(bbt.address.replace(/[0123456789abcdef]/, '0'))
          assert(false, 'upgrading to zero address did not throw')
        } catch(error) {
          if(error.code === 'ERR_ASSERTION')
            throw error
        }
        assert(await bbt.dead() !== false, 'the invalid upgrade call did kill the contract')
      })

    })
  })

  
  describe('upgrading non finalizedToken', () => {
      contract('BrickblockToken', accounts => {
        const owner = accounts[0]
        let successor, bbt    
          before('call upgrade with ancestor', async ()=> {
            bbt = await BBT.deployed()
            successor = await BBT.new()
            assert(bbt.address !== successor.address)
            await bbt.unpause({from: owner})
            assert(await bbt.paused() == false, 'BBT is paused')
            await bbt.upgrade(successor.address, {from: owner})
          })

        it('should pause the contract', async ()=> {
          assert(await bbt.paused() == true, 'contract not paused after calling upgrade')
        })

        it('should set the dead switch to true', async () => {
          assert(await bbt.dead() == true, 'contract is not dead after calling upgrade')
        })

        it('should set the successor to the right address', async () => {
          assert(await bbt.successorAddress() == successor.address, 'address not set right')
        })
        
        it('should throw when doing anything except evacute', async () => {
          try {
            const signature = await createSignature(owner, accounts[1], 1e18)
            await bbt.claimTokens.sendTransaction(signature, 1e18, {from:accounts[1]})
            assert(false, 'did not throw when claiming tokens')
          } catch (error) {
            if(error.code === 'ERR_ASSERTION' )
              throw error        
          } try {
            await bbt.finalizeTokenSale({from: owner})
            assert(false, 'did not throw when finalizing Token sale')
          } catch (error) {
            if(error.code === 'ERR_ASSERTION' )
              throw error        
          } try {
            await bbt.unpause({from: owner})
            assert(false, 'did not throw when unpauseing')
          } catch (error) {
            if(error.code === 'ERR_ASSERTION' )
              throw error        
          }
          // everything else should be covered by pauseable and tested there
        })
      })
  })

  contract('BrickblockToken', accounts => {
    const owner = accounts[0]
    let successor, bbt    
    describe('upgrade finalizedToken', ()=> {
      before('mint and setup', async () => {
        bbt = await BBT.deployed()
        const fountain = await Fountain.deployed()
        await mint(bbt, accounts.slice(1,5), 1e18)
        await bbt.changeBonusDistributionAddress(owner, {from: owner})
        await bbt.changeFountainContractAddress(fountain.address, {from: owner})
        await bbt.finalizeTokenSale({from: owner})
        successor = await BBT.new(bbt.address)
        await bbt.upgrade(successor.address, {from: owner})
      })

      it('should set the predecessor to the original', async () => {
        assert(await bbt.predecessorAddress() == 0, 'BBT predecessor is not zero')
        assert(await successor.predecessorAddress() == bbt.address, 'Predecessor is unequal BBT address')        
      })
      
      it('should update the Successors totalSupply', async () => {
        const bbtTotalSupply = await bbt.totalSupply()
        const bbtInitalSupply = await bbt.initialSupply()
        assert(bbtTotalSupply.cmp(bbtInitalSupply) !== 0, 'totalSupply did not change before upgrading')
        const sucTotalSupply = await successor.totalSupply()
        const expectedTotalSupply = await bbt.balanceOf(bbt.address)
        assert.equal(sucTotalSupply.toString(), expectedTotalSupply.toString(), 'successor totalSupply does not equal unsold tokens')
      })

      
      it('evacuate should return and reset the balances', async () => {
        const oldBalance = await bbt.balanceOf(accounts[1]);
        const oldBbtTotalSupply = await bbt.totalSupply()
        const oldSucTotalSupply = await successor.totalSupply()
        assert(oldBalance.cmp(0) > 0 ,
               'BBT amount is zero for accounts[1], did minting go wrong')
        assert((await successor.balanceOf(accounts[1])).cmp( 0) == 0,
               'BBTsucc amount is non  zero for accounts[1]')
        assert.equal(await successor.predecessorAddress(), bbt.address, 'successor.predeccesor is wrong')
        await successor.rescue({from: accounts[1]})

        it('should update balances', async () => {
          assert((await successor.balanceOf(accounts[1])).cmp(oldBalance) == 0,
                'rescue and evacuation did not update successors balance' )
          assert.equal((await bbt.balanceOf(accounts[1])).toString()
                       ,new  BigNumber(0).toString(),
                       'rescue and evacuation did not update predeccesor balance' )
        })

        it('should update totalSupply', async () => {
          assert.equal((await successor.totalSupply()).minus(oldSucTotalSupply).toString(),
                       oldBalance.toString(), 'successor totalSupply delta wrong')
          assert.equal(oldBbtTotalSupply.minus(await bbt.totalSupply()).toString(),
                       oldBalance.toString(), 'successor totalSupply delta wrong')

        })

      })

      it('calling evacuate multiple times should not change the balances', async () => {
        user = accounts[2]
        await successor.rescue({from: user})
        oldBbt = await bbt.balanceOf(user)
        oldSuc = await successor.balanceOf(user)
        assert(oldBbt.cmp(0) == 0, 'BBT balance did not reset')
        assert(oldSuc.cmp(0) !== 0, 'SUC balance did not update')
        await successor.rescue({from: user})
        assert(oldBbt.cmp(await bbt.balanceOf(user)) == 0, 'BBT balance did change')
        assert(oldSuc.cmp(await successor.balanceOf(user)) == 0, 'SUC balance did change')
      })


    })
  })

})
