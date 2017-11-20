const BigNumber = require('bignumber.js')
const leftPad = require('left-pad')

const BrickblockToken = artifacts.require('./BrickblockToken.sol')
const BrickblockTokenUpgraded = artifacts.require(
  './BrickblockTokenUpgraded.sol'
)
const BrickblockFountainExample = artifacts.require(
  './BrickblockFountainExample.sol'
)

const getContributorsBalanceSum = (brk, contributors) =>
  Promise.all(contributors.map(contributor => brk.balanceOf(contributor))).then(
    postContributorBalances =>
      postContributorBalances.reduce(
        (total, balance) => total.add(balance),
        new BigNumber(0)
      )
  )

async function distributeTokensToMany(contract, accounts) {
  const distributeAmount = new BigNumber(1e24)
  const addresses = accounts.slice(4)
  await Promise.all(
    addresses.map(address =>
      contract.distributeTokens(address, distributeAmount)
    )
  )
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

describe('during the ico', () => {
  contract('BrickblockToken', accounts => {
    let ownerAddress = accounts[0]
    let bonusAddress = accounts[1]
    let contributorAddress = accounts[2]
    let brk
    let brkAddress

    before('setup contract and relevant accounts', async () => {
      brk = await BrickblockToken.deployed()
      brkAddress = brk.address
    })

    it('should put 5e25 BRK in the contract address', async () => {
      const balance = await brk.balanceOf(brk.address)
      assert.equal(
        balance.valueOf(),
        5e25,
        '5e25 should be in the first account'
      )
    })

    it('should have "BrickblockToken" set as the name', async () => {
      const name = await brk.name()
      assert.equal(name, 'BrickblockToken', 'The name isn\'t "BrickblockToken"')
    })

    it('should have BRK set as the symbol', async () => {
      const symbol = await brk.symbol()
      assert.equal(symbol, 'BRK', 'BRK was NOT set as the symbol')
    })

    it('should have 18 decimals set', async () => {
      const decimals = await brk.decimals()
      assert.equal(decimals, 18, '18 decimals was NOT set')
    })

    it('should start paused', async () => {
      const paused = await brk.paused()
      assert.equal(true, paused, 'the contract should start paused')
    })

    it('should start with tokenSaleActive set to true', async () => {
      const tokenSaleActive = await brk.tokenSaleActive()
      assert.equal(
        true,
        tokenSaleActive,
        'tokenSaleActive should be set to true during contract creation'
      )
    })

    describe('when calling distributeTokens and tokenSaleActive is true', () => {
      describe('when sent from ownerAddress', () => {
        it('should distribute tokens to contributorAddress', async () => {
          const preContractBalance = await brk.balanceOf(brkAddress)
          const preContributorBalance = await brk.balanceOf(contributorAddress)
          const distributeAmount = new BigNumber(1e24)

          await brk.distributeTokens.sendTransaction(
            contributorAddress,
            distributeAmount,
            { from: ownerAddress }
          )

          const postContractBalance = await brk.balanceOf(brkAddress)
          const postContributorBalance = await brk.balanceOf(contributorAddress)

          assert.equal(
            preContractBalance.minus(postContractBalance).toString(),
            distributeAmount.toString(),
            'brkAddress balance should be decremented by the claimed amounts'
          )
          assert.equal(
            postContributorBalance.minus(preContributorBalance).toString(),
            distributeAmount.toString(),
            'contributorAddress balance should be incremented by the claim amount'
          )
        })

        it('should NOT distribute tokens to ownerAddress', async () => {
          const distributeAmount = new BigNumber(1e24)
          try {
            await brk.distributeTokens.sendTransaction(
              ownerAddress,
              distributeAmount,
              {
                from: ownerAddress
              }
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
      })

      describe('when NOT sent from ownerAddress', () => {
        it('should NOT distribute tokens to contributorAddress', async () => {
          const distributeAmount = new BigNumber(1e24)
          try {
            await brk.distributeTokens.sendTransaction(
              contributorAddress,
              distributeAmount,
              { from: contributorAddress }
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
      })
    })

    describe('when calling bonusDistributionAddress', () => {
      describe('when sent from ownerAddress', () => {
        it('should change the bonusDistributionAddress', async () => {
          const preAddress = await brk.bonusDistributionAddress()
          await brk.changeBonusDistributionAddress.sendTransaction(
            bonusAddress,
            {
              from: ownerAddress
            }
          )
          const postAddress = await brk.bonusDistributionAddress()
          assert.equal(true, preAddress != postAddress)
          assert.equal(
            postAddress,
            bonusAddress,
            'the address should be set to the bonusAddress'
          )
        })

        it('should NOT change the bonusDistributionAddress if target address is brkAddress', async () => {
          try {
            await brk.changeBonusDistributionAddress.sendTransaction(
              brkAddress,
              {
                from: ownerAddress
              }
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
      })

      describe('when NOT sent from ownerAddress', () => {
        it('should NOT change the bonusDistributionAddress', async () => {
          try {
            await brk.changeBonusDistributionAddress.sendTransaction(
              bonusAddress,
              {
                from: contributorAddress
              }
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
      })
    })

    describe('when calling changeFountainContractAddress', () => {
      describe('when sent from ownerAddress', () => {
        describe('when fountainAddress is a contract that is NOT ownerAddress OR brkAddress', () => {
          it('should change the fountainAddress', async () => {
            const bbf = await BrickblockFountainExample.new(brk.address)
            const fountainAddress = bbf.address
            const preAddress = await brk.fountainContractAddress()
            await brk.changeFountainContractAddress.sendTransaction(
              fountainAddress,
              {
                from: ownerAddress
              }
            )
            const postAddress = await brk.fountainContractAddress()
            assert.equal(
              true,
              postAddress != preAddress,
              'the addresses should be different'
            )
            assert.equal(
              postAddress,
              fountainAddress,
              'the address should be the fountain contract'
            )
          })
        })

        describe('when fountainAddress is NOT a contract', () => {
          it('should NOT change the fountainAddress', async () => {
            try {
              await brk.changeFountainContractAddress(contributorAddress)
              assert(false, 'the contract should throw here')
            } catch (error) {
              assert(
                /invalid opcode/.test(error),
                'the error should contain invalid opcode'
              )
            }
          })
        })

        describe('when fountainAddress is brkAddress', () => {
          it('should NOT change the fountainAddress', async () => {
            try {
              await brk.changeFountainContractAddress(brkAddress)
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

      describe('when NOT sent from ownerAddress', () => {
        it('should NOT change the fountainAddress', async () => {
          const bbf = await BrickblockFountainExample.new(brk.address)
          const fountainAddress = bbf.address

          try {
            await brk.changeFountainContractAddress.sendTransaction(
              fountainAddress,
              {
                from: contributorAddress
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
      })
    })
  })
})

describe('at the end of the ico when bonusAddress and fountainAddress have been set', () => {
  contract('BrickblockToken', accounts => {
    let owner = accounts[0]
    let bonusAddress = accounts[1]
    let brk
    let brkAddress
    let fountainAddress

    before('setup contract and relevant accounts', async () => {
      brk = await BrickblockToken.deployed()
      const bbf = await BrickblockFountainExample.new(brk.address)
      fountainAddress = bbf.address
      brkAddress = brk.address
      await distributeTokensToMany(brk, accounts)
      await brk.changeBonusDistributionAddress(bonusAddress)
      await brk.changeFountainContractAddress(fountainAddress)
    })

    it('should set the correct values when running finalizeTokenSale', async () => {
      const preBonusBalance = await brk.balanceOf(bonusAddress)
      const preContractBalance = await brk.balanceOf(brkAddress)
      const preContractFountainAllowance = await brk.allowance(
        brkAddress,
        fountainAddress
      )
      const contributors = accounts.slice(4)
      const tokenAmount = new BigNumber(1e24)
      const preTotalSupply = await brk.totalSupply()
      const companyShare = new BigNumber(35)
      const bonusShare = new BigNumber(14)
      const contributorShare = new BigNumber(51)

      const preContributorTotalDistributed = await getContributorsBalanceSum(
        brk,
        contributors
      )
      await brk.finalizeTokenSale()
      const postContributorTotalDistributed = await getContributorsBalanceSum(
        brk,
        contributors
      )

      const postBonusBalance = await brk.balanceOf(bonusAddress)
      const postContractBalance = await brk.balanceOf(brkAddress)
      const postContractFountainAllowance = await brk.allowance(
        brkAddress,
        fountainAddress
      )
      const postTotalSupply = await brk.totalSupply()
      const totalCheck = postBonusBalance.add(
        postContractBalance.add(preContributorTotalDistributed)
      )
      const postTokenSaleActive = await brk.tokenSaleActive()
      const postPaused = await brk.paused()
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
        await brk.finalizeTokenSale()
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
  contract('BrickblockToken', accounts => {
    let brk
    let owner = accounts[0]
    let bonusAddress = accounts[1]
    let brkAddress
    let fountainAddress
    let testAmount = new BigNumber(1e24)

    before('setup brk BrickblockToken', async () => {
      brk = await BrickblockToken.deployed()
      brkAddress = brk.address
      const bbf = await BrickblockFountainExample.new(brk.address)
      fountainAddress = bbf.address
      await brk.changeFountainContractAddress(fountainAddress)
      await brk.changeBonusDistributionAddress(bonusAddress)
      await distributeTokensToMany(brk, accounts)
      await brk.finalizeTokenSale()
    })

    it('should unpause when the owner calls unpause', async () => {
      await pauseIfUnpaused(brk)
      const prePausedState = await brk.paused.call()
      assert.equal(
        prePausedState,
        true,
        'The contract should already be paused'
      )
      await brk.unpause()
      const postPausedState = await brk.paused.call()
      assert.equal(postPausedState, false, 'The contract should be paused')
    })

    it('should NOT pause when non-owner calls pause', async () => {
      await pauseIfUnpaused(brk)
      try {
        await brk.pause.sendTransaction({
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
      await pauseIfUnpaused(brk)
      const postPausedState = await brk.paused.call()
      assert.equal(postPausedState, true, 'The contract should be paused')
    })

    it('should NOT unpause when non-owner calls pause', async () => {
      await pauseIfUnpaused(brk)
      try {
        await brk.unpause.sendTransaction({
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
      await unpauseIfPaused(brk)
      const sender = accounts[4]
      const recipient = accounts[5]
      const preSenderBalance = await brk.balanceOf(recipient)
      const preRecipientBalance = await brk.balanceOf(recipient)
      const transferAmount = new BigNumber(1e18)
      await brk.transfer.sendTransaction(recipient, transferAmount, {
        from: sender
      })
      const postSenderBalance = await brk.balanceOf(recipient)
      const postRecipientBalance = await brk.balanceOf(recipient)
      const newBalance = await brk.balanceOf(recipient)
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
      await pauseIfUnpaused(brk)
      try {
        await brk.transfer(accounts[1], web3.toWei(1000))
        assert(false, 'should throw when paused')
      } catch (error) {
        assert.equal(
          true,
          /invalid opcode/.test(error),
          'should contain invalid opcode in error'
        )
      }
      await brk.unpause()
    })

    it('should set allowances for other addresses', async () => {
      const preAllowance = await brk.allowance(accounts[4], accounts[5])
      await brk.approve.sendTransaction(accounts[5], testAmount, {
        from: accounts[4]
      })
      const postAllowance = await brk.allowance(accounts[4], accounts[5])
      assert.equal(
        postAllowance.minus(preAllowance).toString(),
        testAmount.toString(),
        'approval amount should match approval'
      )
    })

    it('should NOT set allowances for other addresses when paused', async () => {
      await pauseIfUnpaused(brk)
      try {
        await brk.approve.sendTransaction(accounts[5], testAmount, {
          from: accounts[4]
        })
        assert(false, 'should throw when paused')
      } catch (error) {
        assert.equal(
          true,
          /invalid opcode/.test(error),
          'should contain invalid opcode in error'
        )
        await brk.unpause()
      }
    })

    it('should increase approval when NOT paused', async () => {
      await unpauseIfPaused(brk)
      const preAllowance = await brk.allowance(accounts[4], accounts[5])
      await brk.increaseApproval(accounts[5], testAmount, {
        from: accounts[4]
      })
      const postAllowance = await brk.allowance(accounts[4], accounts[5])
      assert.equal(
        postAllowance.minus(preAllowance).toString(),
        testAmount.toString(),
        'approval amount should increase by the approval amount'
      )
    })

    it('should NOT increase approval when paused', async () => {
      await pauseIfUnpaused(brk)
      try {
        await brk.increaseApproval(accounts[5], testAmount, {
          from: accounts[4]
        })
        assert(false, 'should throw when paused')
      } catch (error) {
        assert.equal(
          true,
          /invalid opcode/.test(error),
          'should contian invalid opcode in error'
        )
        await brk.unpause()
      }
    })

    it('should decrease approval when NOT paused', async () => {
      await unpauseIfPaused(brk)
      const preAllowance = await brk.allowance(accounts[4], accounts[5])
      await brk.decreaseApproval(accounts[5], testAmount, {
        from: accounts[4]
      })
      const postAllowance = await brk.allowance(accounts[4], accounts[5])
      assert.equal(
        preAllowance.minus(postAllowance).toString(),
        testAmount.toString(),
        'approval amount decrease by approval amount'
      )
    })

    it('should NOT decrease approval when paused', async () => {
      await pauseIfUnpaused(brk)
      try {
        await brk.decreaseApproval(accounts[5], testAmount, {
          from: accounts[4]
        })
        assert(false, 'should throw when paused')
      } catch (error) {
        assert.equal(
          true,
          /invalid opcode/.test(error),
          'should contian invalid opcode in error'
        )
        await brk.unpause()
      }
    })

    it('should allow transferFrom when NOT paused', async () => {
      const preApproval = await brk.allowance(accounts[4], accounts[5])
      const preApproverBalance = await brk.balanceOf(accounts[4])
      const preRecipientBalance = await brk.balanceOf(accounts[3])
      const approveAmount = testAmount
      const approveTransferAmount = approveAmount.div(2)
      await brk.approve.sendTransaction(accounts[5], approveAmount, {
        from: accounts[4]
      })
      await brk.transferFrom.sendTransaction(
        accounts[4],
        accounts[3],
        approveTransferAmount,
        {
          from: accounts[5]
        }
      )
      const postApproval = await brk.allowance(accounts[4], accounts[5])
      const postApproverBalance = await brk.balanceOf(accounts[4])
      const postRecipientBalance = await brk.balanceOf(accounts[3])
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

describe('in case of emergency or upgrade', () => {
  let brk
  let brkU
  let owner
  let bonusAddress
  let fountainAddress
  let originalTotalSupplyDuringSale
  describe('at the start of the token sale', () => {
    contract('BrickblockTokenUpgraded', accounts => {
      before(
        'setup brk BrickblockToken and brkU BrickblockTokenUpgraded',
        async () => {
          owner = accounts[0]
          bonusAddress = accounts[1]
          brk = await BrickblockToken.deployed()
          const bbf = await BrickblockFountainExample.new(brk.address)
          fountainAddress = bbf.address
          brkU = await BrickblockTokenUpgraded.new(brk.address)
        }
      )

      it('should have the same properties as the original', async () => {
        const brkTotalSupply = await brk.totalSupply()
        const brkUTotalSupply = await brkU.totalSupply()
        const brkTokenSaleActive = await brk.tokenSaleActive()
        const brkUTokenSaleActive = await brkU.tokenSaleActive()
        const brkContractBalance = await brk.balanceOf(brk.address)
        const brkUContractBalance = await brkU.balanceOf(brkU.address)
        const brkBonusDistributionAddress = await brk.bonusDistributionAddress()
        const brkUBonusDistributionAddress = await brkU.bonusDistributionAddress()
        const brkFountainContractAddress = await brk.fountainContractAddress()
        const brkUFountainContractAddress = await brkU.fountainContractAddress()

        assert.equal(
          brkTotalSupply.toString(),
          brkUTotalSupply.toString(),
          'the totalSupply should be identical'
        )
        assert.equal(
          brkTokenSaleActive,
          brkUTokenSaleActive,
          'the tokenSaleActive status should be identical'
        )
        assert.equal(
          brkContractBalance.toString(),
          brkUContractBalance.toString(),
          'the balance of the contracts should be identical'
        )
        assert.equal(
          brkBonusDistributionAddress,
          brkUBonusDistributionAddress,
          'the bonusDistributionAddress should be identical for both contracts'
        )
        assert.equal(
          brkFountainContractAddress,
          brkUFountainContractAddress,
          'the fountainContractAddress should be identical for both contracts'
        )
      })

      it('should start paused in any starting state', async () => {
        const brkUPaused = await brkU.paused()
        assert(brkUPaused, 'the new contract should always start paused')
      })

      it('should always have a predecessorAddress', async () => {
        const predecessorAddress = await brkU.predecessorAddress()
        assert.equal(predecessorAddress, brk.address)
      })
    })
  })

  describe('during the token sale', () => {
    contract('BrickblockTokenUpgraded', accounts => {
      before(
        'setup brk BrickblockToken and brkU BrickblockTokenUpgraded',
        async () => {
          brk = await BrickblockToken.deployed()
          const bbf = await BrickblockFountainExample.new(brk.address)
          fountainAddress = bbf.address
          await brk.changeFountainContractAddress(fountainAddress)
          await brk.changeBonusDistributionAddress(bonusAddress)
          await distributeTokensToMany(brk, accounts)
          brkU = await BrickblockTokenUpgraded.new(brk.address)
        }
      )

      it('should have the same properties as the original', async () => {
        originalTotalSupplyDuringSale = await brk.totalSupply()
        const brkTokenSaleActive = await brk.tokenSaleActive()
        const brkUTokenSaleActive = await brkU.tokenSaleActive()
        const brkContractBalance = await brk.balanceOf(brk.address)
        const brkUContractBalance = await brkU.balanceOf(brkU.address)
        const brkBonusDistributionAddress = await brk.bonusDistributionAddress()
        const brkUBonusDistributionAddress = await brkU.bonusDistributionAddress()
        const brkFountainContractAddress = await brk.fountainContractAddress()
        const brkUFountainContractAddress = await brkU.fountainContractAddress()

        assert.equal(
          brkTokenSaleActive,
          brkUTokenSaleActive,
          'the tokenSaleActive status should be identical'
        )
        assert.equal(
          brkContractBalance.toString(),
          brkUContractBalance.toString(),
          'the balance of the contracts should be identical'
        )
        assert.equal(
          brkBonusDistributionAddress,
          brkUBonusDistributionAddress,
          'the bonusDistributionAddress should be identical for both contracts'
        )
        assert.equal(
          brkFountainContractAddress,
          brkUFountainContractAddress,
          'the fountainContractAddress should be identical for both contracts'
        )
      })

      it('should start paused in any starting state', async () => {
        const brkUPaused = await brkU.paused()
        assert(brkUPaused, 'the new contract should always start paused')
      })

      it('should always have a predecessorAddress', async () => {
        const predecessorAddress = await brkU.predecessorAddress()
        assert.equal(predecessorAddress, brk.address)
      })

      it('should not allow non owners to call upgrade', async () => {
        try {
          await brk.upgrade.sendTransaction(brkU.address, { from: accounts[1] })
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
          await brk.evacuate(accounts[4])
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
          await brk.rescue.sendTransaction({ from: accounts[4] })
          assert(false, 'the contract should throw here')
        } catch (error) {
          assert(
            /invalid opcode/.test(error),
            'the error should contain invalid opcode'
          )
        }
      })

      it('should set the original contract to dead and paused when upgrade is called by owner', async () => {
        await brk.upgrade(brkU.address)
        const dead = await brk.dead()
        const paused = await brk.paused()
        assert(dead, 'the contract should have dead set when being upgraded')
        assert(paused, 'the contract should be paused when dead')
      })

      it('should NOT be able to be unpaused by owner or anyone else once upgrade has been called', async () => {
        try {
          await brk.unpause()
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
          const preBRKTotalSupply = await brk.totalSupply()
          const preBRKUTotalSupply = await brkU.totalSupply()
          const preBRKBalance = await brk.balanceOf(address)
          const preBRKUBalance = await brkU.balanceOf(address)
          await brkU.rescue.sendTransaction({ from: address })
          const postBRKTotalSupply = await brk.totalSupply()
          const postBRKUTotalSupply = await brkU.totalSupply()
          const postBRKBalance = await brk.balanceOf(address)
          const postBRKUBalance = await brkU.balanceOf(address)

          assert.equal(
            preBRKTotalSupply.minus(postBRKTotalSupply).toString(),
            preBRKBalance.toString(),
            'the total supply should be decremented from BRK contract by the account value'
          )
          assert.equal(
            postBRKUTotalSupply.minus(preBRKUTotalSupply).toString(),
            preBRKBalance.toString(),
            'the total supply should be incremented from BRKU contract by the account value'
          )
          assert.equal(
            postBRKBalance.toString(),
            new BigNumber(0).toString(),
            'the balance of the BRK contract should be 0'
          )
          assert.equal(
            postBRKUBalance.toString(),
            preBRKBalance.toString(),
            'the new BRKU balance should be the same as the balance on old BRK balance'
          )
        }
      })

      it('should have the same totalSupply as the original once when all users have evacuated', async () => {
        const finalTotalSupply = await brkU.totalSupply()
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
        'setup brk BrickblockToken and brkU BrickblockTokenUpgraded',
        async () => {
          brk = await BrickblockToken.deployed()
          const bbf = await BrickblockFountainExample.new(brk.address)
          fountainAddress = bbf.address
          await brk.changeFountainContractAddress(fountainAddress)
          await brk.changeBonusDistributionAddress(bonusAddress)
          await distributeTokensToMany(brk, accounts)
          await brk.finalizeTokenSale()
          brkU = await BrickblockTokenUpgraded.new(brk.address)
        }
      )

      it('should have the same properties as the original', async () => {
        originalTotalSupplyDuringSale = await brk.totalSupply()
        const brkTokenSaleActive = await brk.tokenSaleActive()
        const brkUTokenSaleActive = await brkU.tokenSaleActive()
        const brkContractBalance = await brk.balanceOf(brk.address)
        const brkUContractBalance = await brkU.balanceOf(brkU.address)
        const brkBonusDistributionAddress = await brk.bonusDistributionAddress()
        const brkUBonusDistributionAddress = await brkU.bonusDistributionAddress()
        const brkFountainContractAddress = await brk.fountainContractAddress()
        const brkUFountainContractAddress = await brkU.fountainContractAddress()

        assert.equal(
          brkTokenSaleActive,
          brkUTokenSaleActive,
          'the tokenSaleActive status should be identical'
        )
        assert.equal(
          brkContractBalance.toString(),
          brkUContractBalance.toString(),
          'the balance of the contracts should be identical'
        )
        assert.equal(
          brkBonusDistributionAddress,
          brkUBonusDistributionAddress,
          'the bonusDistributionAddress should be identical for both contracts'
        )
        assert.equal(
          brkFountainContractAddress,
          brkUFountainContractAddress,
          'the fountainContractAddress should be identical for both contracts'
        )
      })

      it('should start paused in any starting state', async () => {
        const brkUPaused = await brkU.paused()
        assert(brkUPaused, 'the new contract should always start paused')
      })

      it('should always have a predecessorAddress', async () => {
        const predecessorAddress = await brkU.predecessorAddress()
        assert.equal(predecessorAddress, brk.address)
      })

      it('should not allow non owners to call upgrade', async () => {
        try {
          await brk.upgrade.sendTransaction(brkU.address, { from: accounts[1] })
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
          await brk.evacuate(accounts[4])
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
          await brk.rescue.sendTransaction({ from: accounts[4] })
          assert(false, 'the contract should throw here')
        } catch (error) {
          assert(
            /invalid opcode/.test(error),
            'the error should contain invalid opcode'
          )
        }
      })

      it('should set the original contract to dead and paused when upgrade is called by owner', async () => {
        await brk.upgrade(brkU.address)
        const dead = await brk.dead()
        const paused = await brk.paused()
        assert(dead, 'the contract should have dead set when being upgraded')
        assert(paused, 'the contract should be paused when dead')
      })

      it('should NOT be able to be unpaused by owner or anyone else once upgrade has been called', async () => {
        try {
          await brk.unpause()
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
          const preBRKTotalSupply = await brk.totalSupply()
          const preBRKUTotalSupply = await brkU.totalSupply()
          const preBRKBalance = await brk.balanceOf(address)
          const preBRKUBalance = await brkU.balanceOf(address)
          await brkU.rescue.sendTransaction({ from: address })
          const postBRKTotalSupply = await brk.totalSupply()
          const postBRKUTotalSupply = await brkU.totalSupply()
          const postBRKBalance = await brk.balanceOf(address)
          const postBRKUBalance = await brkU.balanceOf(address)

          assert.equal(
            preBRKTotalSupply.minus(postBRKTotalSupply).toString(),
            preBRKBalance.toString(),
            'the total supply should be decremented from BRK contract by the account value'
          )
          assert.equal(
            postBRKUTotalSupply.minus(preBRKUTotalSupply).toString(),
            preBRKBalance.toString(),
            'the total supply should be incremented from BRKU contract by the account value'
          )
          assert.equal(
            postBRKBalance.toString(),
            new BigNumber(0).toString(),
            'the balance of the BRK contract should be 0'
          )
          assert.equal(
            postBRKUBalance.toString(),
            preBRKBalance.toString(),
            'the new BRKU balance should be the same as the balance on old BRK balance'
          )
        }
      })

      it('should have the same totalSupply as the original once when all users have evacuated', async () => {
        const finalTotalSupply = await brkU.totalSupply()
        assert.equal(
          originalTotalSupplyDuringSale.toString(),
          finalTotalSupply.toString(),
          'the totalSupply of the upgrade contract should be identical to the original after all have evacuated'
        )
      })
    })
  })
})
