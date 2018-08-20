const BigNumber = require('bignumber.js')

const { testWillThrow } = require('../helpers/general')
const {
  setupContracts,
  testApproveAndLockBBK,
  testUnlockBBK,
  testApproveAndLockMany,
  testPayFee,
  testClaimFeeMany,
  testTransferAct,
  testTransferActMany,
  testActBalanceGreaterThanZero,
  testApproveAct,
  testApproveActMany,
  testTransferFromAct,
  testTransferFromActMany,
  testUpgradeAct
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
        tokenDistAmount
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
      await testWillThrow(testApproveAndLockBBK, [
        bbk,
        act,
        contributor,
        lockAmount
      ])
    })

    it('should lock BBK when approved', async () => {
      await testApproveAndLockBBK(bbk, act, contributor, new BigNumber(1e18))
    })

    it('should NOT unlock more BBK than currently locked', async () => {
      const contributorLockedBbkBalance = await act.lockedBbkOf(contributor)
      const unlockAmount = contributorLockedBbkBalance.add(1)
      await testWillThrow(testUnlockBBK, [bbk, act, contributor, unlockAmount])
    })

    it('should not unlock zero amount', async () => {
      await testWillThrow(act.unlockBBK, [0, { from: contributor }])
    })

    it('should not lock zero amount', async () => {
      await testWillThrow(act.lockBBK, [0, { from: contributor }])
    })

    it('should unlock BBK', async () => {
      const unlockAmount = await act.lockedBbkOf(contributor)
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
    const actRate = new BigNumber(1000)
    let bbk
    let act
    let fmr

    before('setup contracts', async () => {
      const contracts = await setupContracts(
        owner,
        bonusAddress,
        contributors,
        tokenDistAmount,
        actRate
      )
      bbk = contracts.bbk
      act = contracts.act
      fmr = contracts.fmr
      await testApproveAndLockMany(bbk, act, contributors, tokenLockAmount)
    })

    it('should NOT distribute ACT tokens if NOT FeeManager contract', async () => {
      await testWillThrow(act.distribute, [10e18, { from: contributors[0] }])
    })

    it('should distribute ACT tokens to locked BBK contributors when paying FeeManager', async () => {
      const feeValue = new BigNumber(10e18)
      await testPayFee(act, fmr, feePayer, contributors, feeValue, actRate)
    })

    it('should allow ACT holders to burn ACT for ETH', async () => {
      const claimers = contributors
      await testClaimFeeMany(act, fmr, claimers, actRate)
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
    const actRate = new BigNumber(1000)
    let bbk
    let act
    let fmr

    before('setup contracts', async () => {
      const contracts = await setupContracts(
        owner,
        bonusAddress,
        contributors,
        tokenDistAmount,
        actRate
      )
      bbk = contracts.bbk
      act = contracts.act
      fmr = contracts.fmr
      await testApproveAndLockMany(bbk, act, contributors, tokenLockAmount)
      await testPayFee(act, fmr, feePayer, contributors, feeValue, actRate)
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
    const feeValue = new BigNumber(1e18)
    const actRate = new BigNumber(1000)
    let bbk
    let act
    let fmr
    let reg

    beforeEach('setup contracts', async () => {
      const contracts = await setupContracts(
        owner,
        bonusAddress,
        contributors,
        tokenDistAmount,
        actRate
      )
      bbk = contracts.bbk
      act = contracts.act
      fmr = contracts.fmr
      reg = contracts.reg
    })

    it('lock -> payFee -> transfer -> claim', async () => {
      await testApproveAndLockMany(bbk, act, contributors, tokenLockAmount)
      await testPayFee(act, fmr, feePayer, contributors, feeValue, actRate)
      // this should work for all contributors since they have the same balance
      const actBalance = await act.balanceOf(contributors[0])
      await testTransferActMany(act, contributors, recipient, actBalance)
      // all ACT should be owned by recipient after transfers
      const claimers = [recipient]
      await testClaimFeeMany(act, fmr, claimers, actRate)
      await testUpgradeAct(
        bbk,
        act,
        fmr,
        reg,
        contributors,
        claimers.concat(contributors),
        feePayer,
        feeValue,
        actRate
      )
    })

    it('lock -> payFee -> transferFrom -> claim', async () => {
      await testApproveAndLockMany(bbk, act, contributors, tokenLockAmount)
      await testPayFee(act, fmr, feePayer, contributors, feeValue, actRate)
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
      const claimers = [recipient]
      await testClaimFeeMany(act, fmr, claimers, actRate)
      await testUpgradeAct(
        bbk,
        act,
        fmr,
        reg,
        contributors,
        claimers.concat(contributors),
        feePayer,
        feeValue,
        actRate
      )
    })

    it('lock -> 50% payFee -> transfer -> claim', async () => {
      await testApproveAndLockMany(bbk, act, contributors, tokenLockAmount)
      await testPayFee(act, fmr, feePayer, contributors, feeValue, actRate)
      // this should work for all contributors since they have the same balance
      const actBalance = await act.balanceOf(contributors[0])
      await testTransferActMany(act, contributors, recipient, actBalance.div(2))
      // all ACT should be owned by recipient and owner after transfers
      const claimers = [...contributors, recipient]
      await testClaimFeeMany(act, fmr, claimers, actRate)
      await testUpgradeAct(
        bbk,
        act,
        fmr,
        reg,
        contributors,
        claimers,
        feePayer,
        feeValue,
        actRate
      )
    })

    it('lock -> 50% payFee -> transferFrom -> claim', async () => {
      await testApproveAndLockMany(bbk, act, contributors, tokenLockAmount)
      await testPayFee(act, fmr, feePayer, contributors, feeValue, actRate)
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
      // all ACT should be owned by recipient after transfers
      const claimers = [...contributors, recipient]
      await testClaimFeeMany(act, fmr, claimers, actRate)
      await testUpgradeAct(
        bbk,
        act,
        fmr,
        reg,
        contributors,
        claimers,
        feePayer,
        feeValue,
        actRate
      )
    })

    it('lock -> payFee -> 1 50% transfer -> claim', async () => {
      await testApproveAndLockMany(bbk, act, contributors, tokenLockAmount)
      await testPayFee(act, fmr, feePayer, contributors, feeValue, actRate)
      const actBalance = await act.balanceOf(contributor)
      await testTransferAct(act, contributor, recipient, actBalance.div(2))
      const claimers = [...contributors, recipient]
      await testClaimFeeMany(act, fmr, claimers, actRate)
      await testUpgradeAct(
        bbk,
        act,
        fmr,
        reg,
        contributors,
        claimers,
        feePayer,
        feeValue,
        actRate
      )
    })

    it('lock -> payFee -> 1 50% transferFrom -> claim', async () => {
      await testApproveAndLockMany(bbk, act, contributors, tokenLockAmount)
      await testPayFee(act, fmr, feePayer, contributors, feeValue, actRate)
      const actBalance = await act.balanceOf(contributor)
      await testApproveAct(act, contributor, nonContributor, actBalance.div(2))
      await testTransferAct(act, contributor, recipient, actBalance.div(2))
      const claimers = [...contributors, recipient]
      await testClaimFeeMany(act, fmr, claimers, actRate)
      await testUpgradeAct(
        bbk,
        act,
        fmr,
        reg,
        contributors,
        claimers,
        feePayer,
        feeValue,
        actRate
      )
    })

    it('lock -> 1 unlock -> payFee -> claim', async () => {
      await testApproveAndLockMany(bbk, act, contributors, tokenLockAmount)
      const lockedBalance = await act.lockedBbkOf(contributor)
      await testUnlockBBK(bbk, act, contributor, lockedBalance)
      await testPayFee(
        act,
        fmr,
        feePayer,
        contributors.filter(account => account != contributor),
        feeValue,
        actRate
      )
      const claimers = [
        ...contributors.filter(account => account != contributor)
      ]
      await testClaimFeeMany(act, fmr, claimers, actRate)
      await testUpgradeAct(
        bbk,
        act,
        fmr,
        reg,
        contributors,
        [...contributors],
        feePayer,
        feeValue,
        actRate
      )
    })

    it('lock -> 1 50% unlock -> 1 payFee -> claim', async () => {
      await testApproveAndLockMany(bbk, act, contributors, tokenLockAmount)
      const lockedBalance = await act.lockedBbkOf(contributor)
      await testUnlockBBK(bbk, act, contributor, lockedBalance.div(2))
      await testPayFee(act, fmr, feePayer, contributors, feeValue, actRate)
      const claimers = [...contributors]
      await testClaimFeeMany(act, fmr, claimers, actRate)
      await testUpgradeAct(
        bbk,
        act,
        fmr,
        reg,
        contributors,
        claimers,
        feePayer,
        feeValue,
        actRate
      )
    })

    it('lock -> 1 unlock -> payFee -> 1 transfer -> claim', async () => {
      // lock
      await testApproveAndLockMany(bbk, act, contributors, tokenLockAmount)
      const lockedBalance = await act.lockedBbkOf(contributor)

      // unlock
      await testUnlockBBK(bbk, act, contributor, lockedBalance.div(2))

      // payfee
      await testPayFee(act, fmr, feePayer, contributors, feeValue, actRate)

      // transfer
      const actBalance = await act.balanceOf(contributor)
      await testTransferAct(act, contributor, recipient, actBalance.div(2))

      // claim
      const claimers = [...contributors, recipient]
      await testClaimFeeMany(act, fmr, claimers, actRate)
      await testUpgradeAct(
        bbk,
        act,
        fmr,
        reg,
        contributors,
        claimers,
        feePayer,
        feeValue,
        actRate
      )
    })
  })
})
