const BigNumber = require('bignumber.js')

const BrickblockToken = artifacts.require('./BrickblockToken.sol')
const BrickblockFountainStub = artifacts.require(
  './stubs/BrickblockFountainStub.sol'
)
const { testWillThrow, waitForTxToBeMined } = require('../helpers/general')

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
  return new Promise((resolve, reject) => {
    contract
      .paused()
      .then(paused => {
        if (paused) {
          return contract.unpause()
        }

        return
      })
      .then(resolve)
      .catch(reject)
  })
}

function pauseIfUnpaused(contract) {
  return new Promise((resolve, reject) => {
    contract
      .paused()
      .then(paused => {
        if (!paused) {
          return contract.pause()
        }

        return
      })
      .then(resolve)
      .catch(reject)
  })
}

// constants
const bonusShare = 14
const companyShare = 35
const tokenTotal = new BigNumber(5e26)
const bonusTokens = tokenTotal.mul(bonusShare).div(100)
const companyTokens = tokenTotal.mul(companyShare).div(100)
const initialContractBalance = tokenTotal.minus(bonusTokens)
const distributableTokens = tokenTotal.minus(bonusTokens).minus(companyTokens)

describe('during the ico', () => {
  contract('BrickblockToken', accounts => {
    const ownerAddress = accounts[0]
    const bonusAddress = accounts[1]
    const contributorAddress = accounts[2]
    let bbk
    let bbkAddress

    before('setup contract and relevant accounts', async () => {
      bbk = await BrickblockToken.new(bonusAddress)
      bbkAddress = bbk.address
    })

    it('should put the correct amount BBK in the contract address', async () => {
      const balance = await bbk.balanceOf(bbk.address)
      assert.equal(
        balance.toString(),
        initialContractBalance.toString(),
        `${initialContractBalance} should be in the contract account`
      )
    })

    it('should put the correct amount of BBK in the bonusAddress', async () => {
      const balance = await bbk.balanceOf(bonusAddress)
      assert.equal(
        balance.toString(),
        bonusTokens.toString(),
        `${bonusTokens} should be in the bonusAddress`
      )
    })

    it('should have the correct bonusTokens set', async () => {
      const actualBonusTokens = await bbk.bonusTokens()
      assert.equal(
        actualBonusTokens.toString(),
        bonusTokens.toString(),
        'the bonus tokens should match'
      )
    })

    it('should have the correct companyTokens set', async () => {
      const actualCompanyTokens = await bbk.companyTokens()
      assert.equal(
        actualCompanyTokens.toString(),
        companyTokens.toString(),
        'the company tokens should match'
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

    describe('when calling toggleDead and tokenSaleActive is true', () => {
      it('should toggle dead when owner', async () => {
        const preDead = await bbk.dead()

        const txHash = await bbk.toggleDead.sendTransaction({
          from: ownerAddress
        })
        await waitForTxToBeMined(txHash)

        const postDead = await bbk.dead()

        assert(preDead != postDead, 'dead should be toggled')
      })

      it('should toggle back dead when owner', async () => {
        const preDead = await bbk.dead()

        const txHash = await bbk.toggleDead.sendTransaction({
          from: ownerAddress
        })
        await waitForTxToBeMined(txHash)

        const postDead = await bbk.dead()

        assert(preDead != postDead, 'dead should be toggled')
      })

      it('should NOT toggle dead when not owner', async () => {
        await testWillThrow(bbk.toggleDead, [{ from: accounts[9] }])
      })
    })

    describe('when calling distributeBonusTokens and tokenSaleActive is true', () => {
      describe('when NOT sent from ownerAddress', () => {
        it('should NOT distribute tokens to bonusRecipientAddress', async () => {
          const bonusRecipientAddress = accounts[9]
          const distributeAmount = new BigNumber(1e19)

          await testWillThrow(bbk.distributeBonusTokens, [
            bonusRecipientAddress,
            distributeAmount,
            {
              from: bonusAddress
            }
          ])
        })
      })

      describe('when sent from ownerAddress', () => {
        it('should NOT distribute tokens to owner', async () => {
          const distributeAmount = new BigNumber(1e19)

          await testWillThrow(bbk.distributeBonusTokens, [
            ownerAddress,
            distributeAmount,
            {
              from: ownerAddress
            }
          ])
        })

        it('should distribute tokens to bonusRecipientAddress', async () => {
          const bonusRecipientAddress = accounts[9]
          const preRecipientBalance = await bbk.balanceOf(bonusRecipientAddress)
          const preBonusBalance = await bbk.balanceOf(bonusAddress)
          const distributeAmount = bonusTokens

          const txHash = await bbk.distributeBonusTokens.sendTransaction(
            bonusRecipientAddress,
            distributeAmount,
            {
              from: ownerAddress
            }
          )
          await waitForTxToBeMined(txHash)

          const postRecipientBalance = await bbk.balanceOf(
            bonusRecipientAddress
          )
          const postBonusBalance = await bbk.balanceOf(bonusAddress)

          assert.equal(
            postRecipientBalance.minus(preRecipientBalance).toString(),
            distributeAmount.toString(),
            'the bonus recipient balance should be incremented by the distribute amount'
          )

          assert.equal(
            preBonusBalance.minus(postBonusBalance).toString(),
            distributeAmount.toString(),
            'the bonus account balance should be decremented by the distribute amount'
          )
        })

        it('should NOT distribute more tokens due to previous block distribution', async () => {
          const bonusRecipientAddress = accounts[9]
          const overDistributeAmount = new BigNumber(1)

          await testWillThrow(bbk.distributeBonusTokens, [
            bonusRecipientAddress,
            overDistributeAmount,
            {
              from: ownerAddress
            }
          ])
        })
      })
    })

    describe('when calling distributeTokens and tokenSaleActive is true', () => {
      describe('when NOT sent from ownerAddress', () => {
        it('should NOT distribute tokens to contributorAddress', async () => {
          const distributeAmount = new BigNumber(1e24)

          await testWillThrow(bbk.distributeTokens, [
            contributorAddress,
            distributeAmount,
            {
              from: contributorAddress
            }
          ])
        })
      })

      describe('when sent from ownerAddress', () => {
        it('should NOT distribute tokens to ownerAddress', async () => {
          const distributeAmount = new BigNumber(1e18)

          await testWillThrow(bbk.distributeTokens, [
            ownerAddress,
            distributeAmount,
            {
              from: ownerAddress
            }
          ])
        })

        it('should distribute tokens to contributorAddress', async () => {
          const preContractBalance = await bbk.balanceOf(bbkAddress)
          const preContributorBalance = await bbk.balanceOf(contributorAddress)
          const distributeAmount = distributableTokens

          await bbk.distributeTokens(contributorAddress, distributeAmount)

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

        it('should NOT distribute more tokens than distributable tokens (all already distributed in previous block)', async () => {
          const preContractBalance = await bbk.balanceOf(bbkAddress)
          const preContributorBalance = await bbk.balanceOf(contributorAddress)
          const distributeAmount = new BigNumber(1)

          await testWillThrow(bbk.distributeTokens, [
            contributorAddress,
            distributeAmount
          ])

          const postContractBalance = await bbk.balanceOf(bbkAddress)
          const postContributorBalance = await bbk.balanceOf(contributorAddress)

          assert(
            preContractBalance.toString() === postContractBalance.toString(),
            'the balances should not change'
          )
          assert(
            preContributorBalance.toString() ===
              postContributorBalance.toString(),
            'the balances should not change'
          )
        })
      })
    })

    describe('when calling changeFountainContractAddress', () => {
      describe('when sent from ownerAddress', () => {
        describe('when fountainAddress is a contract that is NOT ownerAddress OR bbkAddress', () => {
          it('should change the fountainAddress', async () => {
            const bbf = await BrickblockFountainStub.new(bbk.address)
            const fountainAddress = bbf.address
            const preAddress = await bbk.fountainContractAddress()
            const txHash = await bbk.changeFountainContractAddress.sendTransaction(
              fountainAddress,
              {
                from: ownerAddress
              }
            )
            await waitForTxToBeMined(txHash)
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
            await testWillThrow(bbk.changeFountainContractAddress, [
              contributorAddress
            ])
          })
        })

        describe('when fountainAddress is bbkAddress', () => {
          it('should NOT change the fountainAddress', async () => {
            await testWillThrow(bbk.changeFountainContractAddress, [bbkAddress])
          })
        })
      })

      describe('when NOT sent from ownerAddress', () => {
        it('should NOT change the fountainAddress', async () => {
          const bbf = await BrickblockFountainStub.new(bbk.address)
          const fountainAddress = bbf.address

          await testWillThrow(bbk.changeFountainContractAddress, [
            fountainAddress,
            {
              from: contributorAddress
            }
          ])
        })
      })
    })
  })
})

describe('at the end of the ico when fountainAddress has been set', () => {
  contract('BrickblockToken', accounts => {
    const bonusAddress = accounts[1]
    let bbk
    let bbf
    let bbkAddress
    let fountainAddress

    before('setup contract and relevant accounts', async () => {
      bbk = await BrickblockToken.new(bonusAddress)
      bbf = await BrickblockFountainStub.new(bbk.address)
      fountainAddress = bbf.address
      bbkAddress = bbk.address
      await distributeTokensToMany(bbk, accounts)
      await bbk.changeFountainContractAddress(fountainAddress)
    })

    it('should set the correct values when running finalizeTokenSale', async () => {
      const preBonusBalance = await bbk.balanceOf(bonusAddress)
      const contributors = accounts.slice(4)
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
      const contributorsDiff = preContributorTotalDistributed.minus(
        postTotalSupply.times(contributorShare).div(100)
      )
      const companyDiff = postContractBalance.minus(
        postTotalSupply.times(companyShare).div(100)
      )
      assert.equal(
        preBonusBalance.minus(postBonusBalance).toString(),
        '0',
        'the bonus amount should not change'
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
        postContractFountainAllowance.toString(),
        postContractBalance.toString(),
        'the remaining contract balance should be approved to be spent by the fountain contract address'
      )
    })

    it('should NOT be able to call finalizeTokenSale again', async () => {
      await testWillThrow(bbk.finalizeTokenSale)
    })
  })
})

describe('after the ico', () => {
  contract('BrickblockToken', accounts => {
    let bbk
    let bbf
    const owner = accounts[0]
    const bonusAddress = accounts[1]
    let fountainAddress
    const testAmount = new BigNumber(1e24)

    before('setup bbk BrickblockToken', async () => {
      bbk = await BrickblockToken.new(bonusAddress)
      bbf = await BrickblockFountainStub.new(bbk.address)
      fountainAddress = bbf.address
      await bbk.changeFountainContractAddress(fountainAddress)
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
      await testWillThrow(bbk.pause, [{ from: accounts[1] }])
    })

    it('should pause when the owner calls pause', async () => {
      await pauseIfUnpaused(bbk)
      const postPausedState = await bbk.paused.call()
      assert.equal(postPausedState, true, 'The contract should be paused')
    })

    it('should NOT unpause when non-owner calls pause', async () => {
      await pauseIfUnpaused(bbk)
      await testWillThrow(bbk.unpause, [{ from: accounts[1] }])
    })

    it('should allow transferFrom from the fountain address for company tokens when bbk unpaused', async () => {
      await unpauseIfPaused(bbk)
      const bbkPaused = await bbk.paused()
      assert(!bbkPaused, 'bbk should not be paused')
      const prebbkContractTokenBalance = await bbk.balanceOf(bbk.address)
      const preFountainContractTokenBalance = await bbk.balanceOf(bbf.address)

      await bbf.lockCompanyFunds()

      const postbbkContractTokenBalance = await bbk.balanceOf(bbk.address)
      const postFountainContractTokenBalance = await bbk.balanceOf(bbf.address)

      assert.equal(
        prebbkContractTokenBalance
          .minus(postbbkContractTokenBalance)
          .toString(),
        companyTokens.toString(),
        'the bbk contract balance should be decremented by the companyToken amount'
      )
      assert.equal(
        postFountainContractTokenBalance
          .minus(preFountainContractTokenBalance)
          .toString(),
        companyTokens.toString(),
        'the fountain contract balance should be incremented by the companyToken amount'
      )

      assert.equal(
        postbbkContractTokenBalance.toString(),
        new BigNumber(0).toString(),
        'the bbk contract token balance should be 0'
      )
    })

    it('should transfer tokens when NOT paused', async () => {
      await unpauseIfPaused(bbk)
      const sender = accounts[4]
      const recipient = accounts[5]
      const preSenderBalance = await bbk.balanceOf(recipient)
      const preRecipientBalance = await bbk.balanceOf(recipient)
      const transferAmount = new BigNumber(1e18)
      const txHash = await bbk.transfer.sendTransaction(
        recipient,
        transferAmount,
        {
          from: sender
        }
      )
      await waitForTxToBeMined(txHash)
      const postSenderBalance = await bbk.balanceOf(recipient)
      const postRecipientBalance = await bbk.balanceOf(recipient)
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

      await testWillThrow(bbk.transfer, [accounts[1], web3.toWei(1000)])

      await bbk.unpause()
    })

    it('should set allowances for other addresses', async () => {
      const preAllowance = await bbk.allowance(accounts[4], accounts[5])
      const txHash = await bbk.approve.sendTransaction(
        accounts[5],
        testAmount,
        {
          from: accounts[4]
        }
      )
      await waitForTxToBeMined(txHash)
      const postAllowance = await bbk.allowance(accounts[4], accounts[5])
      assert.equal(
        postAllowance.minus(preAllowance).toString(),
        testAmount.toString(),
        'approval amount should match approval'
      )
    })

    it('should NOT set allowances for other addresses when paused', async () => {
      await pauseIfUnpaused(bbk)

      await testWillThrow(bbk.approve, [
        accounts[5],
        testAmount,
        {
          from: accounts[4]
        }
      ])

      await bbk.unpause()
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

      await testWillThrow(bbk.increaseApproval, [
        accounts[5],
        testAmount,
        {
          from: accounts[4]
        }
      ])

      await bbk.unpause()
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

      await testWillThrow(bbk.decreaseApproval, [
        accounts[5],
        testAmount,
        {
          from: accounts[4]
        }
      ])

      await bbk.unpause()
    })

    it('should allow transferFrom when NOT paused', async () => {
      const preApproval = await bbk.allowance(accounts[4], accounts[5])
      const preApproverBalance = await bbk.balanceOf(accounts[4])
      const preRecipientBalance = await bbk.balanceOf(accounts[3])
      const approveAmount = testAmount
      const approveTransferAmount = approveAmount.div(2)
      const approveTxHash = await bbk.approve.sendTransaction(
        accounts[5],
        approveAmount,
        {
          from: accounts[4]
        }
      )
      await waitForTxToBeMined(approveTxHash)
      const transferFromTxHash = await bbk.transferFrom.sendTransaction(
        accounts[4],
        accounts[3],
        approveTransferAmount,
        {
          from: accounts[5]
        }
      )
      await waitForTxToBeMined(transferFromTxHash)
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

    describe('when calling distributeBonusTokens and tokenSaleActive is false', () => {
      describe('when NOT sent from ownerAddress', () => {
        it('should NOT distribute tokens to bonusRecipientAddress', async () => {
          const bonusRecipientAddress = accounts[9]
          const distributeAmount = new BigNumber(1e19)

          await testWillThrow(bbk.distributeBonusTokens, [
            bonusRecipientAddress,
            distributeAmount,
            {
              from: bonusAddress
            }
          ])
        })
      })

      describe('when sent from owner', () => {
        it('should NOT distribute tokens to owner', async () => {
          const distributeAmount = new BigNumber(1e19)

          await testWillThrow(bbk.distributeBonusTokens, [
            owner,
            distributeAmount,
            {
              from: owner
            }
          ])
        })

        it('should distribute tokens to bonusRecipientAddress', async () => {
          const bonusRecipientAddress = accounts[9]
          const preRecipientBalance = await bbk.balanceOf(bonusRecipientAddress)
          const preBonusBalance = await bbk.balanceOf(bonusAddress)
          const distributeAmount = bonusTokens

          const txHash = await bbk.distributeBonusTokens.sendTransaction(
            bonusRecipientAddress,
            distributeAmount,
            {
              from: owner
            }
          )
          await waitForTxToBeMined(txHash)

          const postRecipientBalance = await bbk.balanceOf(
            bonusRecipientAddress
          )
          const postBonusBalance = await bbk.balanceOf(bonusAddress)

          assert.equal(
            postRecipientBalance.minus(preRecipientBalance).toString(),
            distributeAmount.toString(),
            'the bonus recipient balance should be incremented by the distribute amount'
          )

          assert.equal(
            preBonusBalance.minus(postBonusBalance).toString(),
            distributeAmount.toString(),
            'the bonus account balance should be decremented by the distribute amount'
          )
        })

        it('should NOT distribute any tokens due to previous block distributing all distributable tokens', async () => {
          const bonusRecipientAddress = accounts[9]
          const bonusBalance = await bbk.balanceOf(bonusAddress)
          const overDistributeAmount = bonusBalance.add(1)

          await testWillThrow(bbk.distributeBonusTokens, [
            bonusRecipientAddress,
            overDistributeAmount,
            {
              from: owner
            }
          ])
        })
      })
    })

    describe('when calling toggleDead and tokenSaleActive is true', () => {
      it('should toggle dead when owner', async () => {
        const preDead = await bbk.dead()

        const txHash = await bbk.toggleDead.sendTransaction({
          from: owner
        })
        await waitForTxToBeMined(txHash)

        const postDead = await bbk.dead()

        assert(preDead != postDead, 'dead should be toggled')
      })

      it('should toggle back dead when owner', async () => {
        const preDead = await bbk.dead()

        const txHash = await bbk.toggleDead.sendTransaction({
          from: owner
        })
        await waitForTxToBeMined(txHash)

        const postDead = await bbk.dead()

        assert(preDead != postDead, 'dead should be toggled')
      })

      it('should NOT toggle dead when not owner', async () => {
        await testWillThrow(bbk.toggleDead, [{ from: accounts[9] }])
      })
    })
  })
})
