const BigNumber = require('bignumber.js')
const leftPad = require('left-pad')

const BrickblockToken = artifacts.require('./BrickblockToken.sol')
const BrickblockTokenUpgraded = artifacts.require(
  './BrickblockTokenUpgraded.sol'
)
const BrickblockAccessToken = artifacts.require('./BrickBlockAccessToken.sol')
const BrickblockFountain = artifacts.require('./BrickblockFountain.sol')

async function distributeTokensToMany(contract, accounts) {
  const distributeAmount = new BigNumber(1e24)
  const addresses = accounts.slice(4)
  await Promise.all(
    addresses.map(address =>
      contract.distributeTokens(address, distributeAmount)
    )
  )
  console.log(`sent tokens to ${addresses.length} accounts`)
}

function unpauseIfPaused(contract) {
  return new Promise(resolve => {
    contract
      .paused()
      .then(paused => {
        if (paused) contract.unpause()
      })
      .then(resolve)
  })
}

function pauseIfUnpaused(contract) {
  return new Promise(resolve => {
    contract
      .paused()
      .then(paused => {
        if (!paused) contract.pause()
      })
      .then(resolve)
  })
}

function togglePause(contract) {
  return new Promise(resolve => {
    contract
      .paused()
      .then(paused => {
        if (paused) {
          contract.unpause()
        } else {
          contract.pause()
        }
      })
      .then(resolve)
  })
}

// spam pause/unpause on the contract to move block count along in testrpc (every transaction creates new block)
async function blockTimeWarp(contract, blocks) {
  for (i = 0; i < blocks; i++) {
    await togglePause(contract)
  }
}

describe('during the ico', () => {
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

    it('should put 5e25 BBT in the contract address', async () => {
      const balance = await bbt.balanceOf(bbt.address)
      assert.equal(
        balance.valueOf(),
        5e25,
        '5e25 should be in the first account'
      )
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
      assert.equal(
        true,
        tokenSaleActive,
        'tokenSaleActive should be set to true during contract creation'
      )
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

      assert.equal(
        preContractBalance.minus(postContractBalance).toString(),
        distributeAmount1.add(distributeAmount2).toString(),
        'the contract balance should be decremented by the claimed amounts'
      )
      assert.equal(
        postContributor1Balance.minus(preContributor1Balance).toString(),
        distributeAmount1.toString(),
        'contributor1 token balance should be incremented by the claim amount'
      )
      assert.equal(
        postContributor2Balance.minus(preContributor2Balance).toString(),
        distributeAmount2.toString(),
        'contributor2 token balance should be incremented by the claim amount'
      )
    })

    it('should NOT distribute tokens to designated address when NOT owner', async () => {
      const distributeAmount = new BigNumber(1e24)
      try {
        await bbt.distributeTokens.sendTransaction(
          contributor1,
          distributeAmount,
          { from: contributor1 }
        )
        assert(false, 'the contract should throw in this case')
      } catch (error) {
        assert.equal(
          true,
          /invalid opcode/.test(error),
          'invalid opcode should be the error'
        )
      }

      try {
        await bbt.distributeTokens.sendTransaction(
          contributor1,
          distributeAmount,
          { from: contributor2 }
        )
        assert(false, 'the contract should throw in this case')
      } catch (error) {
        assert.equal(
          true,
          /invalid opcode/.test(error),
          'invalid opcode should be the error'
        )
      }
    })

    it('should NOT distribute tokens to designated address when the target address is the owner address', async () => {
      const distributeAmount = new BigNumber(1e24)
      try {
        await bbt.distributeTokens(owner, distributeAmount)
        assert(false, 'the contract should throw in this case')
      } catch (error) {
        assert.equal(
          true,
          /invalid opcode/.test(error),
          'invalid opcode should be the error'
        )
      }
    })

    it('should change the bonusDistributionAddress', async () => {
      const preAddress = await bbt.bonusDistributionAddress()
      await bbt.changeBonusDistributionAddress(accounts[1])
      const postAddress = await bbt.bonusDistributionAddress()
      assert.equal(true, preAddress != postAddress)
      assert.equal(
        postAddress,
        accounts[1],
        'the address should be set to the third account in wallet'
      )
    })

    it('should NOT change the bonusDistributionAddress if NOT owner', async () => {
      try {
        await bbt.changeBonusDistributionAddress.sendTransaction(accounts[3], {
          from: accounts[4]
        })
        assert(false, 'the contract should throw in this case')
      } catch (error) {
        assert.equal(
          true,
          /invalid opcode/.test(error),
          'invalid opcode should be the error'
        )
      }
    })

    it('should NOT change the bonusDistributionAddress is the contract itself', async () => {
      try {
        await bbt.changeBonusDistributionAddress(bbtAddress)
        assert(false, 'the contract should throw in this case')
      } catch (error) {
        assert.equal(
          true,
          /invalid opcode/.test(error),
          'invalid opcode should be the error'
        )
      }
    })

    it('should change the fountainAddress when owner, NOT bbt contract, and is NOT owner address, and is a contract', async () => {
      const bbf = await BrickblockFountain.deployed()
      const fountainAddress = bbf.address
      const preAddress = await bbt.fountainContractAddress()
      await bbt.changeFountainContractAddress(fountainAddress)
      const postAddress = await bbt.fountainContractAddress()
      assert.equal(
        true,
        postAddress != preAddress,
        'the addresses should be different'
      )
      assert.equal(
        postAddress,
        fountainAddress,
        'the account should be set to the address of the act contract'
      )
    })

    it('should NOT change the fountainAddress when NOT owner, NOT bbt contract, and is NOT owner address, and is a contract', async () => {
      const bbf = await BrickblockFountain.deployed()
      const fountainAddress = bbf.address

      try {
        await bbt.changeFountainContractAddress.sendTransaction(
          fountainAddress,
          {
            from: accounts[3]
          }
        )
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error should contain invalid opcode'
        )
      }
    })

    it('should NOT change the fountainAddress when owner, NOT bbt contract, and is NOT owner address, and is NOT a contract', async () => {
      try {
        await bbt.changeFountainContractAddress(accounts[3])
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error should contain invalid opcode'
        )
      }
    })

    it('should NOT change the fountainAddress when owner, IS bbt contract, and is NOT owner address, and is a contract', async () => {
      try {
        await bbt.changeFountainContractAddress(bbtAddress)
        assert(false, 'the contract should throw here')
      } catch (error) {
        assert(
          /invalid opcode/.test(error),
          'the error should contain invalid opcode'
        )
      }
    })
  })
})

describe('at the end of the ico', () => {
  contract('BrickblockToken', accounts => {
    let owner = accounts[0]
    let bonusAddress = accounts[1]
    let bbt
    let bbtAddress
    let fountainAddress
    before('setup contract and relevant accounts', async () => {
      bbt = await BrickblockToken.deployed()
      const bbf = await BrickblockFountain.deployed()
      fountainAddress = bbf.address
      bbtAddress = bbt.address
      await distributeTokensToMany(bbt, accounts)
      await bbt.changeBonusDistributionAddress(bonusAddress)
      await bbt.changeFountainContractAddress(fountainAddress)
    })

    it('should set the correct values when running finalizeTokenSale', async () => {
      const preBonusBalance = await bbt.balanceOf(bonusAddress)
      const preContractBalance = await bbt.balanceOf(bbtAddress)
      const preContractFountainAllowance = await bbt.allowance(
        bbtAddress,
        fountainAddress
      )
      const contributors = accounts.slice(4)
      const tokenAmount = new BigNumber(1e24)
      const preTotalSupply = await bbt.totalSupply()
      const companyShare = new BigNumber(35)
      const bonusShare = new BigNumber(14)
      const contributorShare = new BigNumber(51)
      const preContributorBalances = await Promise.all(
        contributors.map(async contributor => {
          const contributorBalance = await bbt.balanceOf(contributor)
          return contributorBalance
        })
      )
      const preContributorTotalDistributed = preContributorBalances.reduce(
        (total, balance) => {
          return total.add(balance)
        }
      )
      await bbt.finalizeTokenSale()
      const postContributorBalances = await Promise.all(
        contributors.map(async contributor => {
          const contributorBalance = await bbt.balanceOf(contributor)
          return contributorBalance
        })
      )
      const postContributorTotalDistributed = postContributorBalances.reduce(
        (total, balance) => {
          return total.add(balance)
        }
      )

      const postBonusBalance = await bbt.balanceOf(bonusAddress)
      const postContractBalance = await bbt.balanceOf(bbtAddress)
      const postContractFountainAllowance = await bbt.allowance(
        bbtAddress,
        fountainAddress
      )
      const postTotalSupply = await bbt.totalSupply()
      const totalCheck = postBonusBalance.add(
        postContractBalance.add(preContributorTotalDistributed)
      )
      const postTokenSaleActive = await bbt.tokenSaleActive()
      const postPaused = await bbt.paused()
      // due to solidity integer division this is going to be slightly off... but contributors balance should remain exactly the same.
      const bonusDiff = postBonusBalance
        .minus(preBonusBalance)
        .minus(postTotalSupply.times(bonusShare).div(100))
      const contributorsDiff = preContributorTotalDistributed.minus(
        postTotalSupply.times(contributorShare).div(100)
      )
      const companyDiff = postContractBalance.minus(
        postTotalSupply.times(companyShare).div(100)
      )
      assert(
        bonusDiff <= 1 || bonusDiff >= 1,
        'the bonus share of total tokens should be 14%'
      )
      assert(
        contributorsDiff <= 1 || contributorsDiff >= 1,
        'the contributors share of the total tokens should be 51%'
      )
      assert(
        companyDiff <= 1 || companyDiff >= 1,
        'the company share of the total tokens should be 35%'
      )
      assert.equal(
        totalCheck.toString(),
        postTotalSupply.toString(),
        'the totals should add up'
      )
      assert.equal(
        postContributorTotalDistributed.toString(),
        preContributorTotalDistributed.toString(),
        'the contribution amounts should NOT change after finalizing token sale'
      )
      assert(postPaused, 'the token contract should still be paused')
      assert(!postTokenSaleActive, 'the token sale should be over')
      assert.equal(
        postContractFountainAllowance
          .sub(preContractFountainAllowance)
          .toString(),
        postContractBalance.toString(),
        'the remaining contract balance should be approved to be spent by the fountain contract address'
      )
    })

    it('should NOT be able to call finalizeTokenSale again', async () => {
      try {
        await bbt.finalizeTokenSale()
        assert(false, 'this should throw an error')
      } catch (error) {
        assert(
          true,
          /invalid opcode/.test(error),
          'the error message should contain invalid opcode'
        )
      }
    })
  })
})

describe('after the the ico', () => {
  describe('pause related functions', () => {
    contract('BrickblockToken', accounts => {
      let bbt
      let owner = accounts[0]
      let bonusAddress = accounts[1]
      let bbtAddress
      let fountainAddress
      let testAmount = new BigNumber(1e24)

      before('setup bbt BrickblockToken', async () => {
        bbt = await BrickblockToken.deployed()
        bbtAddress = bbt.address
        const bbf = await BrickblockFountain.deployed()
        fountainAddress = bbf.address
        await bbt.changeFountainContractAddress(fountainAddress)
        await bbt.changeBonusDistributionAddress(bonusAddress)
        await distributeTokensToMany(bbt, accounts)
        await bbt.finalizeTokenSale()
      })

      it('should unpause when the owner calls unpause', async () => {
        await pauseIfUnpaused(bbt)
        const prePausedState = await bbt.paused.call()
        assert.equal(
          prePausedState,
          true,
          'The contract should already be paused'
        )
        await bbt.unpause()
        const postPausedState = await bbt.paused.call()
        assert.equal(postPausedState, false, 'The contract should be paused')
      })

      it('should NOT pause when non-owner calls pause', async () => {
        await pauseIfUnpaused(bbt)
        try {
          await bbt.pause.sendTransaction({
            from: accounts[1]
          })
        } catch (error) {
          assert.equal(
            true,
            /invalid opcode/.test(error),
            'invlid opcode should be the error'
          )
        }
      })

      it('should pause when the owner calls pause', async () => {
        await pauseIfUnpaused(bbt)
        const postPausedState = await bbt.paused.call()
        assert.equal(postPausedState, true, 'The contract should be paused')
      })

      it('should NOT unpause when non-owner calls pause', async () => {
        await pauseIfUnpaused(bbt)
        try {
          await bbt.unpause.sendTransaction({
            from: accounts[1]
          })
        } catch (error) {
          assert.equal(
            true,
            /invalid opcode/.test(error),
            'invlid opcode should be the error'
          )
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
        assert.equal(
          postSenderBalance.minus(preSenderBalance).toString(),
          transferAmount.toString(),
          'the sender account balance should be decremented by the transferAmount'
        )
        assert.equal(
          postRecipientBalance.minus(preRecipientBalance).toString(),
          transferAmount.toString(),
          'the recipient account balance should be incremented by the transferAmount'
        )
      })

      it('should NOT transfer tokens when paused', async () => {
        await pauseIfUnpaused(bbt)
        try {
          await bbt.transfer(accounts[1], web3.toWei(1000))
          assert(false, 'should throw when paused')
        } catch (error) {
          assert.equal(
            true,
            /invalid opcode/.test(error),
            'should contain invalid opcode in error'
          )
        }
        await bbt.unpause()
      })

      it('should set allowances for other addresses', async () => {
        const preAllowance = await bbt.allowance(accounts[4], accounts[5])
        await bbt.approve.sendTransaction(accounts[5], testAmount, {
          from: accounts[4]
        })
        const postAllowance = await bbt.allowance(accounts[4], accounts[5])
        assert.equal(
          postAllowance.minus(preAllowance).toString(),
          testAmount.toString(),
          'approval amount should match approval'
        )
      })

      it('should NOT set allowances for other addresses when paused', async () => {
        await pauseIfUnpaused(bbt)
        try {
          await bbt.approve.sendTransaction(accounts[5], testAmount, {
            from: accounts[4]
          })
          assert(false, 'should throw when paused')
        } catch (error) {
          assert.equal(
            true,
            /invalid opcode/.test(error),
            'should contain invalid opcode in error'
          )
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
        assert.equal(
          postAllowance.minus(preAllowance).toString(),
          testAmount.toString(),
          'approval amount should increase by the approval amount'
        )
      })

      it('should NOT increase approval when paused', async () => {
        await pauseIfUnpaused(bbt)
        try {
          await bbt.increaseApproval(accounts[5], testAmount, {
            from: accounts[4]
          })
          assert(false, 'should throw when paused')
        } catch (error) {
          assert.equal(
            true,
            /invalid opcode/.test(error),
            'should contian invalid opcode in error'
          )
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
        assert.equal(
          preAllowance.minus(postAllowance).toString(),
          testAmount.toString(),
          'approval amount decrease by approval amount'
        )
      })

      it('should NOT decrease approval when paused', async () => {
        await pauseIfUnpaused(bbt)
        try {
          await bbt.decreaseApproval(accounts[5], testAmount, {
            from: accounts[4]
          })
          assert(false, 'should throw when paused')
        } catch (error) {
          assert.equal(
            true,
            /invalid opcode/.test(error),
            'should contian invalid opcode in error'
          )
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
        await bbt.transferFrom.sendTransaction(
          accounts[4],
          accounts[3],
          approveTransferAmount,
          {
            from: accounts[5]
          }
        )
        const postApproval = await bbt.allowance(accounts[4], accounts[5])
        const postApproverBalance = await bbt.balanceOf(accounts[4])
        const postRecipientBalance = await bbt.balanceOf(accounts[3])
        assert.equal(
          postRecipientBalance.minus(preRecipientBalance).toString(),
          approveTransferAmount.toString(),
          'the differences in balance between pre and post account 1 should be equivalent to approveTransferAmount'
        )
        assert.equal(
          preApproverBalance.minus(postApproverBalance).toString(),
          approveTransferAmount.toString(),
          'the differences in balance between pre and post account 3 should be equivalent to approveTransferAmount'
        )
        assert.equal(
          preApproval.minus(postApproval).toString(),
          preApproval.minus(approveTransferAmount).toString(),
          'the difference in allowance should be the same as the approveTransferAmount'
        )
      })
    })
  })

  describe('non pause related functions', () => {
    contract('BrickblockToken', accounts => {
      let bbt
      let owner = accounts[0]
      let bonusAddress = accounts[1]
      let fountainAddress
      let bbtAddress

      before(
        'setup bbt BrickblockToken and bbtU BrickblockTokenUpgraded',
        async () => {
          bbt = await BrickblockToken.deployed()
          bbtAddress = bbt.address
          bbtU = await BrickblockTokenUpgraded.deployed()
          const bbf = await BrickblockFountain.deployed()
          fountainAddress = bbf.address
          await bbt.changeFountainContractAddress(fountainAddress)
          await bbt.changeBonusDistributionAddress(bonusAddress)
          await distributeTokensToMany(bbt, accounts)
          await bbt.finalizeTokenSale()
        }
      )
    })
  })
})

describe('in case of emergency or upgrade', () => {
  let bbt
  let bbtU
  let owner
  let bonusAddress
  let fountainAddress
  let originalTotalSupplyDuringSale
  describe('at the start of the token sale', () => {
    contract('BrickblockTokenUpgraded', accounts => {
      before(
        'setup bbt BrickblockToken and bbtU BrickblockTokenUpgraded',
        async () => {
          owner = accounts[0]
          bonusAddress = accounts[1]
          bbt = await BrickblockToken.deployed()
          const bbf = await BrickblockFountain.deployed()
          fountainAddress = bbf.address
          bbtU = await BrickblockTokenUpgraded.new(bbt.address)
        }
      )

      it('should have the same properties as the original', async () => {
        const bbtTotalSupply = await bbt.totalSupply()
        const bbtUTotalSupply = await bbtU.totalSupply()
        const bbtTokenSaleActive = await bbt.tokenSaleActive()
        const bbtUTokenSaleActive = await bbtU.tokenSaleActive()
        const bbtContractBalance = await bbt.balanceOf(bbt.address)
        const bbtUContractBalance = await bbtU.balanceOf(bbtU.address)
        const bbtBonusDistributionAddress = await bbt.bonusDistributionAddress()
        const bbtUBonusDistributionAddress = await bbtU.bonusDistributionAddress()
        const bbtFountainContractAddress = await bbt.fountainContractAddress()
        const bbtUFountainContractAddress = await bbtU.fountainContractAddress()

        assert.equal(
          bbtTotalSupply.toString(),
          bbtUTotalSupply.toString(),
          'the totalSupply should be identical'
        )
        assert.equal(
          bbtTokenSaleActive,
          bbtUTokenSaleActive,
          'the tokenSaleActive status should be identical'
        )
        assert.equal(
          bbtContractBalance.toString(),
          bbtUContractBalance.toString(),
          'the balance of the contracts should be identical'
        )
        assert.equal(
          bbtBonusDistributionAddress,
          bbtUBonusDistributionAddress,
          'the bonusDistributionAddress should be identical for both contracts'
        )
        assert.equal(
          bbtFountainContractAddress,
          bbtUFountainContractAddress,
          'the fountainContractAddress should be identical for both contracts'
        )
      })

      it('should start paused in any starting state', async () => {
        const bbtUPaused = await bbtU.paused()
        assert(bbtUPaused, 'the new contract should always start paused')
      })

      it('should always have a predecessorAddress', async () => {
        const predecessorAddress = await bbtU.predecessorAddress()
        assert.equal(predecessorAddress, bbt.address)
      })
    })
  })

  describe('during the token sale', () => {
    contract('BrickblockTokenUpgraded', accounts => {
      before(
        'setup bbt BrickblockToken and bbtU BrickblockTokenUpgraded',
        async () => {
          bbt = await BrickblockToken.deployed()
          const bbf = await BrickblockFountain.deployed()
          fountainAddress = bbf.address
          await bbt.changeFountainContractAddress(fountainAddress)
          await bbt.changeBonusDistributionAddress(bonusAddress)
          await distributeTokensToMany(bbt, accounts)
          bbtU = await BrickblockTokenUpgraded.new(bbt.address)
        }
      )

      it('should have the same properties as the original', async () => {
        originalTotalSupplyDuringSale = await bbt.totalSupply()
        const bbtTokenSaleActive = await bbt.tokenSaleActive()
        const bbtUTokenSaleActive = await bbtU.tokenSaleActive()
        const bbtContractBalance = await bbt.balanceOf(bbt.address)
        const bbtUContractBalance = await bbtU.balanceOf(bbtU.address)
        const bbtBonusDistributionAddress = await bbt.bonusDistributionAddress()
        const bbtUBonusDistributionAddress = await bbtU.bonusDistributionAddress()
        const bbtFountainContractAddress = await bbt.fountainContractAddress()
        const bbtUFountainContractAddress = await bbtU.fountainContractAddress()

        assert.equal(
          bbtTokenSaleActive,
          bbtUTokenSaleActive,
          'the tokenSaleActive status should be identical'
        )
        assert.equal(
          bbtContractBalance.toString(),
          bbtUContractBalance.toString(),
          'the balance of the contracts should be identical'
        )
        assert.equal(
          bbtBonusDistributionAddress,
          bbtUBonusDistributionAddress,
          'the bonusDistributionAddress should be identical for both contracts'
        )
        assert.equal(
          bbtFountainContractAddress,
          bbtUFountainContractAddress,
          'the fountainContractAddress should be identical for both contracts'
        )
      })

      it('should start paused in any starting state', async () => {
        const bbtUPaused = await bbtU.paused()
        assert(bbtUPaused, 'the new contract should always start paused')
      })

      it('should always have a predecessorAddress', async () => {
        const predecessorAddress = await bbtU.predecessorAddress()
        assert.equal(predecessorAddress, bbt.address)
      })

      it('should not allow non owners to call upgrade', async () => {
        try {
          await bbt.upgrade.sendTransaction(bbtU.address, { from: accounts[1] })
          assert(false, 'the contract should throw here')
        } catch (error) {
          assert(
            /invalid opcode/.test(error),
            'the error should contain invalid opcode'
          )
        }
      })

      it('should not allow anyone but successor to call evacuate', async () => {
        try {
          await bbt.evacuate(accounts[4])
          assert(false, 'the contract should throw here')
        } catch (error) {
          assert(
            /invalid opcode/.test(error),
            'the error should contain invalid opcode'
          )
        }
      })

      it('should not allow rescue to be called on original contract when there is no predecessor', async () => {
        try {
          await bbt.rescue.sendTransaction({ from: accounts[4] })
          assert(false, 'the contract should throw here')
        } catch (error) {
          assert(
            /invalid opcode/.test(error),
            'the error should contain invalid opcode'
          )
        }
      })

      it('should set the original contract to dead and paused when upgrade is called by owner', async () => {
        await bbt.upgrade(bbtU.address)
        const dead = await bbt.dead()
        const paused = await bbt.paused()
        assert(dead, 'the contract should have dead set when being upgraded')
        assert(paused, 'the contract should be paused when dead')
      })

      it('should NOT be able to be unpaused by owner or anyone else once upgrade has been called', async () => {
        try {
          await bbt.unpause()
          assert(
            false,
            'the contract should NOT be able to be unpaused if dead'
          )
        } catch (error) {
          assert.equal(
            true,
            /invalid opcode/.test(error),
            'the error should contain invalid opcode'
          )
        }
      })

      it('should allow users to call rescue from the new contract to get their balances moved', async () => {
        for (let address of accounts.slice(4)) {
          const preBBTTotalSupply = await bbt.totalSupply()
          const preBBTUTotalSupply = await bbtU.totalSupply()
          const preBBTBalance = await bbt.balanceOf(address)
          const preBBTUBalance = await bbtU.balanceOf(address)
          await bbtU.rescue.sendTransaction({ from: address })
          const postBBTTotalSupply = await bbt.totalSupply()
          const postBBTUTotalSupply = await bbtU.totalSupply()
          const postBBTBalance = await bbt.balanceOf(address)
          const postBBTUBalance = await bbtU.balanceOf(address)

          assert.equal(
            preBBTTotalSupply.minus(postBBTTotalSupply).toString(),
            preBBTBalance.toString(),
            'the total supply should be decremented from BBT contract by the account value'
          )
          assert.equal(
            postBBTUTotalSupply.minus(preBBTUTotalSupply).toString(),
            preBBTBalance.toString(),
            'the total supply should be incremented from BBTU contract by the account value'
          )
          assert.equal(
            postBBTBalance.toString(),
            new BigNumber(0).toString(),
            'the balance of the BBT contract should be 0'
          )
          assert.equal(
            postBBTUBalance.toString(),
            preBBTBalance.toString(),
            'the new BBTU balance should be the same as the balance on old BBT balance'
          )
        }
      })

      it('should have the same totalSupply as the original once when all users have evacuated', async () => {
        const finalTotalSupply = await bbtU.totalSupply()
        assert.equal(
          originalTotalSupplyDuringSale.toString(),
          finalTotalSupply.toString(),
          'the totalSupply of the upgrade contract should be identical to the original after all have evacuated'
        )
      })
    })
  })

  describe('after the token sale has finished', () => {
    contract('BrickblockTokenUpgraded', accounts => {
      before(
        'setup bbt BrickblockToken and bbtU BrickblockTokenUpgraded',
        async () => {
          bbt = await BrickblockToken.deployed()
          const bbf = await BrickblockFountain.deployed()
          fountainAddress = bbf.address
          await bbt.changeFountainContractAddress(fountainAddress)
          await bbt.changeBonusDistributionAddress(bonusAddress)
          await distributeTokensToMany(bbt, accounts)
          await bbt.finalizeTokenSale()
          bbtU = await BrickblockTokenUpgraded.new(bbt.address)
        }
      )

      it('should have the same properties as the original', async () => {
        originalTotalSupplyDuringSale = await bbt.totalSupply()
        const bbtTokenSaleActive = await bbt.tokenSaleActive()
        const bbtUTokenSaleActive = await bbtU.tokenSaleActive()
        const bbtContractBalance = await bbt.balanceOf(bbt.address)
        const bbtUContractBalance = await bbtU.balanceOf(bbtU.address)
        const bbtBonusDistributionAddress = await bbt.bonusDistributionAddress()
        const bbtUBonusDistributionAddress = await bbtU.bonusDistributionAddress()
        const bbtFountainContractAddress = await bbt.fountainContractAddress()
        const bbtUFountainContractAddress = await bbtU.fountainContractAddress()

        assert.equal(
          bbtTokenSaleActive,
          bbtUTokenSaleActive,
          'the tokenSaleActive status should be identical'
        )
        assert.equal(
          bbtContractBalance.toString(),
          bbtUContractBalance.toString(),
          'the balance of the contracts should be identical'
        )
        assert.equal(
          bbtBonusDistributionAddress,
          bbtUBonusDistributionAddress,
          'the bonusDistributionAddress should be identical for both contracts'
        )
        assert.equal(
          bbtFountainContractAddress,
          bbtUFountainContractAddress,
          'the fountainContractAddress should be identical for both contracts'
        )
      })

      it('should start paused in any starting state', async () => {
        const bbtUPaused = await bbtU.paused()
        assert(bbtUPaused, 'the new contract should always start paused')
      })

      it('should always have a predecessorAddress', async () => {
        const predecessorAddress = await bbtU.predecessorAddress()
        assert.equal(predecessorAddress, bbt.address)
      })

      it('should not allow non owners to call upgrade', async () => {
        try {
          await bbt.upgrade.sendTransaction(bbtU.address, { from: accounts[1] })
          assert(false, 'the contract should throw here')
        } catch (error) {
          assert(
            /invalid opcode/.test(error),
            'the error should contain invalid opcode'
          )
        }
      })

      it('should not allow anyone but successor to call evacuate', async () => {
        try {
          await bbt.evacuate(accounts[4])
          assert(false, 'the contract should throw here')
        } catch (error) {
          assert(
            /invalid opcode/.test(error),
            'the error should contain invalid opcode'
          )
        }
      })

      it('should not allow rescue to be called on original contract when there is no predecessor', async () => {
        try {
          await bbt.rescue.sendTransaction({ from: accounts[4] })
          assert(false, 'the contract should throw here')
        } catch (error) {
          assert(
            /invalid opcode/.test(error),
            'the error should contain invalid opcode'
          )
        }
      })

      it('should set the original contract to dead and paused when upgrade is called by owner', async () => {
        await bbt.upgrade(bbtU.address)
        const dead = await bbt.dead()
        const paused = await bbt.paused()
        assert(dead, 'the contract should have dead set when being upgraded')
        assert(paused, 'the contract should be paused when dead')
      })

      it('should NOT be able to be unpaused by owner or anyone else once upgrade has been called', async () => {
        try {
          await bbt.unpause()
          assert(
            false,
            'the contract should NOT be able to be unpaused if dead'
          )
        } catch (error) {
          assert.equal(
            true,
            /invalid opcode/.test(error),
            'the error should contain invalid opcode'
          )
        }
      })

      it('should allow users to call rescue from the new contract to get their balances moved', async () => {
        // need to account for bonus address in this scenario when finalizeTokenSale has been called
        for (let address of [accounts[1], ...accounts.slice(4)]) {
          const preBBTTotalSupply = await bbt.totalSupply()
          const preBBTUTotalSupply = await bbtU.totalSupply()
          const preBBTBalance = await bbt.balanceOf(address)
          const preBBTUBalance = await bbtU.balanceOf(address)
          await bbtU.rescue.sendTransaction({ from: address })
          const postBBTTotalSupply = await bbt.totalSupply()
          const postBBTUTotalSupply = await bbtU.totalSupply()
          const postBBTBalance = await bbt.balanceOf(address)
          const postBBTUBalance = await bbtU.balanceOf(address)

          assert.equal(
            preBBTTotalSupply.minus(postBBTTotalSupply).toString(),
            preBBTBalance.toString(),
            'the total supply should be decremented from BBT contract by the account value'
          )
          assert.equal(
            postBBTUTotalSupply.minus(preBBTUTotalSupply).toString(),
            preBBTBalance.toString(),
            'the total supply should be incremented from BBTU contract by the account value'
          )
          assert.equal(
            postBBTBalance.toString(),
            new BigNumber(0).toString(),
            'the balance of the BBT contract should be 0'
          )
          assert.equal(
            postBBTUBalance.toString(),
            preBBTBalance.toString(),
            'the new BBTU balance should be the same as the balance on old BBT balance'
          )
        }
      })

      it('should have the same totalSupply as the original once when all users have evacuated', async () => {
        const finalTotalSupply = await bbtU.totalSupply()
        assert.equal(
          originalTotalSupplyDuringSale.toString(),
          finalTotalSupply.toString(),
          'the totalSupply of the upgrade contract should be identical to the original after all have evacuated'
        )
      })
    })
  })
})
