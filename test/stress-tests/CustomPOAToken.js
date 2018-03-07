const assert = require('assert')
const BigNumber = require('bignumber.js')
const { activeContract, claimAll } = require('../helpers/stress/cpoa')

/* eslint-disable no-console */

describe('CustomPoaToken Stress Tests', () => {
  let cpoa
  let owner
  let custodian
  let investors
  let broker

  describe('simulate claims & payouts 10 years (120 rounds)', () => {
    contract('CustomPOA', accounts => {
      owner = accounts[0]
      custodian = accounts[1]
      broker = accounts[2]
      investors = accounts.slice(3)

      before('setup cpoa', async () => {
        cpoa = await activeContract(
          'ProofOfAwesome',
          'CPO',
          owner,
          broker,
          custodian,
          web3.eth.blockNumber + 200,
          100e18,
          33.3333333333333e18,
          investors
        )
      })

      it('claim and payout for 10 years', async () => {
        let oldContractBalance = 0
        for (let i = 0; i < 120; i++) {
          const meta = await cpoa.payout({
            from: custodian,
            value: BigNumber.random(18).mul(1e18),
            gasPrice: new BigNumber(21e9)
          })
          console.log(
            'payout : ',
            meta.logs[0].args.amount.div(1e18).toString()
          )

          // claim owner fees
          console.log('claiming for OWNER')
          await cpoa.claim({
            from: owner
          })
          // claim or investors
          await claimAll(cpoa, investors)

          const contractBalance = await web3.eth.getBalance(cpoa.address)
          assert(
            contractBalance.greaterThanOrEqualTo(oldContractBalance),
            `contract balance went down`
          )
          oldContractBalance = contractBalance
        }

        const cpoaBalance = await web3.eth.getBalance(cpoa.address)
        assert(
          cpoaBalance.lessThan(6 * 120),
          `contract not empty ${cpoaBalance} left`
        )
      })
    })
  }).timeout(0)

  describe('simulate payout for 100 years(1200 rounds) and no one claims until then', () => {
    contract('CustomPOA', accounts => {
      owner = accounts[0]
      custodian = accounts[1]
      broker = accounts[2]
      investors = accounts.slice(3)

      before('setup cpoa', async () => {
        cpoa = await activeContract(
          'ProofOfAwesome',
          'CPO',
          owner,
          broker,
          custodian,
          web3.eth.blockNumber + 200,
          100e18,
          33.3333333333333e18,
          investors
        )
      })

      it('payout for 100 years', async () => {
        for (let i = 0; i < 1200; i++) {
          const meta = await cpoa.payout({
            from: custodian,
            value: BigNumber.random(16).mul(1e16),
            gasPrice: new BigNumber(21e9)
          })
          console.log(
            'payout : ',
            meta.logs[0].args.amount.div(1e18).toString()
          )
          // if(meta.logs[0].args.amount != '0')
          //   console.log(JSON.stringify(meta.logs,null,2))
        }

        // claim owner fees
        console.log('claiming for OWNER')
        await cpoa.claim({
          from: owner
        })
        // claim for all investors
        await claimAll(cpoa, investors)

        const cpoaBalance = await web3.eth.getBalance(cpoa.address)

        assert(
          cpoaBalance.lessThan(6),
          `contract not empty ${cpoaBalance} left`
        )
      })
    })
  }).timeout(0)

  describe('do random transfers and claim all after each payout', () => {
    contract('CustomPOA', accounts => {
      owner = accounts[0]
      custodian = accounts[1]
      broker = accounts[2]
      investors = accounts.slice(3)

      before('setup cpoa', async () => {
        cpoa = await activeContract(
          'ProofOfAwesome',
          'CPO',
          owner,
          broker,
          custodian,
          web3.eth.blockNumber + 200,
          100e18,
          33.3333333333333e18,
          investors
        )
      })

      it('random transfer, random payout,  claimAll, balances still add up ', async () => {
        const initialSupply = await cpoa.initialSupply()

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
          console.log(
            `${sender} gave ${value.div(1e18)} tokens to ${receipient}`
          )
          await cpoa.transfer(receipient, value, {
            from: sender
          })

          console.log('claiming all')

          // claim owner fees
          console.log('claiming for OWNER')
          await cpoa.claim({
            from: owner
          })
          // claim or investors
          const payouts = await claimAll(cpoa, investors)

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
        assert(
          cpoaBalance.lessThan(6 * 120),
          `contract not empty ${cpoaBalance} left`
        )
      })
    })
  }).timeout(0)

  describe('do random transfers and payouts and claims', () => {
    contract('CustomPOA', accounts => {
      owner = accounts[0]
      custodian = accounts[1]
      broker = accounts[2]
      investors = accounts.slice(3)

      before('setup cpoa', async () => {
        cpoa = await activeContract(
          'ProofOfAwesome',
          'CPO',
          owner,
          broker,
          custodian,
          web3.eth.blockNumber + 200,
          100e18,
          33.3333333333333e18,
          investors
        )
      })

      it('random transfer, random payout, random claim, balances still add up ', async () => {
        const initialSupply = await cpoa.initialSupply()

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
          console.log(
            `${sender} gave ${value.div(1e18)} tokens to ${receipient}`
          )
          await cpoa.transfer(receipient, value, {
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
        // claim owner fees
        console.log('claiming for OWNER')
        await cpoa.claim({
          from: owner
        })
        // claim for investors
        const finalPayouts = await claimAll(cpoa, investors)
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
        assert(
          cpoaBalance.lessThan(120 * 3 + 6),
          `contract not empty ${cpoaBalance} left`
        )
      })
    })
  }).timeout(0)
})
/* eslint-enable no-console */
