var BrickblockToken = artifacts.require("./BrickblockToken.sol")
var BrickblockAccessToken = artifacts.require("./BrickBlockAccessToken.sol")
var BigNumber = require('bignumber.js')
var leftPad = require('left-pad')

function distributeTokensToMany(contract, accounts) {
  return new Promise(function(resolve) {
    const distributeAmount = new BigNumber(1e24)
    const addresses = accounts.slice(4)
    let processed
    addresses.forEach((address) => {
      contract.distributeTokens(address, distributeAmount)
      processed++
      if (processed === addresses.length) {
        resolve()
      }
    })
  })
}

function unpauseIfPaused(contract) {
  return new Promise(function(resolve) {
    contract.paused()
    .then(paused => {
      if (paused) {
        contract.unpause()
        .then(() => {
          resolve()
        })
      } else {
        resolve()
      }
    })
  })
}

function pauseIfPaused(contract) {
  return new Promise(function(resolve) {
    contract.paused()
    .then(paused => {
      if (!paused) {
        contract.pause()
        .then(() => {
          resolve()
        })
      } else {
        resolve()
      }
    })
  })
}

function togglePause(contract) {
  return new Promise(function(resolve) {
    contract.paused()
      .then(paused => {
        if (paused) {
          contract.unpause()
          .then(resolve)
        } else {
          contract.pause()
          .then(resolve)
        }
      })
  })
}

// spam pause/unpause on the contract to move block count along in testrpc (every transaction creates new block)
async function blockTimeWarp(contract, blocks) {
  for(i = 0; i < blocks; i++) {
    await togglePause(contract)
  }
}

describe('before the ico', () => {
  contract('BrickblockToken', accounts => {
    let owner = accounts[0]
    let contributor1 = accounts[2]
    let contributor2 = accounts[3]
    let bbt
    let bbtAddress

    before('setup contract and relevant accounts', async () => {
      bbt = await BrickblockToken.deployed()
      bbtAddress = bbt.address
    })

    it('should set the companyShareReleaseBlock to 50 for development network', async () => {
      const releaseBlock = await bbt.companyShareReleaseBlock()
      const neededBlock = new BigNumber(50)
      assert.equal(neededBlock.toString(), releaseBlock.toString())
    })

    it('should put 5e25 BBT in the contract address', async () => {
      const balance = await bbt.balanceOf(bbt.address)
      assert.equal(balance.valueOf(), 5e25, '5e25 should be in the first account')
    })

    it('should have "BrickblockToken" set as the name', async () => {
      const name = await bbt.name()
      assert.equal(name, 'BrickblockToken', 'The name isn\'t "BrickblockToken"')
    })

    it('should have BBT set as the symbol', async () => {
      const symbol = await bbt.symbol()
      assert.equal(symbol, 'BBT', 'BBT was NOT set as the symbol')
    })

    it('should have 18 decimals set', async () => {
      const decimals = await bbt.decimals()
      assert.equal(decimals, 18, '18 decimals was NOT sets')
    })

    it('should start paused', async () => {
      const paused = await bbt.paused()
      assert.equal(true, paused, 'the contract should start paused')
    })

    it('should start with tokenSaleActive set to true', async () => {
      const tokenSaleActive = await bbt.tokenSaleActive()
      assert.equal(true, tokenSaleActive, 'tokenSaleActive should be set to true during contract creation')
    })

    it('should distribute tokens to designated address when owner and tokenSaleActive is true', async () => {
      const preContractBalance = await bbt.balanceOf(bbtAddress)
      const preContributor1Balance = await bbt.balanceOf(contributor1)
      const preContributor2Balance = await bbt.balanceOf(contributor2)
      const distributeAmount1 = new BigNumber(1e24)
      const distributeAmount2 = new BigNumber(5e24)

      await bbt.distributeTokens(contributor1, distributeAmount1)
      await bbt.distributeTokens(contributor2, distributeAmount2)

      const postContractBalance = await bbt.balanceOf(bbtAddress)
      const postContributor1Balance = await bbt.balanceOf(contributor1)
      const postContributor2Balance = await bbt.balanceOf(contributor2)

      assert.equal(preContractBalance.minus(postContractBalance).toString(), distributeAmount1.add(distributeAmount2).toString(), 'the contract balance should be decremented by the claimed amounts')
      assert.equal(postContributor1Balance.minus(preContributor1Balance).toString(), distributeAmount1.toString(), 'contributor1 token balance should be incremented by the claim amount')
      assert.equal(postContributor2Balance.minus(preContributor2Balance).toString(), distributeAmount2.toString(), 'contributor2 token balance should be incremented by the claim amount')
    })

    it('should NOT distribute tokens to designated address when NOT owner', async () => {
      const distributeAmount = new BigNumber(1e24)
      try {
        await bbt.distributeTokens.sendTransaction(contributor1, distributeAmount, {from: contributor1})
        assert(false, 'the contract should throw in this case')
      } catch(error) {
        assert.equal(true, /invalid opcode/.test(error), 'invalid opcode should be the error')
      }

      try {
        await bbt.distributeTokens.sendTransaction(contributor1, distributeAmount, {from: contributor2})
        assert(false, 'the contract should throw in this case')
      } catch(error) {
        assert.equal(true, /invalid opcode/.test(error), 'invalid opcode should be the error')
      }
    })

    it('should NOT distribute tokens to designated address when the target address is the owner address', async () => {
      const distributeAmount = new BigNumber(1e24)
      try {
        await bbt.distributeTokens(owner, distributeAmount)
        assert(false, 'the contract should throw in this case')
      } catch(error) {
        assert.equal(true, /invalid opcode/.test(error), 'invalid opcode should be the error')
      }
    })

    it('should change the bonusDistributionAddress', async () => {
      const preAddress  = await bbt.bonusDistributionAddress()
      await bbt.changeBonusDistributionAddress(accounts[1])
      const postAddress = await bbt.bonusDistributionAddress()
      assert.equal(true, preAddress != postAddress)
      assert.equal(postAddress, accounts[1], 'the address should be set to the third account in wallet')
    })

    it('should NOT change the bonusDistributionAddress if NOT owner', async () => {
      try {
        await bbt.changeBonusDistributionAddress.sendTransaction(accounts[3], {from: accounts[4]})
        assert(false, 'the contract should throw in this case')
      } catch(error) {
        assert.equal(true, /invalid opcode/.test(error), 'invalid opcode should be the error')
      }
    })

    it('should NOT change the bonusDistributionAddress is the contract itself', async () => {
      try {
        await bbt.changeBonusDistributionAddress(bbtAddress)
        assert(false, 'the contract should throw in this case')
      } catch(error) {
        assert.equal(true, /invalid opcode/.test(error), 'invalid opcode should be the error')
      }
    })

    it('should change the fountainAddress when owner, NOT bbt contract, and is NOT owner address, and is a contract', async () => {
      const act = await BrickblockAccessToken.deployed()
      const actAddress = act.address
      const preAddress = await bbt.fountainContractAddress()
      await bbt.changeFountainContractAddress(actAddress)
      const postAddress = await bbt.fountainContractAddress()
      assert.equal(true, postAddress != preAddress, 'the addresses should be different')
      assert.equal(postAddress, actAddress, 'the account should be set to the address of the act contract')
    })

    it('should NOT change the fountainAddress when NOT owner, NOT bbt contract, and is NOT owner address, and is a contract', async () => {
      const act = await BrickblockAccessToken.deployed()
      const actAddress = act.address

      try {
        await bbt.changeFountainContractAddress.sendTransaction(actAddress, {
          from: accounts[3]
        })
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(/invalid opcode/.test(error), 'the error should contain invalid opcode')
      }
    })

    it('should NOT change the fountainAddress when owner, NOT bbt contract, and is NOT owner address, and is NOT a contract', async () => {
      try {
        await bbt.changeFountainContractAddress(accounts[3])
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(/invalid opcode/.test(error), 'the error should contain invalid opcode')
      }
    })

    it('should NOT change the fountainAddress when owner, IS bbt contract, and is NOT owner address, and is a contract', async () => {
      try {
        await bbt.changeFountainContractAddress(bbtAddress)
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(/invalid opcode/.test(error), 'the error should contain invalid opcode')
      }
    })

    it('should NOT be able to approve company tokens for fountain if a fountain is set but the token sale is NOT finished', async () => {
      try {
        await bbt.approveCompanyTokensForFountain()
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(/invalid opcode/.test(error), 'the error should contain invalid opcode')
      }
    })

    it('should NOT let the owner claim companu tokens when block count is less than 50 (set in test network constructor in truffle.js) and token token sale has NOT finished', async () => {
      try {
        await bbt.claimCompanyTokens()
        assert(false, 'the contract should throw at this point')
      } catch (error) {
        assert(/invalid opcode/.test(error), 'the error should include invalid opcode')
      }
    })

    it('should NOT let the owner claim company tokens when the block count more than 50 (set in test network constructor in truffle.js) and the token sale has NOT finished', async () => {
      try {
        await blockTimeWarp(bbt, 50)
        await bbt.claimCompanyTokens()
        assert(false, 'the contract should throw at this point')
      } catch (error) {
        assert(/invalid opcode/.test(error), 'the error should include invalid opcode')
      }
    })
  })
})

describe('at the end of the ico', () => {
  contract('BrickblockToken', accounts => {
    let owner = accounts[0]
    let bonusAddress = accounts[1]
    let contributor1 = accounts[2]
    let contributor2 = accounts[3]
    let bbt
    let bbtAddress

    before('setup contract and relevant accounts', async () => {
      bbt = await BrickblockToken.deployed()
      bbtAddress = bbt.address
      distributeTokensToMany(bbt, accounts)
    })

    it('should set the correct values when running finalizeTokenSale', async () => {
      const preBonusBalance = await bbt.balanceOf(bonusAddress)
      const preContractBalance = await bbt.balanceOf(bbtAddress)
      const contributors = accounts.slice(4)
      const tokenAmount = new BigNumber(1e24)
      const preTotalSupply = await bbt.totalSupply()
      const companyShare = new BigNumber(35)
      const bonusShare = new BigNumber(14)
      const contributorShare = new BigNumber(51)
      const preContributorBalances = await Promise.all(
        contributors.map(async contributor => {
          const contributorBalance = await bbt.balanceOf(contributor)
          //assert.equal(contributorBalance.toString(), tokenAmount.toString(), 'the amount distributed to this address should be 1e24')
          return contributorBalance
        })

      )
      const preContributorTotalDistributed = preContributorBalances.reduce((total, balance) => {
        return total.add(balance)
      })

      await bbt.changeBonusDistributionAddress(bonusAddress)
      await bbt.finalizeTokenSale()

      const postContributorBalances = await Promise.all(
        contributors.map(async contributor => {
          const contributorBalance = await bbt.balanceOf(contributor)
          //assert.equal(contributorBalance.toString(), tokenAmount.toString(), 'the amount distributed to this address should be 1e24')
          return contributorBalance
        })

      )
      const postContributorTotalDistributed = postContributorBalances.reduce((total, balance) => {
        return total.add(balance)
      })

      const postBonusBalance = await bbt.balanceOf(bonusAddress)
      const postContractBalance = await bbt.balanceOf(bbtAddress)
      const postTotalSupply = await bbt.totalSupply()
      const totalCheck = postBonusBalance.add(postContractBalance.add(preContributorTotalDistributed))
      const postTokenSaleActive = await bbt.tokenSaleActive()
      const postPaused = await bbt.paused()
      // due to solidity integer division this is going to be slightly off... but contributors balance should remain exactly the same.
      const bonusDiff = postBonusBalance.minus(preBonusBalance).minus(postTotalSupply.times(bonusShare).div(100))
      const contributorsDiff = preContributorTotalDistributed.minus(postTotalSupply.times(contributorShare).div(100))
      const companyDiff = postContractBalance.minus(postTotalSupply.times(companyShare).div(100))
      assert(bonusDiff <= 1 || bonusDiff >=1, 'the bonus share of total tokens should be 14%')
      assert(contributorsDiff <= 1 || contributorsDiff >= 1, 'the contributors share of the total tokens should be 51%')
      assert(companyDiff <= 1 || companyDiff >= 1, 'the company share of the total tokens should be 35%')
      assert.equal(totalCheck.toString(), postTotalSupply.toString(), 'the totals should add up')
      assert.equal(postContributorTotalDistributed.toString(), preContributorTotalDistributed.toString(), 'the contribution amounts should NOT change after finalizing token sale')
      assert.equal(true, postPaused, 'the token contract should still be paused')
      assert.equal(true, !postTokenSaleActive, 'the token sale should be over')
    })

    it('should NOT be able to call finalizeTokenSale again', async () => {
      try {
        await bbt.finalizeTokenSale()
        assert(false, 'this should throw an error')
      } catch (error) {
        assert(true, /invalid opcode/.test(error), 'the error message should contain invalid opcode')
      }
    })
  })
})

describe('after the the ico', () => {
  describe('pause related functions', () => {
    contract('BrickblockToken', accounts => {
      let bbt
      let testAmount = new BigNumber(1e18)
      let bbtAddress
      let bonusAddress = accounts[1]
      before('setup BrickblockToken contract', async () => {
        bbt = await BrickblockToken.deployed()
        bbtAddress = bbt.address
        distributeTokensToMany(bbt, accounts)
        await bbt.changeBonusDistributionAddress(bonusAddress)
        await bbt.finalizeTokenSale()
      })

      it('should unpause when the owner calls unpause', async () => {
        await pauseIfPaused(bbt)
        const prePausedState = await bbt.paused.call()
        assert.equal(prePausedState, true, 'The contract should already be paused')
        await bbt.unpause()
        const postPausedState = await bbt.paused.call()
        assert.equal(postPausedState, false, 'The contract should be paused')
      })

      it('should NOT pause when non-owner calls pause', async () => {
        await pauseIfPaused(bbt)
        try {
          await bbt.pause.sendTransaction({
            from: accounts[1]
          })
        } catch(error) {
          assert.equal(true, /invalid opcode/.test(error), 'invlid opcode should be the error')
        }
      })

      it('should pause when the owner calls pause', async () => {
        await pauseIfPaused(bbt)
        const postPausedState = await bbt.paused.call()
        assert.equal(postPausedState, true, 'The contract should be paused')
      })

      it('should NOT unpause when non-owner calls pause', async () => {
        await pauseIfPaused(bbt)
        try {
          await bbt.unpause.sendTransaction({
            from: accounts[1]
          })
        } catch(error) {
          assert.equal(true, /invalid opcode/.test(error), 'invlid opcode should be the error')
        }
      })

      it('should transfer tokens when NOT paused', async () => {
        await unpauseIfPaused(bbt)
        const sender = accounts[4]
        const recipient = accounts[5]
        const preSenderBalance = await bbt.balanceOf(recipient)
        const preRecipientBalance = await bbt.balanceOf(recipient)
        const transferAmount = new BigNumber(1e18)
        await bbt.transfer.sendTransaction(recipient, transferAmount, {
          from: sender
        })
        const postSenderBalance = await bbt.balanceOf(recipient)
        const postRecipientBalance = await bbt.balanceOf(recipient)
        const newBalance = await bbt.balanceOf(recipient)
        assert.equal(postSenderBalance.minus(preSenderBalance).toString(), transferAmount.toString(), 'the sender account balance should be decremented by the transferAmount')
        assert.equal(postRecipientBalance.minus(preRecipientBalance).toString(), transferAmount.toString(), 'the recipient account balance should be incremented by the transferAmount')
      })

      it('should NOT transfer tokens when paused', async () => {
        await pauseIfPaused(bbt)
        try {
          await bbt.transfer(accounts[1], web3.toWei(1000))
          assert(false, 'should throw when paused')
        } catch(error) {
          assert.equal(true, /invalid opcode/.test(error), 'should contain invalid opcode in error')
        }
        await bbt.unpause()
      })

      it('should set allowances for other addresses', async () => {
        const preAllowance = await bbt.allowance(accounts[4], accounts[5])
        await bbt.approve.sendTransaction(accounts[5], testAmount, {
          from: accounts[4],
        })
        const postAllowance = await bbt.allowance(accounts[4], accounts[5])
        assert.equal(postAllowance.minus(preAllowance).toString(), testAmount.toString(), 'approval amount should match approval')
      })

      it('should NOT set allowances for other addresses when paused', async () => {
        await pauseIfPaused(bbt)
        try {
          await bbt.approve.sendTransaction(accounts[5], testAmount, {
            from: accounts[4]
          })
          assert(false, 'should throw when paused')
        } catch(error) {
          assert.equal(true, /invalid opcode/.test(error), 'should contain invalid opcode in error')
          await bbt.unpause()
        }
      })

      it('should increase approval when NOT paused', async () => {
        await unpauseIfPaused(bbt)
        const preAllowance = await bbt.allowance(accounts[4], accounts[5])
        await bbt.increaseApproval(accounts[5], testAmount, {
          from: accounts[4]
        })
        const postAllowance = await bbt.allowance(accounts[4], accounts[5])
        assert.equal(postAllowance.minus(preAllowance).toString(), testAmount.toString(), 'approval amount should increase by the approval amount')
      })

      it('should NOT increase approval when paused', async () => {
        await pauseIfPaused(bbt)
        try {
          await bbt.increaseApproval(accounts[5], testAmount, {
            from: accounts[4]
          })
          assert(false, 'should throw when paused')
        } catch(error) {
          assert.equal(true, /invalid opcode/.test(error), 'should contian invalid opcode in error')
          await bbt.unpause()
        }
      })

      it('should decrease approval when NOT paused', async () => {
        await unpauseIfPaused(bbt)
        const preAllowance = await bbt.allowance(accounts[4], accounts[5])
        await bbt.decreaseApproval(accounts[5], testAmount, {
          from: accounts[4]
        })
        const postAllowance = await bbt.allowance(accounts[4], accounts[5])
        assert.equal(preAllowance.minus(postAllowance).toString(), testAmount.toString(), 'approval amount decrease by approval amount')
      })

      it('should NOT decrease approval when paused', async () => {
        await pauseIfPaused(bbt)
        try {
          await bbt.decreaseApproval(accounts[5], testAmount, {
            from: accounts[4]
          })
          assert(false, 'should throw when paused')
        } catch(error) {
          assert.equal(true, /invalid opcode/.test(error), 'should contian invalid opcode in error')
          await bbt.unpause()
        }
      })

      it('should allow transferFrom when NOT paused', async () => {
        const preApproval = await bbt.allowance(accounts[4], accounts[5])
        const preApproverBalance = await bbt.balanceOf(accounts[4])
        const preRecipientBalance = await bbt.balanceOf(accounts[3])
        const approveAmount = testAmount
        const approveTransferAmount = approveAmount.div(2)
        await bbt.approve.sendTransaction(accounts[5], approveAmount, {
          from: accounts[4]
        })
        await bbt.transferFrom.sendTransaction(accounts[4], accounts[3], approveTransferAmount, {
          from: accounts[5]
        })
        const postApproval = await bbt.allowance(accounts[4], accounts[5])
        const postApproverBalance = await bbt.balanceOf(accounts[4])
        const postRecipientBalance = await bbt.balanceOf(accounts[3])
        assert.equal(postRecipientBalance.minus(preRecipientBalance).toString(), approveTransferAmount.toString(), 'the differences in balance between pre and post account 1 should be equivalent to approveTransferAmount')
        assert.equal(preApproverBalance.minus(postApproverBalance).toString(), approveTransferAmount.toString(), 'the differences in balance between pre and post account 3 should be equivalent to approveTransferAmount')
        assert.equal(preApproval.minus(postApproval).toString(), preApproval.minus(approveTransferAmount).toString(), 'the difference in allowance should be the same as the approveTransferAmount')
      })
    })
  })

  describe('non pause related functions', () => {
    contract('BrickblockToken', accounts => {
      let owner = accounts[0]
      let bonusAddress = accounts[1]
      let bbt
      let bbtAddress
      let fountainAddress

      before('setup post ico state', async () => {
        bbt = await BrickblockToken.deployed()
        bbtAddress = bbt.address
        distributeTokensToMany(bbt, accounts)
        await bbt.changeBonusDistributionAddress(bonusAddress)
        await bbt.finalizeTokenSale()
      })

      it('should NOT be able to approve company tokens for fountain the sender is NOT owner', async () => {
        try {
          await bbt.approveCompanyTokensForFountain.sendTransaction({from: accounts[2]})
          assert(false, 'the contract should throw here')
        } catch (error) {
          assert(true, /invalid opcode/.test(error), 'the error should contain invalid opcode')
        }
      })

      it('should NOT be able to approve company tokens for fountain if a fountain is NOT set and the token sale is over', async () => {
        try {
          await bbt.approveCompanyTokensForFountain()
          assert(false, 'the contract should throw here')
        } catch (error) {
          assert(true, /invalid opcode/.test(error), 'the error should contain invalid opcode')
        }
      })

      it('should be able to approve company tokens for fountain if a fountain is set and the token sale is over', async () => {
        const act = await BrickblockAccessToken.deployed()
        fountainAddress = act.address
        await bbt.changeFountainContractAddress(fountainAddress)
        const companyTokenBalance = await bbt.balanceOf(bbtAddress)
        const preAllowance = await bbt.allowance(bbtAddress, fountainAddress)
        await bbt.approveCompanyTokensForFountain()
        const postAllowance = await bbt.allowance(bbtAddress, fountainAddress)
        assert.equal(postAllowance.minus(preAllowance).toString(), companyTokenBalance.toString(), 'the entire balance of the contract which is the company\'s at this stage should be set as approved for spending by the fountain')
      })

      it('should NOT let the owner claim company funds until the block count is past 50 (set in test network constructor in truffle.js)', async () => {
        try {
          await bbt.claimCompanyTokens()
          assert(false, 'the contract should throw at this point')
        } catch (error) {
          assert(/invalid opcode/.test(error), 'the error should include invalid opcode')
        }
      })

      it('should not let a non owner claim company tokens if the block count is past 50 and the token sale is over', async () => {
        await blockTimeWarp(bbt, 50)
        try {
          await bbt.claimCompanyTokens.sendTransaction({from: accounts[4]})
          assert(false, 'the contract should throw at this point')
        } catch (error) {
          assert(/invalid opcode/.test(error), 'the error should include invalid opcode')
        }
      })

      it('should let the owner claim company tokens if the block count is past 50 and the token sale is over', async () => {
        const zeroBigNumber = new BigNumber(0)
        const preContractBalance = await bbt.balanceOf(bbtAddress)
        const preOwnerBalance = await bbt.balanceOf(owner)
        await bbt.claimCompanyTokens()
        const postContractBalance = await bbt.balanceOf(bbtAddress)
        const postOwnerBalance = await bbt.balanceOf(owner)
        assert.equal(preContractBalance.toString(), postOwnerBalance.minus(preOwnerBalance).toString(), 'the owner\'s balance should be incremented by the contract amount')
        assert.equal(zeroBigNumber.toString(), postContractBalance.toString(), 'the contract\'s balance should be 0')
      })
    })
  })
})
