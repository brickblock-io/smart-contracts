const AccessToken = artifacts.require('BrickblockAccessToken2')
const BrickblockToken = artifacts.require('BrickblockToken')
const ContractRegistry = artifacts.require('BrickblockContractRegistry')
const FeeManager = artifacts.require('BrickblockFeeManager')

const BigNumber = require('bignumber.js')

const { testWillThrow } = require('../helpers/general')
const {
  setupContracts,
  testLockAndApproveBBK,
  testUnlockBBK,
  testLockAndApproveMany,
  testPayFee,
  testClaimFeeMany,
  testTransferAct,
  testTransferActMany,
  testActBalanceGreaterThanZero,
  testApproveAct,
  testApproveActMany,
  testTransferFromAct,
  testTransferFromActMany
} = require('../helpers/act')

describe('when interacting with BBK', () => {
  contract('AccessToken/BrickblockToken', accounts => {
    const owner = accounts[0]
    const bonusAddress = accounts[1]
    const contributors = accounts.slice(2)
    const contributor = contributors[0]
    const tokenDistAmount = new BigNumber(1e24)
    let bbk
    let act

    before('setup contracts', async () => {
      const contracts = await setupContracts(
        owner,
        bonusAddress,
        contributors,
        tokenDistAmount,
        ContractRegistry,
        AccessToken,
        BrickblockToken,
        FeeManager
      )
      bbk = contracts.bbk
      act = contracts.act
    })

    it('should NOT lock BBK if NO approval has been given on BBK', async () => {
      const lockAmount = await bbk.balanceOf(contributor)
      await testWillThrow(act.lockBBK, [lockAmount, { from: contributor }])
    })

    it('should NOT lock more BBK than contributor balance', async () => {
      const contributorBbkBalance = await bbk.balanceOf(contributor)
      const lockAmount = contributorBbkBalance.add(1)
      await testWillThrow(testLockAndApproveBBK, [
        bbk,
        act,
        contributor,
        lockAmount
      ])
    })

    it('should lock BBK when approved', async () => {
      const lockAmount = await bbk.balanceOf(contributor)
      await testLockAndApproveBBK(bbk, act, contributor, lockAmount)
    })

    it('should NOT unlock more BBK than currently locked', async () => {
      const contributorLockedBbkBalance = await act.lockedBbkOf(contributor)
      const unlockAmount = contributorLockedBbkBalance.add(1)
      await testWillThrow(testUnlockBBK, [bbk, act, contributor, unlockAmount])
    })

    it('should unlock BBK', async () => {
      const unlockAmount = await bbk.balanceOf(contributor)
      await testUnlockBBK(bbk, act, contributor, unlockAmount)
    })
  })
})

describe('when interacting with Fee manager', () => {
  contract('AccessToken/FeeManager', accounts => {
    const owner = accounts[0]
    const bonusAddress = accounts[1]
    const feePayer = accounts[2]
    const contributors = accounts.slice(3)
    const tokenDistAmount = new BigNumber(1e24)
    const tokenLockAmount = new BigNumber(1e24)
    let bbk
    let act
    let bfm

    before('setup contracts', async () => {
      const contracts = await setupContracts(
        owner,
        bonusAddress,
        contributors,
        tokenDistAmount,
        ContractRegistry,
        AccessToken,
        BrickblockToken,
        FeeManager
      )
      bbk = contracts.bbk
      act = contracts.act
      bfm = contracts.bfm
      await testLockAndApproveMany(bbk, act, contributors, tokenLockAmount)
    })

    it('should NOT distribute ACT tokens if NOT FeeManager contract', async () => {
      await testWillThrow(act.distribute, [10e18, { from: contributors[2] }])
    })

    it('should distribute ACT tokens to locked BBK contributors when paying FeeManager', async () => {
      const feeValue = new BigNumber(10e18)
      await testPayFee(feePayer, contributors, feeValue, act, bfm)
    })

    it('should allow ACT holders to burn ACT for ETH', async () => {
      const claimers = [...contributors, owner]
      await testClaimFeeMany(claimers, act, bfm)
    })
  })
})

describe('when ACT has been distributed', () => {
  contract('AccessToken', accounts => {
    const owner = accounts[0]
    const bonusAddress = accounts[1]
    const feePayer = accounts[2]
    const contributors = accounts.slice(3, 8)
    const contributor = contributors[0]
    const recipient = accounts[8]
    const nonContributor = accounts[9]
    const tokenDistAmount = new BigNumber(1e24)
    const tokenLockAmount = new BigNumber(1e24)
    const feeValue = new BigNumber(10e18)
    let bbk
    let act
    let bfm

    before('setup contracts', async () => {
      const contracts = await setupContracts(
        owner,
        bonusAddress,
        contributors,
        tokenDistAmount,
        ContractRegistry,
        AccessToken,
        BrickblockToken,
        FeeManager
      )
      bbk = contracts.bbk
      act = contracts.act
      bfm = contracts.bfm
      await testLockAndApproveMany(bbk, act, contributors, tokenLockAmount)
      await testPayFee(feePayer, contributors, feeValue, act, bfm)
    })

    it('should transfer BEFORE unlocking act balance', async () => {
      const actBalance = await testActBalanceGreaterThanZero(act, contributor)
      await testTransferAct(act, contributor, recipient, actBalance.div(4))
    })

    it('should transferFrom BEFORE unlocking act balance', async () => {
      const actBalance = await testActBalanceGreaterThanZero(act, contributor)
      await testApproveAct(act, contributor, nonContributor, actBalance.div(4))
      await testTransferFromAct(
        act,
        contributor,
        recipient,
        nonContributor,
        actBalance.div(4)
      )
    })

    it('should unlock BBK and keep ACT balance', async () => {
      await testActBalanceGreaterThanZero(act, contributor)
      await testUnlockBBK(bbk, act, contributor, tokenLockAmount)
    })

    it('should transfer AFTER unlocking act balance', async () => {
      const actBalance = await testActBalanceGreaterThanZero(act, contributor)
      await testTransferAct(act, contributor, recipient, actBalance.div(4))
    })

    it('should transferFrom AFTER unlocking act balance', async () => {
      const actBalance = await testActBalanceGreaterThanZero(act, contributor)
      await testApproveAct(act, contributor, nonContributor, actBalance.div(4))
      await testTransferFromAct(
        act,
        contributor,
        recipient,
        nonContributor,
        actBalance.div(4)
      )
    })
  })
})

describe('when testing different scenarios...', () => {
  contract('AccessToken', accounts => {
    const owner = accounts[0]
    const bonusAddress = accounts[1]
    const feePayer = accounts[2]
    const contributors = accounts.slice(3, 6)
    const contributor = contributors[0]
    const recipient = accounts[8]
    const nonContributor = accounts[9]
    const tokenDistAmount = new BigNumber(1e24)
    const tokenLockAmount = new BigNumber(1e24)
    const feeValue = new BigNumber(10e18)
    let bbk
    let act
    let bfm

    beforeEach('setup contracts', async () => {
      const contracts = await setupContracts(
        owner,
        bonusAddress,
        contributors,
        tokenDistAmount,
        ContractRegistry,
        AccessToken,
        BrickblockToken,
        FeeManager
      )
      bbk = contracts.bbk
      act = contracts.act
      bfm = contracts.bfm
    })

    it('lock -> payFee -> transfer -> claim', async () => {
      await testLockAndApproveMany(bbk, act, contributors, tokenLockAmount)
      await testPayFee(feePayer, contributors, feeValue, act, bfm)
      // this should work for all contributors since they have the same balance
      const actBalance = await act.balanceOf(contributors[0])
      await testTransferActMany(act, contributors, recipient, actBalance)
      // all ACT should be owned by recipient and owner after transfers
      const claimers = [recipient, owner]
      await testClaimFeeMany(claimers, act, bfm)
    })

    it('lock -> payFee -> transferFrom -> claim', async () => {
      await testLockAndApproveMany(bbk, act, contributors, tokenLockAmount)
      await testPayFee(feePayer, contributors, feeValue, act, bfm)
      // this should work for all contributors since they have the same balance
      const actBalance = await act.balanceOf(contributors[0])
      await testApproveActMany(act, contributors, nonContributor, actBalance)
      await testTransferFromActMany(
        act,
        contributors,
        recipient,
        nonContributor,
        actBalance
      )
      // all ACT should be owned by recipient and owner after transfers
      const claimers = [recipient, owner]
      await testClaimFeeMany(claimers, act, bfm)
    })

    it('lock -> 50% payFee -> transfer -> claim', async () => {
      await testLockAndApproveMany(bbk, act, contributors, tokenLockAmount)
      await testPayFee(feePayer, contributors, feeValue, act, bfm)
      // this should work for all contributors since they have the same balance
      const actBalance = await act.balanceOf(contributors[0])
      await testTransferActMany(act, contributors, recipient, actBalance.div(2))
      // all ACT should be owned by recipient and owner after transfers
      const claimers = [...contributors, recipient, owner]
      await testClaimFeeMany(claimers, act, bfm)
    })

    it('lock -> 50% payFee -> transferFrom -> claim', async () => {
      await testLockAndApproveMany(bbk, act, contributors, tokenLockAmount)
      await testPayFee(feePayer, contributors, feeValue, act, bfm)
      // this should work for all contributors since they have the same balance
      const actBalance = await act.balanceOf(contributors[0])
      await testApproveActMany(
        act,
        contributors,
        nonContributor,
        actBalance.div(2)
      )
      await testTransferFromActMany(
        act,
        contributors,
        recipient,
        nonContributor,
        actBalance.div(2)
      )
      // all ACT should be owned by recipient and owner after transfers
      const claimers = [...contributors, recipient, owner]
      await testClaimFeeMany(claimers, act, bfm)
    })

    it('lock -> payFee -> 1 50% transfer -> claim', async () => {
      await testLockAndApproveMany(bbk, act, contributors, tokenLockAmount)
      await testPayFee(feePayer, contributors, feeValue, act, bfm)
      const actBalance = await act.balanceOf(contributor)
      await testTransferAct(act, contributor, recipient, actBalance.div(2))
      const claimers = [...contributors, recipient, owner]
      await testClaimFeeMany(claimers, act, bfm)
    })

    it('lock -> payFee -> 1 50% transferFrom -> claim', async () => {
      await testLockAndApproveMany(bbk, act, contributors, tokenLockAmount)
      await testPayFee(feePayer, contributors, feeValue, act, bfm)
      const actBalance = await act.balanceOf(contributor)
      await testApproveAct(act, contributor, nonContributor, actBalance.div(2))
      await testTransferAct(act, contributor, recipient, actBalance.div(2))
      const claimers = [...contributors, recipient, owner]
      await testClaimFeeMany(claimers, act, bfm)
    })

    it('lock -> 1 unlock -> payFee -> claim', async () => {
      await testLockAndApproveMany(bbk, act, contributors, tokenLockAmount)
      const lockedBalance = await act.lockedBbkOf(contributor)
      await testUnlockBBK(bbk, act, contributor, lockedBalance)
      await testPayFee(
        feePayer,
        contributors.filter(account => account != contributor),
        feeValue,
        act,
        bfm
      )
      const claimers = [
        ...contributors.filter(account => account != contributor),
        owner
      ]
      await testClaimFeeMany(claimers, act, bfm)
    })

    it('lock -> 1 50% unlock -> 1 payFee -> claim', async () => {
      await testLockAndApproveMany(bbk, act, contributors, tokenLockAmount)
      const lockedBalance = await act.lockedBbkOf(contributor)
      await testUnlockBBK(bbk, act, contributor, lockedBalance.div(2))
      await testPayFee(feePayer, contributors, feeValue, act, bfm)
      const claimers = [...contributors, owner]
      await testClaimFeeMany(claimers, act, bfm)
    })

    it('lock -> 1 unlock -> payFee -> 1 transfer -> claim', async () => {
      // lock
      await testLockAndApproveMany(bbk, act, contributors, tokenLockAmount)
      const lockedBalance = await act.lockedBbkOf(contributor)

      // unlock
      await testUnlockBBK(bbk, act, contributor, lockedBalance.div(2))

      // payfee
      await testPayFee(feePayer, contributors, feeValue, act, bfm)

      // transfer
      const actBalance = await act.balanceOf(contributor)
      await testTransferAct(act, contributor, recipient, actBalance.div(2))

      // claim
      const claimers = [...contributors, recipient, owner]
      await testClaimFeeMany(claimers, act, bfm)
    })
  })
})
