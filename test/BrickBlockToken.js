var BrickBlockToken = artifacts.require("./BrickBlockToken.sol")
var BigNumber = require('bignumber.js')
var leftPad = require('left-pad')

function createSignature(amount, recipient, owner) {
  amount = web3.toAscii(web3.toHex(eb3.toWei(amount)))
  while (amount.length < 32) amount = '\x00' + amount
  const hash = web3.sha3(web3.toHex(amount + recipient), { encoding: 'hex' })
  const signature = web3.eth.sign(owner, hash)
  const r = signature.slice(0, 66)
  const s = '0x' + signature.slice(66, 130)
  let v = '0x' + signature.slice(130, 132)
  v = web3.toDecimal(v) + 27
  return [v, r, s]
}

function createSignature(symbol, amount, custodian) {
  amount = web3.toAscii(web3.toHex(web3.toWei(amount)))
  while (amount.length < 32) amount = '\x00' + amount
  const hash = web3.sha3(web3.toHex(symbol + amount), { encoding: 'hex' })
  const signature = web3.eth.sign(custodian, hash)
  const r = signature.slice(0, 66)
  const s = '0x' + signature.slice(66, 130)
  let v = '0x' + signature.slice(130, 132)
  v = web3.toDecimal(v) + 27
  return [r, s, v]
}


contract('BrickBlockToken', accounts => {
  it('should put 5e25 BBT in the first account (owner)', async () => {
    const bbt = await BrickBlockToken.deployed()
    const balance = await bbt.balanceOf.call(accounts[0])
    assert.equal(balance.valueOf(), 5e25, '5e25 should be in the first account')
  })

  it('should have "BrickBlockToken" set as the name', async () => {
    const bbt = await BrickBlockToken.deployed()
    const name = await bbt.name.call()
    assert.equal(name, 'BrickBlockToken', 'The name isn\'t "BrickBlockToken"')
  })

  it('should have BBT set as the symbol', async () => {
    const bbt = await BrickBlockToken.deployed()
    const symbol = await bbt.symbol.call()
    assert.equal(symbol, 'BBT', 'BBT was not set as the symbol')
  })

  it('should have 18 decimals set', async () => {
    const bbt = await BrickBlockToken.deployed()
    const decimals = await bbt.decimals.call()
    assert.equal(decimals, 18, '18 decimals was not sets')
  })

  it('should transfer tokens when not paused', async () => {
    const bbt = await BrickBlockToken.deployed()
    const originalBalance = await bbt.balanceOf.call(accounts[1])
    await bbt.transfer(accounts[1], 1000)
    const newBalance = await bbt.balanceOf.call(accounts[1])
    assert.equal(newBalance.minus(originalBalance), 1000, 'The new balance should be 1000 after the transfer')
  })

  it('should burn the set amount of tokens', async () => {
    const bbt = await BrickBlockToken.deployed()
    const preTotalSupply = await bbt.totalSupply.call()
    const preBalanceAccount1 = await bbt.balanceOf(accounts[0])
    const burnAmount = preBalanceAccount1.div(2)
    await bbt.burn(burnAmount)
    const postTotalSupply = await bbt.totalSupply.call()
    const postBalanceAccount1 = await bbt.balanceOf.call(accounts[0])
    assert.equal(preBalanceAccount1.minus(postBalanceAccount1).toString(), burnAmount.toString(), 'the balance of the account should be decremented by the burn amount')
    assert.equal(preTotalSupply.minus(postTotalSupply).toString(), burnAmount.toString(), 'the totalSupply should be decremented by the burn amount')
  })

  it('should set correct balance for previously agreed amount and address with owner signed message', async () => {
    // setup and get pre values
    const bbt = await BrickBlockToken.deployed()
    const owner = accounts[0]
    const claimer = accounts[9]
    const preOwnerBalance = await bbt.balanceOf(accounts[0])
    const preRecipientBalance = await bbt.balanceOf(claimer)

    // setup signed message from contract owner
    const claimableAmount = new BigNumber(web3.toWei(1000))
    const claimableAddress = claimer

    // need to pad the number to make uint256(uint) and use toHex when dealing with BigNumbers
    const hash = web3.sha3(leftPad(web3.toHex(claimableAmount).slice(2).toString(16), 64, 0) + claimableAddress.slice(2).toString(16), { encoding: 'hex' })

    const signature = web3.eth.sign(owner, hash)

    // submit signature with correct amount
    await bbt.claimTokens.sendTransaction(signature, claimableAmount, {
      from: claimer
    })

    const postOwnerBalance = await bbt.balanceOf(accounts[0])
    const postRecipientBalance = await bbt.balanceOf(accounts[9])
    assert.equal(preOwnerBalance.minus(postOwnerBalance).toString(), claimableAmount.toString(), 'the owner balance should be deducted by the claimable amount')
    assert.equal(postRecipientBalance.minus(preRecipientBalance).toString(), claimableAmount.toString(), 'the recipient balance should be incremented by the claimable amount')
  })

  it('should not set correct balance for with signed message if value is incorrect', async () => {
    // setup and get pre values
    const bbt = await BrickBlockToken.deployed()
    const owner = accounts[0]
    const claimer = accounts[1]
    const preOwnerBalance = await bbt.balanceOf(accounts[0])
    const preRecipientBalance = await bbt.balanceOf(claimer)

    // setup signed message from contract owner
    const claimableAmount = new BigNumber(web3.toWei(1000))
    const claimableAddress = claimer

    // need to pad the number to make uint256(uint) and use toHex when dealing with BigNumbers
    const hash = web3.sha3(leftPad(web3.toHex(claimableAmount).slice(2).toString(16), 64, 0) + claimableAddress.slice(2).toString(16), { encoding: 'hex' })

    const signature = web3.eth.sign(owner, hash)

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
    const bbt = await BrickBlockToken.deployed()
    const owner = accounts[0]
    const claimer = accounts[1]
    const notClaimer = accounts[2]
    const preOwnerBalance = await bbt.balanceOf(accounts[0])
    const preRecipientBalance = await bbt.balanceOf(claimer)

    // setup signed message from contract owner
    const claimableAmount = new BigNumber(web3.toWei(1000))
    const claimableAddress = claimer

    // need to pad the number to make uint256(uint) and use toHex when dealing with BigNumbers
    const hash = web3.sha3(leftPad(web3.toHex(claimableAmount).slice(2).toString(16), 64, 0) + claimableAddress.slice(2).toString(16), { encoding: 'hex' })

    const signature = web3.eth.sign(owner, hash)

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
