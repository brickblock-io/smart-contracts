const BigNumber = require('bignumber.js')
const { table } = require('table')
const {
  getEtherBalance,
  getRandomBigInt,
  getRandomInt
} = require('../test/helpers/general')
const chalk = require('chalk')

const {
  setupContracts,
  testUnlockBBK,
  testApproveAndLockManyWithIndividualAmounts,
  testPayFee,
  testClaimFeeMany,
  testTransferActManyWithIndividualAmounts,
  generateRandomLockAmounts,
  testRandomLockAndUnlock
} = require('../test/helpers/act')

describe('AccessToken Stress Tests', () => {
  describe('test scenarios with random numbers', () => {
    contract('AccessToken', accounts => {
      const owner = accounts[0]
      const bonusAddress = accounts[1]
      const feePayer = accounts[2]
      const contributors = accounts.slice(3, 7)
      const recipient = accounts[8]
      const feePayer2 = accounts[9]
      const tokenDistAmount = new BigNumber(1e24)
      const actRate = new BigNumber(1000)
      const counters = {
        totalLocksUnlocks: 0,
        totalFeePaid: new BigNumber(0),
        contributorsPreBalance: [],
        totalLockPayClaimRound: 0,
        totalLockPayTransferClaimRound: 0
      }
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

        await Promise.all(
          contributors.map(async contributor => {
            const contBalance = {
              address: contributor,
              balance: web3
                .fromWei(await getEtherBalance(contributor))
                .toString()
            }
            counters.contributorsPreBalance.push(contBalance)
          })
        )
      })

      const lockUnlockBbkRound = 30
      it('Testing lock&unlock random amount of BBK tokens', async () => {
        // eslint-disable-next-line
        console.log(
          chalk.magenta(
            `Testing lock&unlock random amount of BBK tokens for ${lockUnlockBbkRound} rounds with ${
              contributors.length
            } accounts`
          )
        )
        await testRandomLockAndUnlock(bbk, act, contributors, {
          rounds: lockUnlockBbkRound,
          min: new BigNumber(1e10),
          logBalance: true,
          logRoundInfo: true
        })
        counters.totalLocksUnlocks += lockUnlockBbkRound
      })

      it('lock BBK -> Pay Fees -> Claim fees', async () => {
        // eslint-disable-next-line
        console.log(chalk.magenta(`Testing lock BBK -> Pay Fees -> Claim fees`))

        let i = 0
        let feeValue
        let feePayerHasMoney = true

        // Loop until there is no money left in peeFayer account
        while (feePayerHasMoney) {
          const feePayerBalance = await getEtherBalance(feePayer)
          const feeValueMax = feePayerBalance.div(2).floor()
          feeValue = getRandomBigInt(1e10, feeValueMax)

          // eslint-disable-next-line
          console.log(
            chalk.cyan(`fee value: ${web3.fromWei(feeValue).toString()} ETH`)
          )

          // we substract 1e18 from the difference to make sure
          // there is enough difference between the feevalue and the balance
          // So we don't fall into insufficient funds situation
          if (feeValue.gt(feePayerBalance.sub(1e18))) {
            // eslint-disable-next-line
            console.log(
              chalk.red('******** Fee payer is out of money!! ********')
            )
            feePayerHasMoney = false
            break
          }

          counters.totalFeePaid = counters.totalFeePaid.plus(feeValue)
          // Lock random amount of BBK Tokens first
          await testApproveAndLockManyWithIndividualAmounts(
            bbk,
            act,
            contributors,
            await generateRandomLockAmounts(contributors, {
              min: new BigNumber(1e17),
              logBalance: true
            })
          )
          counters.totalLocksUnlocks++

          // eslint-disable-next-line
          console.log(chalk.yellow('Testing pay fee'))

          await testPayFee(act, fmr, feePayer, contributors, feeValue, actRate)

          const randomLockUnlockCountAfterPayFee = getRandomInt(1, 5)
          await testRandomLockAndUnlock(bbk, act, contributors, {
            rounds: randomLockUnlockCountAfterPayFee,
            logBalance: false,
            logRoundInfo: true
          })
          counters.totalLocksUnlocks += randomLockUnlockCountAfterPayFee

          // eslint-disable-next-line
          console.log(chalk.yellow('Testing claiming fee'))

          const tolerance = 1500 * (i + 1) // increase the tolerance exponentially on every iteration
          await testClaimFeeMany(act, fmr, contributors, actRate, {
            actTotalSupplyToleranceAfterBurn: tolerance
          })

          const randomLockUnlockCountAfterClaimFee = getRandomInt(1, 5)

          await testRandomLockAndUnlock(bbk, act, contributors, {
            rounds: randomLockUnlockCountAfterClaimFee
          })
          counters.totalLocksUnlocks += randomLockUnlockCountAfterClaimFee
          counters.totalFeePaid = counters.totalFeePaid.plus(feeValue)
          // eslint-disable-next-line
          console.log(chalk.green(`Passed ${i + 1} times`))
          // eslint-disable-next-line
          console.log(
            chalk.cyan(
              'Fee payer balance:',
              web3.fromWei(await getEtherBalance(feePayer)).toString(),
              'ETH'
            )
          )
          // eslint-disable-next-line
          console.log(
            chalk.cyan('ACT total supply after distribution:'),
            chalk.red((await act.totalSupply()).toString(), 'WEI'),
            chalk.yellow('tolerance:', tolerance)
          )
          // eslint-disable-next-line
          console.log(
            chalk.cyan(
              'FMR ether balance after distribution:',
              (await getEtherBalance(fmr.address)).toString(),
              'WEI'
            )
          )
          i++
        }

        counters.totalLockPayClaimRound = i
      }).timeout(1000 * 60 * 15)

      it('lock BBK -> Pay Fees -> transfer ACT -> Claim Fee -> Unlock BBK', async () => {
        // eslint-disable-next-line
        console.log(
          chalk.magenta(
            `Testing lock BBK -> Pay Fees -> transfer ACT -> Claim Fee -> Unlock BBK 10 rounds`
          )
        )
        const previousActTotalSupply = await act.totalSupply()
        const feeValue = new BigNumber(1e18)
        for (let i = 0; i < 10; i++) {
          // Lock random amount of BBK Tokens first
          await testApproveAndLockManyWithIndividualAmounts(
            bbk,
            act,
            contributors,
            await generateRandomLockAmounts(contributors, {
              min: new BigNumber(1e17),
              logBalance: true
            })
          )
          counters.totalLocksUnlocks++

          await testPayFee(act, fmr, feePayer2, contributors, feeValue, actRate)

          const actRandomAmounts = await Promise.all(
            contributors.map(async contributor => {
              const balance = await act.balanceOf(contributor)

              return getRandomBigInt(balance.div(2).floor(), balance)
            })
          )
          await testTransferActManyWithIndividualAmounts(
            act,
            contributors,
            recipient,
            actRandomAmounts
          )
          const tolerance = previousActTotalSupply.plus(1000 * (i + 1))
          await testClaimFeeMany(
            act,
            fmr,
            [...contributors, recipient],
            actRate,
            {
              actTotalSupplyToleranceAfterBurn: tolerance
            }
          )

          await Promise.all(
            contributors.map(async contributor => {
              const lockedBbkAmount = await act.lockedBbkOf(contributor)

              await testUnlockBBK(bbk, act, contributor, lockedBbkAmount)
            })
          )

          counters.totalLockPayTransferClaimRound = i + 1
          counters.totalFeePaid = counters.totalFeePaid.plus(feeValue)
          // eslint-disable-next-line
          console.log(chalk.green(`Passed ${i + 1} times`))
        }
      })

      afterEach(async () => {
        const data = [
          ['Total Lock & Unlock amount', counters.totalLocksUnlocks, '', '']
        ]

        // insert Contributors initial balances
        data.push(['Contributors initial balances', '', '', ''])
        counters.contributorsPreBalance.map(contItem => {
          data.push([
            'contributor address',
            contItem.address,
            'balance',
            contItem.balance
          ]) + ' ETH'
        })

        // Contributors insert active balances
        data.push(['Contributors active balances', '', '', ''])
        await Promise.all(
          contributors.map(async contAddress => {
            data.push([
              'contributor address',
              contAddress,
              'balance',
              web3.fromWei(await getEtherBalance(contAddress)).toString() +
                ' ETH'
            ])
          })
        )
        data.push([
          'Total Lock -> Pay -> Claim Rounds',
          counters.totalLockPayClaimRound,
          '',
          ''
        ])

        data.push([
          'Total Lock -> Pay -> Transfer -> Claim Rounds',
          counters.totalLockPayTransferClaimRound,
          '',
          ''
        ])

        data.push([
          'Total Fee Paid',
          web3.fromWei(counters.totalFeePaid).toString(),
          '',
          ''
        ])

        data.push([
          'ACT Recipient address',
          recipient,
          'balance',
          web3.fromWei(await getEtherBalance(recipient)).toString() + ' ETH'
        ])

        const actTotalsupply = (await act.totalSupply()).toString()
        data.push([
          'Access Token total supply left over',
          actTotalsupply,
          'WEI',
          ''
        ])

        const fmrBalance = (await getEtherBalance(fmr.address)).toString()
        data.push(['Fee Manager Balance', fmrBalance, 'WEI', ''])

        // eslint-disable-next-line
        console.log(table(data))
      })
    })
  })
})
