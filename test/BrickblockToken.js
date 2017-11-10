var BrickblockToken = artifacts.require("./BrickblockToken.sol")
var BigNumber = require('bignumber.js')
var leftPad = require('left-pad')

async function createSignedMessage(signer, claimer, amount) {
  const hash = web3.sha3(
    leftPad(
      web3.toHex(amount).slice(2).toString(16), 64, 0
    ) + claimer.slice(2).toString(16), { encoding: 'hex' }
  )

  return signature = await web3.eth.sign(signer, hash)
}

describe('before the ico', () => {
  contract('BrickblockToken', accounts => {
    it('should put 5e25 BBT in the contract address', async () => {
      const bbt = await BrickblockToken.deployed()
      const balance = await bbt.balanceOf.call(bbt.address)
      assert.equal(balance.valueOf(), 5e25, '5e25 should be in the first account')
    })

    it('should have "BrickblockToken" set as the name', async () => {
      const bbt = await BrickblockToken.deployed()
      const name = await bbt.name.call()
      assert.equal(name, 'BrickblockToken', 'The name isn\'t "BrickblockToken"')
    })

    it('should have BBT set as the symbol', async () => {
      const bbt = await BrickblockToken.deployed()
      const symbol = await bbt.symbol.call()
      assert.equal(symbol, 'BBT', 'BBT was not set as the symbol')
    })

    it('should have 18 decimals set', async () => {
      const bbt = await BrickblockToken.deployed()
      const decimals = await bbt.decimals.call()
      assert.equal(decimals, 18, '18 decimals was not sets')
    })

    it('should set correct balance for previously agreed amount and address with owner signed message', async () => {
      // setup and get pre values
      const bbt = await BrickblockToken.deployed()
      const owner = accounts[0]
      const tokenDepot = bbt.address
      const claimer = accounts[9]
      const preTokenDepotBalance = await bbt.balanceOf(tokenDepot)
      const preRecipientBalance = await bbt.balanceOf(claimer)

      // setup signed message from contract owner
      const claimableAmount = new BigNumber(web3.toWei(1000))

      const signature = await createSignedMessage(owner, claimer, claimableAmount)

      // submit signature with correct amount
      await bbt.claimTokens.sendTransaction(signature, claimableAmount, {
        from: claimer
      })

      const postTokenDepotBalance = await bbt.balanceOf(tokenDepot)
      const postRecipientBalance = await bbt.balanceOf(accounts[9])
      console.log(preTokenDepotBalance.toString(), postRecipientBalance.toString())
      console.log(preRecipientBalance.toString(), postRecipientBalance.toString())
      assert.equal(preTokenDepotBalance.minus(postTokenDepotBalance).toString(), claimableAmount.toString(), 'the owner balance should be deducted by the claimable amount')
      assert.equal(postRecipientBalance.minus(preRecipientBalance).toString(), claimableAmount.toString(), 'the recipient balance should be incremented by the claimable amount')
    })

    it('should not set correct balance with signed message if value is incorrect', async () => {
      // setup and get pre values
      const bbt = await BrickblockToken.deployed()
      const owner = accounts[0]
      const tokenDepot = bbt.address
      const claimer = accounts[1]

      // setup signed message from contract owner
      const claimableAmount = new BigNumber(web3.toWei(1000))

      const signature = await createSignedMessage(owner, claimer, claimableAmount)

      try {
        // submit signature with incorrect amount
        await bbt.claimTokens.sendTransaction(signature, claimableAmount.add(1e21), {
          from: claimer
        })
        assert(false, 'the claimer shouldn\'t be able to change the value claimed')
      } catch (error) {
        assert.equal(true, /invalid opcode/.test(error), 'invalid opcode should be the error')
      }
    })

    it('should not set correct balance for with signed message if the wrong address tries to claim', async () => {
      // setup and get pre values
      const bbt = await BrickblockToken.deployed()
      const owner = accounts[0]
      const tokenDepot = bbt.address
      const claimer = accounts[1]
      const notClaimer = accounts[2]

      // setup signed message from contract owner
      const claimableAmount = new BigNumber(web3.toWei(1000))

      const signature = await createSignedMessage(owner, claimer, claimableAmount)

      try {
        // submit signature with incorrect amount
        await bbt.claimTokens.sendTransaction(signature, claimableAmount, {
          from: notClaimer
        })
        assert(false, 'only the claimer should be able to claim with this message')
      } catch (error) {
        assert.equal(true, /invalid opcode/.test(error), 'invalid opcode should be the error')
      }
    })
  })
})

describe('after the the ico', async () => {
  contract('BrickblockToken', accounts => {
    before('setup post ico state', async () => {
      const bbt = await BrickblockToken.deployed()
      const paused = await bbt.paused.call()
      const preTokenSaleActive = await bbt.tokenSaleActive()
      const acc1ClaimAmount = new BigNumber(1000e18)
      const acc2ClaimAmount = new BigNumber(2000e18)
      assert(paused, 'the token should start paused')
      assert(preTokenSaleActive, 'token should start with tokenSaleActive')
      const owner = accounts[0]
      const acc1Claim = await createSignedMessage(owner, accounts[1], acc1ClaimAmount)
      const acc2Claim = await createSignedMessage(owner, accounts[2], acc2ClaimAmount)
      await bbt.claimTokens.sendTransaction(acc1Claim, acc1ClaimAmount, {from: accounts[1]})
      await bbt.claimTokens.sendTransaction(acc2Claim, acc2ClaimAmount, {from: accounts[2]})
      const acc1Balance = await bbt.balanceOf(accounts[1])
      const acc2Balance = await bbt.balanceOf(accounts[2])
      assert(true, acc1Balance === acc1ClaimAmount, 'acc1 should have the claimed amount')
      assert(true, acc2Balance === acc2ClaimAmount, 'acc2 should have the claimed amount')
      await bbt.finalizeTokenSale()
      const postTokenSaleActive = await bbt.tokenSaleActive()
      assert(!postTokenSaleActive, 'the token sale should no longer be active')
    })
    
    it('should transfer tokens when not paused', async () => {
      const bbt = await BrickblockToken.deployed()
      await bbt.unpause()
      const originalBalance = await bbt.balanceOf.call(accounts[1])
      await bbt.transfer(accounts[1], 1000)
      const newBalance = await bbt.balanceOf.call(accounts[1])
      assert.equal(newBalance.minus(originalBalance), 1000, 'The new balance should be 1000 after the transfer')
    })
    
  })
  
})