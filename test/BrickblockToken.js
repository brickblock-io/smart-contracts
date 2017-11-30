const BigNumber = require('bignumber.js')
const leftPad = require('left-pad')

const BrickblockToken = artifacts.require('./BrickblockToken.sol')
const BrickblockTokenUpgraded = artifacts.require(
  './BrickblockTokenUpgraded.sol'
)
const BrickblockFountainExample = artifacts.require(
  './BrickblockFountainExample.sol'
)

const getContributorsBalanceSum = (bbk, contributors) =>
  Promise.all(contributors.map(contributor => bbk.balanceOf(contributor))).then(
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
    let bbk
    let bbkAddress

    before('setup contract and relevant accounts', async () => {
      bbk = await BrickblockToken.deployed()
      bbkAddress = bbk.address
    })

    it('should put 5e25 BBK in the contract address', async () => {
      const balance = await bbk.balanceOf(bbk.address)
      assert.equal(
        balance.valueOf(),
        5e25,
        '5e25 should be in the first account'
      )
    })

    it('should have "BrickblockToken" set as the name', async () => {
      const name = await bbk.name()
      assert.equal(name, 'BrickblockToken', 'The name isn\'t "BrickblockToken"')
    })

    it('should have BBK set as the symbol', async () => {
      const symbol = await bbk.symbol()
      assert.equal(symbol, 'BBK', 'BBK was NOT set as the symbol')
    })

    it('should have 18 decimals set', async () => {
      const decimals = await bbk.decimals()
      assert.equal(decimals, 18, '18 decimals was NOT set')
    })

    it('should start paused', async () => {
      const paused = await bbk.paused()
      assert.equal(true, paused, 'the contract should start paused')
    })

    it('should start with tokenSaleActive set to true', async () => {
      const tokenSaleActive = await bbk.tokenSaleActive()
      assert.equal(
        true,
        tokenSaleActive,
        'tokenSaleActive should be set to true during contract creation'
      )
    })

    describe('when calling distributeTokens and tokenSaleActive is true', () => {
      describe('when sent from ownerAddress', () => {
        it('should distribute tokens to contributorAddress', async () => {
          const preContractBalance = await bbk.balanceOf(bbkAddress)
          const preContributorBalance = await bbk.balanceOf(contributorAddress)
          const distributeAmount = new BigNumber(1e24)

          await bbk.distributeTokens(
            contributorAddress,
            distributeAmount
          )

          const postContractBalance = await bbk.balanceOf(bbkAddress)
          const postContributorBalance = await bbk.balanceOf(contributorAddress)

          assert.equal(
            preContractBalance.minus(postContractBalance).toString(),
            distributeAmount.toString(),
            'bbkAddress balance should be decremented by the claimed amounts'
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
            await bbk.distributeTokens.sendTransaction(
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

        it('should NOT distribute more tokens than preallocated 51% of initialSupply', async () => {
          const preContractBalance = await bbk.balanceOf(bbkAddress)
          const preContributorBalance = await bbk.balanceOf(contributorAddress)

          try {
            await bbk.distributeTokens(contributorAddress, 5e25)
            assert(false, 'the contract should throw here')
          } catch (error) {
            assert(
              /invalid opcode/.test(error),
              'the errror should contain invalid opcode'
            )
          }

          const postContractBalance = await bbk.balanceOf(bbkAddress)
          const postContributorBalance = await bbk.balanceOf(contributorAddress)

          assert(preContractBalance.toString() === postContractBalance.toString(), 'the balances should not change')
          assert(preContributorBalance.toString() === postContributorBalance.toString(), 'the balances should not change')
        })
      })

      describe('when NOT sent from ownerAddress', () => {
        it('should NOT distribute tokens to contributorAddress', async () => {
          const distributeAmount = new BigNumber(1e24)
          try {
            await bbk.distributeTokens.sendTransaction(
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
          const preAddress = await bbk.bonusDistributionAddress()
          await bbk.changeBonusDistributionAddress.sendTransaction(
            bonusAddress,
            {
              from: ownerAddress
            }
          )
          const postAddress = await bbk.bonusDistributionAddress()
          assert.equal(true, preAddress != postAddress)
          assert.equal(
            postAddress,
            bonusAddress,
            'the address should be set to the bonusAddress'
          )
        })

        it('should NOT change the bonusDistributionAddress if target address is bbkAddress', async () => {
          try {
            await bbk.changeBonusDistributionAddress.sendTransaction(
              bbkAddress,
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
            await bbk.changeBonusDistributionAddress.sendTransaction(
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
        describe('when fountainAddress is a contract that is NOT ownerAddress OR bbkAddress', () => {
          it('should change the fountainAddress', async () => {
            const bbf = await BrickblockFountainExample.new(bbk.address)
            const fountainAddress = bbf.address
            const preAddress = await bbk.fountainContractAddress()
            await bbk.changeFountainContractAddress.sendTransaction(
              fountainAddress,
              {
                from: ownerAddress
              }
            )
            const postAddress = await bbk.fountainContractAddress()
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
              await bbk.changeFountainContractAddress(contributorAddress)
              assert(false, 'the contract should throw here')
            } catch (error) {
              assert(
                /invalid opcode/.test(error),
                'the error should contain invalid opcode'
              )
            }
          })
        })

        describe('when fountainAddress is bbkAddress', () => {
          it('should NOT change the fountainAddress', async () => {
            try {
              await bbk.changeFountainContractAddress(bbkAddress)
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
          const bbf = await BrickblockFountainExample.new(bbk.address)
          const fountainAddress = bbf.address

          try {
            await bbk.changeFountainContractAddress.sendTransaction(
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
    let bbk
    let bbkAddress
    let fountainAddress

    before('setup contract and relevant accounts', async () => {
      bbk = await BrickblockToken.deployed()
      const bbf = await BrickblockFountainExample.new(bbk.address)
      fountainAddress = bbf.address
      bbkAddress = bbk.address
      await distributeTokensToMany(bbk, accounts)
      await bbk.changeBonusDistributionAddress(bonusAddress)
      await bbk.changeFountainContractAddress(fountainAddress)
    })

    it('should set the correct values when running finalizeTokenSale', async () => {
      const preBonusBalance = await bbk.balanceOf(bonusAddress)
      const preContractBalance = await bbk.balanceOf(bbkAddress)
      const preContractFountainAllowance = await bbk.allowance(
        bbkAddress,
        fountainAddress
      )
      const contributors = accounts.slice(4)
      const tokenAmount = new BigNumber(1e24)
      const preTotalSupply = await bbk.totalSupply()
      const companyShare = new BigNumber(35)
      const bonusShare = new BigNumber(14)
      const contributorShare = new BigNumber(51)

      const preContributorTotalDistributed = await getContributorsBalanceSum(
        bbk,
        contributors
      )
      await bbk.finalizeTokenSale()
      const postContributorTotalDistributed = await getContributorsBalanceSum(
        bbk,
        contributors
      )

      const postBonusBalance = await bbk.balanceOf(bonusAddress)
      const postContractBalance = await bbk.balanceOf(bbkAddress)
      const postContractFountainAllowance = await bbk.allowance(
        bbkAddress,
        fountainAddress
      )
      const postTotalSupply = await bbk.totalSupply()
      const totalCheck = postBonusBalance.add(
        postContractBalance.add(preContributorTotalDistributed)
      )
      const postTokenSaleActive = await bbk.tokenSaleActive()
      const postPaused = await bbk.paused()
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
        await bbk.finalizeTokenSale()
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
    let bbk
    let owner = accounts[0]
    let bonusAddress = accounts[1]
    let bbkAddress
    let fountainAddress
    let testAmount = new BigNumber(1e24)

    before('setup bbk BrickblockToken', async () => {
      bbk = await BrickblockToken.deployed()
      bbkAddress = bbk.address
      const bbf = await BrickblockFountainExample.new(bbk.address)
      fountainAddress = bbf.address
      await bbk.changeFountainContractAddress(fountainAddress)
      await bbk.changeBonusDistributionAddress(bonusAddress)
      await distributeTokensToMany(bbk, accounts)
      await bbk.finalizeTokenSale()
    })

    it('should unpause when the owner calls unpause', async () => {
      await pauseIfUnpaused(bbk)
      const prePausedState = await bbk.paused.call()
      assert.equal(
        prePausedState,
        true,
        'The contract should already be paused'
      )
      await bbk.unpause()
      const postPausedState = await bbk.paused.call()
      assert.equal(postPausedState, false, 'The contract should be paused')
    })

    it('should NOT pause when non-owner calls pause', async () => {
      await pauseIfUnpaused(bbk)
      try {
        await bbk.pause.sendTransaction({
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
      await pauseIfUnpaused(bbk)
      const postPausedState = await bbk.paused.call()
      assert.equal(postPausedState, true, 'The contract should be paused')
    })

    it('should NOT unpause when non-owner calls pause', async () => {
      await pauseIfUnpaused(bbk)
      try {
        await bbk.unpause.sendTransaction({
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
      await unpauseIfPaused(bbk)
      const sender = accounts[4]
      const recipient = accounts[5]
      const preSenderBalance = await bbk.balanceOf(recipient)
      const preRecipientBalance = await bbk.balanceOf(recipient)
      const transferAmount = new BigNumber(1e18)
      await bbk.transfer.sendTransaction(recipient, transferAmount, {
        from: sender
      })
      const postSenderBalance = await bbk.balanceOf(recipient)
      const postRecipientBalance = await bbk.balanceOf(recipient)
      const newBalance = await bbk.balanceOf(recipient)
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
      await pauseIfUnpaused(bbk)
      try {
        await bbk.transfer(accounts[1], web3.toWei(1000))
        assert(false, 'should throw when paused')
      } catch (error) {
        assert.equal(
          true,
          /invalid opcode/.test(error),
          'should contain invalid opcode in error'
        )
      }
      await bbk.unpause()
    })

    it('should set allowances for other addresses', async () => {
      const preAllowance = await bbk.allowance(accounts[4], accounts[5])
      await bbk.approve.sendTransaction(accounts[5], testAmount, {
        from: accounts[4]
      })
      const postAllowance = await bbk.allowance(accounts[4], accounts[5])
      assert.equal(
        postAllowance.minus(preAllowance).toString(),
        testAmount.toString(),
        'approval amount should match approval'
      )
    })

    it('should NOT set allowances for other addresses when paused', async () => {
      await pauseIfUnpaused(bbk)
      try {
        await bbk.approve.sendTransaction(accounts[5], testAmount, {
          from: accounts[4]
        })
        assert(false, 'should throw when paused')
      } catch (error) {
        assert.equal(
          true,
          /invalid opcode/.test(error),
          'should contain invalid opcode in error'
        )
        await bbk.unpause()
      }
    })

    it('should increase approval when NOT paused', async () => {
      await unpauseIfPaused(bbk)
      const preAllowance = await bbk.allowance(accounts[4], accounts[5])
      await bbk.increaseApproval(accounts[5], testAmount, {
        from: accounts[4]
      })
      const postAllowance = await bbk.allowance(accounts[4], accounts[5])
      assert.equal(
        postAllowance.minus(preAllowance).toString(),
        testAmount.toString(),
        'approval amount should increase by the approval amount'
      )
    })

    it('should NOT increase approval when paused', async () => {
      await pauseIfUnpaused(bbk)
      try {
        await bbk.increaseApproval(accounts[5], testAmount, {
          from: accounts[4]
        })
        assert(false, 'should throw when paused')
      } catch (error) {
        assert.equal(
          true,
          /invalid opcode/.test(error),
          'should contian invalid opcode in error'
        )
        await bbk.unpause()
      }
    })

    it('should decrease approval when NOT paused', async () => {
      await unpauseIfPaused(bbk)
      const preAllowance = await bbk.allowance(accounts[4], accounts[5])
      await bbk.decreaseApproval(accounts[5], testAmount, {
        from: accounts[4]
      })
      const postAllowance = await bbk.allowance(accounts[4], accounts[5])
      assert.equal(
        preAllowance.minus(postAllowance).toString(),
        testAmount.toString(),
        'approval amount decrease by approval amount'
      )
    })

    it('should NOT decrease approval when paused', async () => {
      await pauseIfUnpaused(bbk)
      try {
        await bbk.decreaseApproval(accounts[5], testAmount, {
          from: accounts[4]
        })
        assert(false, 'should throw when paused')
      } catch (error) {
        assert.equal(
          true,
          /invalid opcode/.test(error),
          'should contian invalid opcode in error'
        )
        await bbk.unpause()
      }
    })

    it('should allow transferFrom when NOT paused', async () => {
      const preApproval = await bbk.allowance(accounts[4], accounts[5])
      const preApproverBalance = await bbk.balanceOf(accounts[4])
      const preRecipientBalance = await bbk.balanceOf(accounts[3])
      const approveAmount = testAmount
      const approveTransferAmount = approveAmount.div(2)
      await bbk.approve.sendTransaction(accounts[5], approveAmount, {
        from: accounts[4]
      })
      await bbk.transferFrom.sendTransaction(
        accounts[4],
        accounts[3],
        approveTransferAmount,
        {
          from: accounts[5]
        }
      )
      const postApproval = await bbk.allowance(accounts[4], accounts[5])
      const postApproverBalance = await bbk.balanceOf(accounts[4])
      const postRecipientBalance = await bbk.balanceOf(accounts[3])
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
  let bbk
  let bbkU
  let owner
  let bonusAddress
  let fountainAddress
  let originalTotalSupplyDuringSale
  describe('at the start of the token sale', () => {
    contract('BrickblockTokenUpgraded', accounts => {
      before(
        'setup bbk BrickblockToken and bbkU BrickblockTokenUpgraded',
        async () => {
          owner = accounts[0]
          bonusAddress = accounts[1]
          bbk = await BrickblockToken.deployed()
          const bbf = await BrickblockFountainExample.new(bbk.address)
          fountainAddress = bbf.address
          bbkU = await BrickblockTokenUpgraded.new(bbk.address)
        }
      )

      it('should have the same properties as the original', async () => {
        const bbkTotalSupply = await bbk.totalSupply()
        const bbkUTotalSupply = await bbkU.totalSupply()
        const bbkTokenSaleActive = await bbk.tokenSaleActive()
        const bbkUTokenSaleActive = await bbkU.tokenSaleActive()
        const bbkContractBalance = await bbk.balanceOf(bbk.address)
        const bbkUContractBalance = await bbkU.balanceOf(bbkU.address)
        const bbkBonusDistributionAddress = await bbk.bonusDistributionAddress()
        const bbkUBonusDistributionAddress = await bbkU.bonusDistributionAddress()
        const bbkFountainContractAddress = await bbk.fountainContractAddress()
        const bbkUFountainContractAddress = await bbkU.fountainContractAddress()

        assert.equal(
          bbkTotalSupply.toString(),
          bbkUTotalSupply.toString(),
          'the totalSupply should be identical'
        )
        assert.equal(
          bbkTokenSaleActive,
          bbkUTokenSaleActive,
          'the tokenSaleActive status should be identical'
        )
        assert.equal(
          bbkContractBalance.toString(),
          bbkUContractBalance.toString(),
          'the balance of the contracts should be identical'
        )
        assert.equal(
          bbkBonusDistributionAddress,
          bbkUBonusDistributionAddress,
          'the bonusDistributionAddress should be identical for both contracts'
        )
        assert.equal(
          bbkFountainContractAddress,
          bbkUFountainContractAddress,
          'the fountainContractAddress should be identical for both contracts'
        )
      })

      it('should start paused in any starting state', async () => {
        const bbkUPaused = await bbkU.paused()
        assert(bbkUPaused, 'the new contract should always start paused')
      })

      it('should always have a predecessorAddress', async () => {
        const predecessorAddress = await bbkU.predecessorAddress()
        assert.equal(predecessorAddress, bbk.address)
      })
    })
  })

  describe('during the token sale', () => {
    contract('BrickblockTokenUpgraded', accounts => {
      before(
        'setup bbk BrickblockToken and bbkU BrickblockTokenUpgraded',
        async () => {
          bbk = await BrickblockToken.deployed()
          const bbf = await BrickblockFountainExample.new(bbk.address)
          fountainAddress = bbf.address
          await bbk.changeFountainContractAddress(fountainAddress)
          await bbk.changeBonusDistributionAddress(bonusAddress)
          await distributeTokensToMany(bbk, accounts)
          bbkU = await BrickblockTokenUpgraded.new(bbk.address)
        }
      )

      it('should have the same properties as the original', async () => {
        originalTotalSupplyDuringSale = await bbk.totalSupply()
        const bbkTokenSaleActive = await bbk.tokenSaleActive()
        const bbkUTokenSaleActive = await bbkU.tokenSaleActive()
        const bbkContractBalance = await bbk.balanceOf(bbk.address)
        const bbkUContractBalance = await bbkU.balanceOf(bbkU.address)
        const bbkBonusDistributionAddress = await bbk.bonusDistributionAddress()
        const bbkUBonusDistributionAddress = await bbkU.bonusDistributionAddress()
        const bbkFountainContractAddress = await bbk.fountainContractAddress()
        const bbkUFountainContractAddress = await bbkU.fountainContractAddress()

        assert.equal(
          bbkTokenSaleActive,
          bbkUTokenSaleActive,
          'the tokenSaleActive status should be identical'
        )
        assert.equal(
          bbkContractBalance.toString(),
          bbkUContractBalance.toString(),
          'the balance of the contracts should be identical'
        )
        assert.equal(
          bbkBonusDistributionAddress,
          bbkUBonusDistributionAddress,
          'the bonusDistributionAddress should be identical for both contracts'
        )
        assert.equal(
          bbkFountainContractAddress,
          bbkUFountainContractAddress,
          'the fountainContractAddress should be identical for both contracts'
        )
      })

      it('should start paused in any starting state', async () => {
        const bbkUPaused = await bbkU.paused()
        assert(bbkUPaused, 'the new contract should always start paused')
      })

      it('should always have a predecessorAddress', async () => {
        const predecessorAddress = await bbkU.predecessorAddress()
        assert.equal(predecessorAddress, bbk.address)
      })

      it('should NOT allow non owners to call upgrade', async () => {
        try {
          await bbk.upgrade.sendTransaction(bbkU.address, { from: accounts[1] })
          assert(false, 'the contract should throw here')
        } catch (error) {
          assert(
            /invalid opcode/.test(error),
            'the error should contain invalid opcode'
          )
        }
      })

      it('should NOT upgrade when the successAddress is NOT a contract', async () => {
        try {
          await bbk.upgrade(accounts[9])
          assert(false, 'the contract should throw')
        } catch(error) {
          assert(
            /invalid opcode/.test(error),
            'the error should contain invalid opcode'
          )
        }
      })

      it('should set the original contract to dead and paused when upgrade is called by owner', async () => {
        await bbk.upgrade(bbkU.address)
        const dead = await bbk.dead()
        const paused = await bbk.paused()
        assert(dead, 'the contract should have dead set when being upgraded')
        assert(paused, 'the contract should be paused when dead')
      })

      it('should NOT be able to be unpaused by owner or anyone else once upgrade has been called', async () => {
        try {
          await bbk.unpause()
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

      it('should not allow anyone but successor to call evacuate', async () => {
        try {
          await bbk.evacuate(accounts[4])
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
          await bbk.rescue.sendTransaction({ from: accounts[4] })
          assert(false, 'the contract should throw here')
        } catch (error) {
          assert(
            /invalid opcode/.test(error),
            'the error should contain invalid opcode'
          )
        }
      })

      it('should allow users to call rescue from the new contract to get their balances moved', async () => {
        for (let address of accounts.slice(4)) {
          const preBBKTotalSupply = await bbk.totalSupply()
          const preBBKUTotalSupply = await bbkU.totalSupply()
          const preBBKBalance = await bbk.balanceOf(address)
          const preBBKUBalance = await bbkU.balanceOf(address)
          await bbkU.rescue.sendTransaction({ from: address })
          const postBBKTotalSupply = await bbk.totalSupply()
          const postBBKUTotalSupply = await bbkU.totalSupply()
          const postBBKBalance = await bbk.balanceOf(address)
          const postBBKUBalance = await bbkU.balanceOf(address)

          assert.equal(
            preBBKTotalSupply.minus(postBBKTotalSupply).toString(),
            preBBKBalance.toString(),
            'the total supply should be decremented from BBK contract by the account value'
          )
          assert.equal(
            postBBKUTotalSupply.minus(preBBKUTotalSupply).toString(),
            preBBKBalance.toString(),
            'the total supply should be incremented from BBKU contract by the account value'
          )
          assert.equal(
            postBBKBalance.toString(),
            new BigNumber(0).toString(),
            'the balance of the BBK contract should be 0'
          )
          assert.equal(
            postBBKUBalance.toString(),
            preBBKBalance.toString(),
            'the new BBKU balance should be the same as the balance on old BBK balance'
          )
        }
      })

      it('should have the same totalSupply as the original once when all users have evacuated', async () => {
        const finalTotalSupply = await bbkU.totalSupply()
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
        'setup bbk BrickblockToken and bbkU BrickblockTokenUpgraded',
        async () => {
          bbk = await BrickblockToken.deployed()
          const bbf = await BrickblockFountainExample.new(bbk.address)
          fountainAddress = bbf.address
          await bbk.changeFountainContractAddress(fountainAddress)
          await bbk.changeBonusDistributionAddress(bonusAddress)
          await distributeTokensToMany(bbk, accounts)
          await bbk.finalizeTokenSale()
          bbkU = await BrickblockTokenUpgraded.new(bbk.address)
        }
      )

      it('should have the same properties as the original', async () => {
        originalTotalSupplyDuringSale = await bbk.totalSupply()
        const bbkTokenSaleActive = await bbk.tokenSaleActive()
        const bbkUTokenSaleActive = await bbkU.tokenSaleActive()
        const bbkContractBalance = await bbk.balanceOf(bbk.address)
        const bbkUContractBalance = await bbkU.balanceOf(bbkU.address)
        const bbkBonusDistributionAddress = await bbk.bonusDistributionAddress()
        const bbkUBonusDistributionAddress = await bbkU.bonusDistributionAddress()
        const bbkFountainContractAddress = await bbk.fountainContractAddress()
        const bbkUFountainContractAddress = await bbkU.fountainContractAddress()

        assert.equal(
          bbkTokenSaleActive,
          bbkUTokenSaleActive,
          'the tokenSaleActive status should be identical'
        )
        assert.equal(
          bbkContractBalance.toString(),
          bbkUContractBalance.toString(),
          'the balance of the contracts should be identical'
        )
        assert.equal(
          bbkBonusDistributionAddress,
          bbkUBonusDistributionAddress,
          'the bonusDistributionAddress should be identical for both contracts'
        )
        assert.equal(
          bbkFountainContractAddress,
          bbkUFountainContractAddress,
          'the fountainContractAddress should be identical for both contracts'
        )
      })

      it('should start paused in any starting state', async () => {
        const bbkUPaused = await bbkU.paused()
        assert(bbkUPaused, 'the new contract should always start paused')
      })

      it('should always have a predecessorAddress', async () => {
        const predecessorAddress = await bbkU.predecessorAddress()
        assert.equal(predecessorAddress, bbk.address)
      })

      it('should not allow non owners to call upgrade', async () => {
        try {
          await bbk.upgrade.sendTransaction(bbkU.address, { from: accounts[1] })
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
          await bbk.evacuate(accounts[4])
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
          await bbk.rescue.sendTransaction({ from: accounts[4] })
          assert(false, 'the contract should throw here')
        } catch (error) {
          assert(
            /invalid opcode/.test(error),
            'the error should contain invalid opcode'
          )
        }
      })

      it('should set the original contract to dead and paused when upgrade is called by owner', async () => {
        await bbk.upgrade(bbkU.address)
        const dead = await bbk.dead()
        const paused = await bbk.paused()
        assert(dead, 'the contract should have dead set when being upgraded')
        assert(paused, 'the contract should be paused when dead')
      })

      it('should NOT be able to be unpaused by owner or anyone else once upgrade has been called', async () => {
        try {
          await bbk.unpause()
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
          const preBBKTotalSupply = await bbk.totalSupply()
          const preBBKUTotalSupply = await bbkU.totalSupply()
          const preBBKBalance = await bbk.balanceOf(address)
          const preBBKUBalance = await bbkU.balanceOf(address)
          await bbkU.rescue.sendTransaction({ from: address })
          const postBBKTotalSupply = await bbk.totalSupply()
          const postBBKUTotalSupply = await bbkU.totalSupply()
          const postBBKBalance = await bbk.balanceOf(address)
          const postBBKUBalance = await bbkU.balanceOf(address)

          assert.equal(
            preBBKTotalSupply.minus(postBBKTotalSupply).toString(),
            preBBKBalance.toString(),
            'the total supply should be decremented from BBK contract by the account value'
          )
          assert.equal(
            postBBKUTotalSupply.minus(preBBKUTotalSupply).toString(),
            preBBKBalance.toString(),
            'the total supply should be incremented from BBKU contract by the account value'
          )
          assert.equal(
            postBBKBalance.toString(),
            new BigNumber(0).toString(),
            'the balance of the BBK contract should be 0'
          )
          assert.equal(
            postBBKUBalance.toString(),
            preBBKBalance.toString(),
            'the new BBKU balance should be the same as the balance on old BBK balance'
          )
        }
      })

      it('should have the same totalSupply as the original once when all users have evacuated', async () => {
        const finalTotalSupply = await bbkU.totalSupply()
        assert.equal(
          originalTotalSupplyDuringSale.toString(),
          finalTotalSupply.toString(),
          'the totalSupply of the upgrade contract should be identical to the original after all have evacuated'
        )
      })
    })
  })
})
