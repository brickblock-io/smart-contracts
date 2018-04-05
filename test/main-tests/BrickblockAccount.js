const AccessToken = artifacts.require('BrickblockAccessToken')
const BrickblockAccount = artifacts.require('BrickblockAccount')
const BrickblockToken = artifacts.require('BrickblockToken')
const ContractRegistry = artifacts.require('BrickblockContractRegistry')
const FeeManager = artifacts.require('BrickblockFeeManager')

const BigNumber = require('bignumber.js')

const { testWillThrow, getEtherBalance } = require('../helpers/general')
const {
  setupContracts,
  testPullFunds,
  testLockBBK,
  testUnlockBBK,
  testClaimFee,
  testWithdrawEthFunds,
  testWithdrawActFunds,
  testWithdrawBbkFunds
} = require('../helpers/bat')

const { warpBlocks } = require('../helpers/general')
const { testPayFee } = require('../helpers/act')

describe('when interacting with BBK, ACT, and BFM', () => {
  contract('AccountManager/AccessToken', accounts => {
    const owner = accounts[0]
    const bonusAddress = accounts[1]
    const feePayer = accounts[2]
    const contributors = accounts.slice(3)
    const tokenDistAmount = new BigNumber(1e24)
    const feeValue = new BigNumber(10e18)
    let bbk
    let act
    let bat
    let fmr

    before('setup contracts', async () => {
      const contracts = await setupContracts(
        owner,
        bonusAddress,
        contributors,
        tokenDistAmount,
        ContractRegistry,
        AccessToken,
        BrickblockToken,
        FeeManager,
        BrickblockAccount
      )
      bbk = contracts.bbk
      act = contracts.act
      bat = contracts.bat
      fmr = contracts.fmr
    })

    it('should start with the correct owner', async () => {
      const contractOwner = await bat.owner()
      assert.equal(
        owner,
        contractOwner,
        'AccountManager owner should match owner deployed with'
      )
    })

    it('should pull company BBK from BBK contract', async () => {
      await testPullFunds(bbk, bat)
    })

    it('should lock ALL BBK into ACT contract', async () => {
      const lockAmount = await bbk.balanceOf(bat.address)
      await testLockBBK(bbk, act, bat, lockAmount)
    })

    it('should unlock SOME BBK from ACT contract', async () => {
      const lockedBalance = await act.lockedBbkOf(bat.address)
      const unlockAmount = lockedBalance.div(5)
      await testUnlockBBK(bbk, act, bat, unlockAmount)
    })

    it('should unlock ALL BBK from ACT contract', async () => {
      const unlockAmount = await act.lockedBbkOf(bat.address)
      await testUnlockBBK(bbk, act, bat, unlockAmount)
    })

    it('should lock SOME BBK into ACT contract', async () => {
      const bbkBalance = await bbk.balanceOf(bat.address)
      const lockAmount = bbkBalance.div(5)
      await testLockBBK(bbk, act, bat, lockAmount)
    })

    it('should claim ALL claimable by BrickblockAccount', async () => {
      await testPayFee(feePayer, [bat.address], feeValue, act, fmr)
      const claimAmount = await act.balanceOf(bat.address)
      await testClaimFee(bbk, act, fmr, bat, claimAmount)
    })
  })
})

describe('when interacting with BBK, ACT, and BFM as NOT owner', () => {
  contract('AccountManager/AccessToken', accounts => {
    const owner = accounts[0]
    const bonusAddress = accounts[1]
    const feePayer = accounts[2]
    const otherAccount = accounts[3]
    const contributors = accounts.slice(4)
    const tokenDistAmount = new BigNumber(1e24)
    const feeValue = new BigNumber(10e18)
    let bbk
    let act
    let bat
    let fmr

    before('setup contracts', async () => {
      const contracts = await setupContracts(
        owner,
        bonusAddress,
        contributors,
        tokenDistAmount,
        ContractRegistry,
        AccessToken,
        BrickblockToken,
        FeeManager,
        BrickblockAccount
      )
      bbk = contracts.bbk
      act = contracts.act
      bat = contracts.bat
      fmr = contracts.fmr
    })

    it('should NOT pull company BBK from BBK contract when NOT owner', async () => {
      await testWillThrow(bat.pullFunds, [{ from: otherAccount }])
    })

    it('should NOT lock ALL BBK into ACT contract when NOT owner', async () => {
      await testPullFunds(bbk, bat)
      const lockAmount = await bbk.balanceOf(bat.address)
      await testWillThrow(bat.lockBBK, [lockAmount, { from: otherAccount }])
    })

    it('should NOT unlock BBK from ACT contract when NOT owner', async () => {
      const lockAmount = await bbk.balanceOf(bat.address)
      await testLockBBK(bbk, act, bat, lockAmount)
      const unlockAmount = await act.lockedBbkOf(bat.address)
      await testWillThrow(bat.unlockBBK, [unlockAmount, { from: otherAccount }])
    })

    it('should NOT claim claimable by BrickblockAccount when NOT owner', async () => {
      await testPayFee(feePayer, [bat.address], feeValue, act, fmr)
      const claimAmount = await act.balanceOf(bat.address)
      await testClaimFee(bbk, act, fmr, bat, claimAmount)
      await testWillThrow(bat.claimFee, [claimAmount, { from: otherAccount }])
    })
  })
})

describe('when withdrawing funds BEFORE BBK unlock block', () => {
  contract('AccountManager/AccessToken', accounts => {
    const owner = accounts[0]
    const bonusAddress = accounts[1]
    const feePayer = accounts[2]
    const otherAccount = accounts[3]
    const contributors = accounts.slice(4)
    const tokenDistAmount = new BigNumber(1e24)
    const feeValue = new BigNumber(10e18)
    let bbk
    let act
    let bat
    let fmr

    beforeEach('setup contracts', async () => {
      const contracts = await setupContracts(
        owner,
        bonusAddress,
        contributors,
        tokenDistAmount,
        ContractRegistry,
        AccessToken,
        BrickblockToken,
        FeeManager,
        BrickblockAccount,
        1000
      )
      bbk = contracts.bbk
      act = contracts.act
      bat = contracts.bat
      fmr = contracts.fmr

      await testPullFunds(bbk, bat)
      const lockAmount = await bbk.balanceOf(bat.address)
      await testLockBBK(bbk, act, bat, lockAmount)
      await testPayFee(feePayer, [bat.address], feeValue, act, fmr)
      const claimAmount = await act.balanceOf(bat.address)
      await testClaimFee(bbk, act, fmr, bat, claimAmount)
    })

    it('should withdraw SOME ETH funds to owner account', async () => {
      const ethBalance = await getEtherBalance(bat.address)
      const withdrawalAmount = await ethBalance.div(5)
      await testWithdrawEthFunds(bat, owner, withdrawalAmount)
    })

    it('should withdraw SOME ETH to account other than owner', async () => {
      const ethBalance = await getEtherBalance(bat.address)
      const withdrawalAmount = await ethBalance.div(5)
      await testWithdrawEthFunds(bat, otherAccount, withdrawalAmount)
    })

    it('should withdraw ALL remaining ETH funds to owner', async () => {
      const withdrawalAmount = await getEtherBalance(bat.address)
      await testWithdrawEthFunds(bat, owner, withdrawalAmount)
    })

    it('should withdraw SOME ACT funds to owner account', async () => {
      const actBalance = await act.balanceOf(bat.address)
      const withdrawalAmount = await actBalance.div(5)
      await testWithdrawActFunds(bat, act, owner, withdrawalAmount)
    })

    it('should withdraw SOME ACT to account other than owner', async () => {
      const actBalance = await act.balanceOf(bat.address)
      const withdrawalAmount = await actBalance.div(5)
      await testWithdrawActFunds(bat, act, otherAccount, withdrawalAmount)
    })

    it('should withdraw ALL remaining ACT funds to owner', async () => {
      const withdrawalAmount = await act.balanceOf(bat.address)
      await testWithdrawActFunds(bat, act, owner, withdrawalAmount)
    })

    it('should NOT withdraw BBK before the unlock block', async () => {
      const withdrawalAmount = await act.lockedBbkOf(bat.address)
      await testUnlockBBK(bbk, act, bat, withdrawalAmount)
      await testWillThrow(testWithdrawBbkFunds, [
        bat,
        bbk,
        owner,
        withdrawalAmount
      ])
    })
  })
})

describe('when withdrawing funds AFTER BBK unlock block', () => {
  contract('AccountManager/AccessToken', accounts => {
    const owner = accounts[0]
    const bonusAddress = accounts[1]
    const feePayer = accounts[2]
    const otherAccount = accounts[3]
    const contributors = accounts.slice(4)
    const tokenDistAmount = new BigNumber(1e24)
    const feeValue = new BigNumber(10e18)
    let bbk
    let act
    let bat
    let fmr

    beforeEach('setup contracts', async () => {
      const contracts = await setupContracts(
        owner,
        bonusAddress,
        contributors,
        tokenDistAmount,
        ContractRegistry,
        AccessToken,
        BrickblockToken,
        FeeManager,
        BrickblockAccount,
        20
      )
      bbk = contracts.bbk
      act = contracts.act
      bat = contracts.bat
      fmr = contracts.fmr

      await testPullFunds(bbk, bat)
      const lockAmount = await bbk.balanceOf(bat.address)
      await testLockBBK(bbk, act, bat, lockAmount)
      await testPayFee(feePayer, [bat.address], feeValue, act, fmr)
      const claimAmount = await act.balanceOf(bat.address)
      await testClaimFee(bbk, act, fmr, bat, claimAmount)
      await warpBlocks(20)
    })

    it('should withdraw SOME BBK funds to owner account', async () => {
      const bbkBalance = await act.lockedBbkOf(bat.address)
      const withdrawalAmount = await bbkBalance.div(5)
      await testUnlockBBK(bbk, act, bat, withdrawalAmount)
      await testWithdrawBbkFunds(bat, bbk, owner, withdrawalAmount)
    })

    it('should withdraw SOME BBK to account other than owner', async () => {
      const bbkBalance = await act.lockedBbkOf(bat.address)
      const withdrawalAmount = await bbkBalance.div(5)
      await testUnlockBBK(bbk, act, bat, withdrawalAmount)
      await testWithdrawBbkFunds(bat, bbk, otherAccount, withdrawalAmount)
    })

    it('should withdraw ALL remaining BBK funds to owner', async () => {
      const withdrawalAmount = await act.lockedBbkOf(bat.address)
      await testUnlockBBK(bbk, act, bat, withdrawalAmount)
      await testWithdrawBbkFunds(bat, bbk, owner, withdrawalAmount)
    })

    it('should withdraw ALL remaining BBK funds to account other than owner', async () => {
      const withdrawalAmount = await act.lockedBbkOf(bat.address)
      await testUnlockBBK(bbk, act, bat, withdrawalAmount)
      await testWithdrawBbkFunds(bat, bbk, otherAccount, withdrawalAmount)
    })
  })
})

describe('when trying to withdraw more than available balance', () => {
  contract('AccountManager', accounts => {
    const owner = accounts[0]
    const bonusAddress = accounts[1]
    const feePayer = accounts[2]
    const contributors = accounts.slice(4)
    const tokenDistAmount = new BigNumber(1e24)
    const feeValue = new BigNumber(10e18)
    let bbk
    let act
    let bat
    let fmr

    beforeEach('setup contracts', async () => {
      const contracts = await setupContracts(
        owner,
        bonusAddress,
        contributors,
        tokenDistAmount,
        ContractRegistry,
        AccessToken,
        BrickblockToken,
        FeeManager,
        BrickblockAccount,
        20
      )
      bbk = contracts.bbk
      act = contracts.act
      bat = contracts.bat
      fmr = contracts.fmr

      await testPullFunds(bbk, bat)
      const lockAmount = await bbk.balanceOf(bat.address)
      await testLockBBK(bbk, act, bat, lockAmount)
      await testPayFee(feePayer, [bat.address], feeValue, act, fmr)
      const claimAmount = await act.balanceOf(bat.address)
      await testClaimFee(bbk, act, fmr, bat, claimAmount)
      await warpBlocks(20)
    })

    it('should NOT withdraw more ETH than available', async () => {
      const ethBalance = await getEtherBalance(bat.address)
      const withdrawalAmount = await ethBalance.add(1)
      await testWillThrow(bat.withdrawEthFunds, [owner, withdrawalAmount])
    })

    it('should NOT withdraw more ACT than available', async () => {
      const actBalance = await act.balanceOf(bat.address)
      const withdrawalAmount = actBalance.add(1)
      await testWillThrow(bat.withdrawActFunds, [owner, withdrawalAmount])
    })

    it('should NOT withdraw more BBK than available', async () => {
      const bbkBalance = await act.lockedBbkOf(bat.address)
      const withdrawalAmount = await bbkBalance
      const overWithdrawalAmount = await bbkBalance.add(1)
      await testUnlockBBK(bbk, act, bat, withdrawalAmount)
      await testWillThrow(bat.withdrawBbkFunds, [owner, overWithdrawalAmount])
    })
  })
})

describe('when trying to withdraw as NOT owner', () => {
  contract('AccountManager/AccessToken', accounts => {
    const owner = accounts[0]
    const bonusAddress = accounts[1]
    const feePayer = accounts[2]
    const otherAccount = accounts[3]
    const contributors = accounts.slice(4)
    const tokenDistAmount = new BigNumber(1e24)
    const feeValue = new BigNumber(10e18)
    let bbk
    let act
    let bat
    let fmr

    beforeEach('setup contracts', async () => {
      const contracts = await setupContracts(
        owner,
        bonusAddress,
        contributors,
        tokenDistAmount,
        ContractRegistry,
        AccessToken,
        BrickblockToken,
        FeeManager,
        BrickblockAccount,
        20
      )
      bbk = contracts.bbk
      act = contracts.act
      bat = contracts.bat
      fmr = contracts.fmr

      await testPullFunds(bbk, bat)
      const lockAmount = await bbk.balanceOf(bat.address)
      await testLockBBK(bbk, act, bat, lockAmount)
      await testPayFee(feePayer, [bat.address], feeValue, act, fmr)
      const claimAmount = await act.balanceOf(bat.address)
      await testClaimFee(bbk, act, fmr, bat, claimAmount)
      await warpBlocks(20)
    })

    it('should NOT withdraw ETH when NOT owner', async () => {
      const withdrawalAmount = await getEtherBalance(bat.address)
      await testWillThrow(bat.withdrawEthFunds, [
        otherAccount,
        withdrawalAmount,
        {
          from: otherAccount
        }
      ])
    })

    it('should NOT withdraw more ACT than available', async () => {
      const withdrawalAmount = await act.balanceOf(bat.address)
      await testWillThrow(bat.withdrawActFunds, [
        otherAccount,
        withdrawalAmount,
        {
          from: otherAccount
        }
      ])
    })

    it('should NOT withdraw more BBK than available', async () => {
      const withdrawalAmount = await act.lockedBbkOf(bat.address)
      await testUnlockBBK(bbk, act, bat, withdrawalAmount)
      await testWillThrow(bat.withdrawBbkFunds, [
        otherAccount,
        withdrawalAmount,
        {
          from: otherAccount
        }
      ])
    })
  })
})
