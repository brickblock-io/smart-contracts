const AccessToken = artifacts.require('BrickblockAccessToken')
const BrickblockToken = artifacts.require('BrickblockToken')
const ContractRegistry = artifacts.require('BrickblockContractRegistry')
const FeeManager = artifacts.require('BrickblockFeeManager')

const BigNumber = require('bignumber.js')

const { testWillThrow, sendTransaction } = require('../helpers/general')
const { setupContracts, testLockAndApproveMany } = require('../helpers/act')
const { testPayFee, testPartialClaimFee } = require('../helpers/fmr')

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
    let bbk
    let act
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
        FeeManager
      )
      bbk = contracts.bbk
      act = contracts.act
      fmr = contracts.fmr
      await testLockAndApproveMany(bbk, act, contributors, tokenLockAmount)
    })

    it('should increment ether balance correctly for FeeManager', async () => {
      await testPayFee(fmr, feePayer, feeAmount)
    })

    it('should decrement ether balance correctly for FeeManager', async () => {
      const actBalance = await act.balanceOf(claimer)
      const claimAmount = actBalance.div(2)
      await testPartialClaimFee(fmr, act, claimer, claimAmount)
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
