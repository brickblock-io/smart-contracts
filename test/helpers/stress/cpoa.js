const assert = require('assert')
const BigNumber = require('bignumber.js')
const CustomPoaToken = artifacts.require('CustomPOAToken')

const { getEtherBalance } = require('../cpoa')

/* eslint-disable no-console */

const getAccountInformation = async (address, contract) => {
  const etherBalance = await getEtherBalance(address)
  const tokenBalance = await contract.balanceOf(address)
  const currentPayout = await contract.currentPayout(address, true)

  return {
    etherBalance,
    tokenBalance,
    currentPayout
  }
}

const activeContract = async (
  _name,
  _symbol,
  _owner,
  _broker,
  _custodian,
  _timeoutBlock,
  _totalSupply,
  _fundingGoal,
  _investors
) => {
  const fundingGoal = new BigNumber(_fundingGoal)
  const contract = await CustomPoaToken.new(
    _name,
    _symbol,
    _broker,
    _custodian,
    _timeoutBlock,
    _totalSupply,
    _fundingGoal
  )
  let remainingFunding = fundingGoal.sub(await contract.fundedAmount())
  await Promise.all(
    _investors.map(investor => contract.whitelistAddress(investor))
  )
  let loopCounter = 0
  while (remainingFunding.greaterThan(0)) {
    const stage = await contract.stage()
    assert.equal(stage.toString(), '0', 'should be in funding stage')
    const investAmount = BigNumber.min(
      remainingFunding,
      BigNumber.random(18)
        .mul(fundingGoal.div(6))
        .floor()
    )

    const investor = _investors[loopCounter % _investors.length]
    const whitelisted = await contract.whitelisted(investor)
    assert(whitelisted, 'the investor should be whiteliseted')

    await contract.buy({
      from: investor,
      value: investAmount
    })

    const newFundedAmount = await contract.fundedAmount()
    remainingFunding = fundingGoal.sub(newFundedAmount)

    console.log(
      'remaining funding',
      remainingFunding.div(1e18).toString(),
      'invest amount',
      investAmount.div(1e18).toString()
    )

    loopCounter++
  }

  assert.equal(
    (await contract.stage()).toString(),
    '1',
    'should be in penidng stage now'
  )
  const fee = await contract.calculateFee(fundingGoal)
  await contract.activate({ from: _custodian, value: fee })
  console.log('claiming for OWNER (activation fee)')
  await contract.claim({ from: _owner })
  console.log('claiming for CUSTODIAN (activation contract value)')
  await contract.claim.sendTransaction({
    from: _custodian
  })
  assert.equal(
    (await contract.stage()).toString(),
    '3',
    'should be in active stage now'
  )
  return contract
}

const claimAll = async (cpoa, investorAccounts) => {
  const payouts = investorAccounts.map(() => new BigNumber(0))
  for (let i = 0; i < investorAccounts.length; i += 1) {
    try {
      const investor = investorAccounts[i]
      const claimableAmount = await cpoa.currentPayout(investor, true)
      assert(claimableAmount.greaterThan(0), "0 balance won't claim")
      console.log(
        `claiming for ${investor} ${claimableAmount.div(1e18).toString()}`
      )
      const meta = await cpoa.claim({ from: investor, gasPrice: 0 })
      const payoutValue = meta.logs[0].args.payout
      payouts[i] = payoutValue
    } catch (error) {
      assert(
        !/invalid opcode/.test(error),
        'Claim Failed(',
        await web3.eth.getBalance(cpoa.address),
        ') : ' + error.message
      )
      console.error(error)
    }
  }

  return payouts
}

/* eslint-enable no-console */

module.exports = {
  getAccountInformation,
  activeContract,
  claimAll
}
