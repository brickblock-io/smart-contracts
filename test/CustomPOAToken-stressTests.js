const CustomPOAToken = artifacts.require('CustomPOAToken')
const WarpTool = artifacts.require('WarpTool')
const assert = require('assert')
const BigNumber = require('bignumber.js')

async function getAccountInformation(address, contract) {
  const etherBalance = await getEtherBalance(address)
  const tokenBalance = await contract.balanceOf(address)
  const currentPayout = await contract.currentPayout(address, true)

  return {
    etherBalance,
    tokenBalance,
    currentPayout
  }
}

let cpoa
const accounts = web3.eth.accounts
const owner = accounts[0]
const broker = accounts[1]
const custodian = accounts[2]
const nonInvestor = accounts[3]
const investors = accounts.slice(4)

async function activeContract(_totalSupply, _fundingGoal) {
  const totalSupply = new BigNumber(_totalSupply)
  const fundingGoal = new BigNumber(_fundingGoal)
  const contract = await CustomPOAToken.new(
    'ProofOfAwesome',
    'POA',
    broker,
    custodian,
    web3.eth.blockNumber + 200,
    totalSupply,
    fundingGoal
  )
  let remainingBalance = fundingGoal.sub(
    await web3.eth.getBalance(contract.address)
  )
  await Promise.all(
    investors.map(investor => contract.whitelistAddress(investor))
  )
  let i = 0
  while (remainingBalance >= 100) {
    const l = investors.length

    assert.equal(
      (await contract.stage()).toString(),
      '0',
      'should be in funding stage now'
    )
    const investAmount = BigNumber.min(
      remainingBalance,
      BigNumber.random(18)
        .mul(fundingGoal.div(6))
        .floor()
    )
    const meta = await contract.buy({
      from: investors[i % l],
      value: investAmount
    })
    remainingBalance = fundingGoal.sub(
      await web3.eth.getBalance(contract.address)
    )
    console.log(remainingBalance / 1e18, investAmount / 1e18)

    i++
  }

  assert.equal(
    (await contract.stage()).toString(),
    '1',
    'should be in penidng stage now'
  )
  const fee = await contract.calculateFee(fundingGoal)
  await contract.activate({ from: custodian, value: fee })
  assert.equal(
    (await contract.stage()).toString(),
    '3',
    'should be in active stage now'
  )
  return contract
}

async function claimAll(investors) {
  const payouts = investors.map(() => new BigNumber(0))
  for (let i = 0; i < investors.length; i += 1) {
    try {
      const investor = investors[i]
      const claimableAmount = await cpoa.currentPayout(investor, true)
      assert(claimableAmount.greaterThan(0), "0 balance won't claim")
      console.log(`claiming for ${investor} ${claimableAmount / 1e18}`)
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

describe('Claim and Payout 10years(120 rounds)', () => {
  contract('CustomPOA', () => {
    it('should create cpoa', async () => {
      cpoa = await activeContract(1000e18, 33.3333333333333e18)
    })

    it('claim and payout for 10 years', async () => {
      let oldContractBalance = 0
      for (var i = 0; i < 120; i++) {
        const meta = await cpoa.payout({
          from: custodian,
          value: BigNumber.random(18).mul(1e18),
          gasPrice: new BigNumber(21e9)
        })
        console.log('payout : ', meta.logs[0].args.amount.div(1e18).toString())
        // if(meta.logs[0].args.amount != '0')
        //   console.log(JSON.stringify(meta.logs,null,2))

        await claimAll(investors)

        const contractBalance = await web3.eth.getBalance(cpoa.address)
        assert(
          contractBalance.greaterThanOrEqualTo(oldContractBalance),
          `contract balance went down`
        )
        oldContractBalance = contractBalance
      }
      const cpoaBalance = await web3.eth.getBalance(cpoa.address)
      console.log(`${cpoaBalance} in WEI`)
      assert(
        cpoaBalance.lessThan(6 * 120),
        `contract not empty ${cpoaBalance} left`
      )
    })
  })
}).timeout(0)

describe('Payout for 100 years(1200 rounds) and no one claims until then', () => {
  contract('CustomPOA', () => {
    it('should create cpoa', async () => {
      cpoa = await activeContract(1000e18, 33.3333333333333e18)
    })

    it('payout for 100 years', async () => {
      let oldContractBalance = 0
      for (var i = 0; i < 1200; i++) {
        const meta = await cpoa.payout({
          from: custodian,
          value: BigNumber.random(16).mul(1e16),
          gasPrice: new BigNumber(21e9)
        })
        console.log('payout : ', meta.logs[0].args.amount.div(1e18).toString())
        // if(meta.logs[0].args.amount != '0')
        //   console.log(JSON.stringify(meta.logs,null,2))
      }

      await claimAll(investors)

      const cpoaBalance = await web3.eth.getBalance(cpoa.address)

      console.log(`${cpoaBalance} in WEI`)
      assert(cpoaBalance.lessThan(6), `contract not empty ${cpoaBalance} left`)
    })
  })
}).timeout(0)

describe('do random transfers and claim all after each payout', () => {
  contract('CustomPOA', () => {
    it('should create cpoa', async () => {
      /* ether    tokens */
      cpoa = await activeContract(1000e18, 33.3333333333333e18)
    })

    it('random transfer, random payout,  claimAll, balances still add up ', async () => {
      const initialSupply = await cpoa.initialSupply()
      const fundingGoal = await cpoa.initialSupply()

      const anyInvestor = () =>
        investors[Math.floor(Math.random() * investors.length)]
      const aBalance = async user =>
        (await cpoa.balanceOf(user)).mul(BigNumber.random(18)).floor()

      const totalPayouts = investors.map(() => new BigNumber(0))
      const realPayouts = investors.map(() => new BigNumber(0))

      for (let c = 0; c < 120; c++) {
        // do a any Payout
        const payoutMeta = await cpoa.payout({
          from: custodian,
          value: BigNumber.random(18).mul(1e18)
        })
        const payoutTotal = payoutMeta.logs[0].args.amount
        console.log(`payout of ${payoutTotal} was paid`)
        await Promise.all(
          investors.map(async (investor, i) => {
            const balance = await cpoa.balanceOf(investor)
            const expectedPayout = balance
              .mul(
                payoutTotal
                  .mul(1e18)
                  .div(initialSupply)
                  .floor()
              )
              .div(1e18)
              .floor()
            totalPayouts[i] = totalPayouts[i].add(expectedPayout)
          })
        )

        // do any transfer
        const sender = anyInvestor()
        const receipient = anyInvestor()
        const value = await aBalance(sender)
        console.log(`${sender} gave ${value.div(1e18)} tokens to ${receipient}`)
        const transferMeta = await cpoa.transfer(receipient, value, {
          from: sender
        })
        // console.log(JSON.stringify(transferMeta, null, 2))

        console.log('claiming all')
        const payouts = await claimAll(investors)
        realPayouts.forEach((payout, i) => {
          realPayouts[i] = payout.add(payouts[i])
        })
      }

      assert.deepEqual(
        totalPayouts.map(t => t.toString()),
        realPayouts.map(t => t.toString()),
        'payouts do not match'
      )
      const cpoaBalance = await web3.eth.getBalance(cpoa.address)
      console.log(`${cpoaBalance} in WEI`)
      assert(
        cpoaBalance.lessThan(6 * 120),
        `contract not empty ${cpoaBalance} left`
      )
    })
  })
}).timeout(0)

describe('do random transfers and payouts and claims', () => {
  contract('CustomPOA', () => {
    it('should create cpoa', async () => {
      /* ether    tokens */
      cpoa = await activeContract(1000e18, 33.3333333333333e18)
    })

    it('random transfer, random payout, random claim, balances still add up ', async () => {
      const initialSupply = await cpoa.initialSupply()
      const fundingGoal = await cpoa.initialSupply()

      const anyInvestor = () =>
        investors[Math.floor(Math.random() * investors.length)]
      const aBalance = async user =>
        (await cpoa.balanceOf(user)).mul(BigNumber.random(18)).floor()

      const totalPayouts = investors.map(() => new BigNumber(0))
      const realPayouts = investors.map(() => new BigNumber(0))

      for (let c = 0; c < 120; c++) {
        // do any transfer
        const sender = anyInvestor()
        const receipient = anyInvestor()
        const value = await aBalance(sender)
        console.log(`${sender} gave ${value.div(1e18)} tokens to ${receipient}`)
        const transferMeta = await cpoa.transfer(receipient, value, {
          from: sender
        })

        // do a any Payout
        const payoutMeta = await cpoa.payout({
          from: custodian,
          value: BigNumber.random(18).mul(1e18)
        })
        const payoutTotal = payoutMeta.logs[0].args.amount
        console.log(`payout of ${payoutTotal} was paid`)
        await Promise.all(
          investors.map(async (investor, i) => {
            const balance = await cpoa.balanceOf(investor)
            const expectedPayout = balance
              .mul(
                payoutTotal
                  .mul(1e18)
                  .div(initialSupply)
                  .floor()
              )
              .div(1e18)
              .floor()
            totalPayouts[i] = totalPayouts[i].add(expectedPayout)
          })
        )

        const claimer = anyInvestor()

        // do any claim
        const claimMeta = await cpoa.claim({ from: claimer })
        const payout = claimMeta.logs[0].args.payout
        realPayouts[investors.indexOf(claimer)] = realPayouts[
          investors.indexOf(claimer)
        ].add(payout)
        console.log(`${claimer} claimed ${payout}`)
      }

      console.log('claiming all')
      const finalPayouts = await claimAll(investors)
      console.log(JSON.stringify([finalPayouts, realPayouts], null, 2))
      realPayouts.forEach((payout, i) => {
        realPayouts[i] = payout.add(finalPayouts[i])
      })

      assert.deepEqual(
        totalPayouts.map(t =>
          t
            .div(1000)
            .floor()
            .toString()
        ),
        realPayouts.map(t =>
          t
            .div(1000)
            .floor()
            .toString()
        ),
        'payouts do not match'
      )

      const cpoaBalance = await web3.eth.getBalance(cpoa.address)
      console.log(`${cpoaBalance} in WEI`)
      assert(
        cpoaBalance.lessThan(120 * 3 + 6),
        `contract not empty ${cpoaBalance} left`
      )
    })
  })
}).timeout(0)
