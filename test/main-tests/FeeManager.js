const BigNumber = require('bignumber.js')

const { testWillThrow, sendTransaction } = require('../helpers/general')
const { testApproveAndLockMany } = require('../helpers/act')
const { setupContracts } = require('../helpers/fmr')
const { testPayFee, testPartialClaimFee } = require('../helpers/fmr')

describe('when using utility functions', () => {
  contract('FeeManager', accounts => {
    const owner = accounts[0]
    const bonusAddress = accounts[1]
    const contributors = accounts.slice(3)
    const tokenDistAmount = new BigNumber(1e24)
    const actRate = new BigNumber(1e3)
    let fmr
    let exr

    before('setup contracts', async () => {
      const contracts = await setupContracts(
        owner,
        bonusAddress,
        contributors,
        tokenDistAmount,
        new BigNumber(0)
      )
      fmr = contracts.fmr
      exr = contracts.exr
    })

    it('weiToAct should THROW when rate is actRate is 0', async () => {
      await testWillThrow(fmr.weiToAct, [1e15])
    })

    it('actToWei should THROW when rate is actRate is 0', async () => {
      await testWillThrow(fmr.actToWei, [1e21])
    })

    it('should return the correct weiToAct value', async () => {
      await exr.setActRate(actRate)
      const weiValue = new BigNumber(1e15)
      const expectedAct = weiValue.mul(actRate)
      const actualAct = await fmr.weiToAct(weiValue)

      assert.equal(
        expectedAct.toString(),
        actualAct.toString(),
        'wei converted to act should match actual value'
      )
    })

    it('should return the correct actToWei value', async () => {
      const actValue = new BigNumber(1e21)
      const expectedWei = actValue.div(actRate)
      const actualWei = await fmr.actToWei(actValue)

      assert.equal(
        expectedWei.toString(),
        actualWei.toString(),
        'act converted to wei should match expected value'
      )
    })
  })
})

describe('when interacting with FeeManager', () => {
  contract('FeeManager', accounts => {
    const owner = accounts[0]
    const bonusAddress = accounts[1]
    const feePayer = accounts[2]
    const contributors = accounts.slice(3)
    const claimer = contributors[0]
    const tokenDistAmount = new BigNumber(1e24)
    const tokenLockAmount = new BigNumber(1e24)
    const feeAmount = new BigNumber(1e19)
    const actRate = new BigNumber(1e3)
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

    it('should increment ether balance correctly for FeeManager', async () => {
      await testPayFee(fmr, act, feePayer, feeAmount, actRate)
    })

    it('should decrement ether balance correctly for FeeManager', async () => {
      const actBalance = await act.balanceOf(claimer)
      const claimAmount = actBalance.div(2)
      await testPartialClaimFee(fmr, act, claimer, claimAmount, actRate)
    })

    it('should NOT allow fallback function payments', async () => {
      await testWillThrow(sendTransaction, [
        web3,
        { from: feePayer, value: feeAmount, to: fmr.address }
      ])
    })

    it('should NOT allow claiming more ACT than balance', async () => {
      const actBalance = await act.balanceOf(claimer)
      const claimAmount = actBalance.add(1)
      await testWillThrow(fmr.claimFee, [claimAmount, { from: claimer }])
    })
  })
})
