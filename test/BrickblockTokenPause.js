var BrickBlockToken = artifacts.require("./BrickBlockToken.sol")
var BigNumber = require('bignumber.js')

contract('BrickBlockToken', accounts => {

  it('should not pause when non-owner calls pause', async () => {
    const bbt = await BrickBlockToken.deployed()
    try {
      await bbt.pause.sendTransaction({
        from: accounts[1]
      })
    } catch(error) {
      assert.equal(true, /invalid opcode/.test(error), 'invlid opcode should be the error')
    }
  })

  it('should pause when the owner calls pause', async () => {
    const bbt = await BrickBlockToken.deployed()
    await bbt.pause()
    const postPausedState = await bbt.paused.call()
    assert.equal(postPausedState, true, 'The contract should be paused')
  })

  it('should not unpause when non-owner calls pause', async () => {
    const bbt = await BrickBlockToken.deployed()
    try {
      await bbt.unpause.sendTransaction({
        from: accounts[1]
      })
    } catch(error) {
      assert.equal(true, /invalid opcode/.test(error), 'invlid opcode should be the error')
    }
  })

  it('should unpause when the owner calls unpause', async () => {
    const bbt = await BrickBlockToken.deployed()
    const prePausedState = await bbt.paused.call()
    assert.equal(prePausedState, true, 'The contract should already be paused')
    await bbt.unpause()
    const postPausedState = await bbt.paused.call()
    assert.equal(postPausedState, false, 'The contract should be paused')
  })

  it('should not transfer tokens when paused', async () => {
    const bbt = await BrickBlockToken.deployed()
    await bbt.pause()
    try {
      await bbt.transfer(accounts[1], web3.toWei(1000))
      assert(false, 'should throw when paused')
    } catch(error) {
      assert.equal(true, /invalid opcode/.test(error), 'should contain invalid opcode in error')
    }
    await bbt.unpause()
  })

  it('should transfer tokens when not paused', async () => {
    const bbt = await BrickBlockToken.deployed()
    const originalBalance = await bbt.balanceOf.call(accounts[1])
    await bbt.transfer(accounts[1], web3.toWei(1000))
    const newBalance = await bbt.balanceOf.call(accounts[1])
    assert.equal(newBalance.minus(originalBalance).toString(), new BigNumber(web3.toWei(1000)).toString(), 'The new balance should be 1000 after the transfer')
  })

  it('should not set allowances for other addresses when paused', async () => {
    const bbt = await BrickBlockToken.deployed()
    await bbt.transfer(accounts[1], web3.toWei(1000))
    const balanceAccount1 = await bbt.balanceOf.call(accounts[1])
    const approvalAmount = balanceAccount1.div(2)
    const weiApprovalAmount = web3.toWei(approvalAmount)
    await bbt.pause()
    try {
      await bbt.approve.sendTransaction(accounts[2], weiApprovalAmount, {
        from: accounts[1]
      })
      assert(false, 'should throw when paused')
    } catch(error) {
      assert.equal(true, /invalid opcode/.test(error), 'should contain invalid opcode in error')
      await bbt.unpause()
    }
  })

  it('should set allowances for other addresses', async () => {
    const bbt = await BrickBlockToken.deployed()
    await bbt.transfer(accounts[1], web3.toWei(1000))
    const balanceAccount1 = await bbt.balanceOf.call(accounts[1])
    const approvalAmount = balanceAccount1.div(2)
    const weiApprovalAmount = web3.toWei(approvalAmount)
    const preAllowance = await bbt.allowance(accounts[1], accounts[2])
    await bbt.approve.sendTransaction(accounts[2], weiApprovalAmount, {
      from: accounts[1],
    })
    const postAllowance = await bbt.allowance(accounts[1], accounts[2])
    assert.equal(postAllowance.minus(preAllowance).toString(), weiApprovalAmount.toString(), 'approval amount should match approval')
  })

  it('should not increase approval when paused', async () => {
    const bbt = await BrickBlockToken.deployed()
    await bbt.transfer(accounts[1], web3.toWei(1000))
    const balanceAccount1 = await bbt.balanceOf.call(accounts[1])
    const approvalAmount = balanceAccount1.div(2)
    const weiApprovalAmount = web3.toWei(approvalAmount)
    await bbt.pause()
    try {
      await bbt.increaseApproval(accounts[2], weiApprovalAmount, {
        from: accounts[1]
      })
      assert(false, 'should throw when paused')
    } catch(error) {
      assert.equal(true, /invalid opcode/.test(error), 'should contian invalid opcode in error')
      await bbt.unpause()
    }
  })

  it('should increase approval when paused', async () => {
    const bbt = await BrickBlockToken.deployed()
    await bbt.transfer(accounts[1], web3.toWei(1000))
    const balanceAccount1 = await bbt.balanceOf.call(accounts[1])
    const approvalAmount = balanceAccount1.div(2)
    const weiApprovalAmount = web3.toWei(approvalAmount)
    await bbt.increaseApproval(accounts[2], weiApprovalAmount, {
      from: accounts[1]
    })
  })

  it('should not decrease approval when paused', async () => {
    const bbt = await BrickBlockToken.deployed()
    await bbt.transfer(accounts[1], web3.toWei(1000))
    const balanceAccount1 = await bbt.balanceOf.call(accounts[1])
    const approvalAmount = balanceAccount1.div(2)
    const weiApprovalAmount = web3.toWei(approvalAmount)
    await bbt.pause()
    try {
      await bbt.decreaseApproval(accounts[2], weiApprovalAmount, {
        from: accounts[1]
      })
      assert(false, 'should throw when paused')
    } catch(error) {
      assert.equal(true, /invalid opcode/.test(error), 'should contian invalid opcode in error')
      await bbt.unpause()
    }
  })

  it('should increase approval when paused', async () => {
    const bbt = await BrickBlockToken.deployed()
    await bbt.transfer(accounts[1], web3.toWei(1000))
    const balanceAccount1 = await bbt.balanceOf.call(accounts[1])
    const approvalAmount = balanceAccount1.div(2)
    const weiApprovalAmount = web3.toWei(approvalAmount)
    await bbt.decreaseApproval(accounts[2], weiApprovalAmount, {
      from: accounts[1]
    })
  })

  it('should allow transferFrom not paused', async () => {
    const bbt = await BrickBlockToken.deployed()
    await bbt.transfer(accounts[1], web3.toWei(1000))
    const preApproval = await bbt.allowance(accounts[1], accounts[2])
    const preBalanceAccount1 = await bbt.balanceOf(accounts[1])
    const preBalanceAccount3 = await bbt.balanceOf(accounts[3])
    const approveAmount = preBalanceAccount1.div(2)
    const approveTransferAmount = approveAmount.div(2)
    await bbt.approve.sendTransaction(accounts[2], approveAmount, {
      from: accounts[1]
    })
    await bbt.transferFrom.sendTransaction(accounts[1], accounts[3], approveTransferAmount, {
      from: accounts[2]
    })
    const postApproval = await bbt.allowance(accounts[1], accounts[2])
    const postBalanceAccount1 = await bbt.balanceOf(accounts[1])
    const postBalanceAccount3 = await bbt.balanceOf(accounts[3])
    assert.equal(postBalanceAccount3.minus(preBalanceAccount3).toString(), approveTransferAmount.toString(), 'the differences in balance between pre and post account 1 should be equivalent to approveTransferAmount')
    assert.equal(preBalanceAccount1.minus(postBalanceAccount1).toString(), approveTransferAmount.toString(), 'the differences in balance between pre and post account 3 should be equivalent to approveTransferAmount')
    assert.equal(preApproval.minus(postApproval).toString(), preApproval.minus(approveTransferAmount).toString(), 'the difference in allowance should be the same as the approveTransferAmount')
  })

})
