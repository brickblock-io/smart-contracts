const BigNumber = require('bignumber.js')
const { gasPrice } = require('../helpers/general')
const {
  testAddEmployee,
  testAddManyEmployees,
  testRemoveEmployee,
  testPayout
} = require('../helpers/employeeTokenSalaryPayoutHelper')

const EmployeeTokenSalaryPayoutArtifact = artifacts.require(
  'EmployeeTokenSalaryPayout'
)
const DummyContractArtifact = artifacts.require('./stubs/RemoteContractStub')
const { finalizedBBK } = require('../helpers/bbk')

describe('when distributing BBK bonus payouts', () => {
  contract('EmployeeTokenSalaryPayout', accounts => {
    const owner = accounts[0]
    const bbkHolder = accounts[1]
    const employees = accounts.slice(2)
    const defaultBbkSalaryAmount = 1000
    const defaultStartingBalance = 3234
    const defaultEndingBalance = 34552
    let employeeTokenSalaryPayoutContract
    let bbk

    beforeEach('setup contracts', async () => {
      const dummy = await DummyContractArtifact.new(1000, { from: owner })

      bbk = await finalizedBBK(
        owner,
        bbkHolder,
        dummy.address,
        [bbkHolder],
        new BigNumber(1e24)
      )
      employeeTokenSalaryPayoutContract = await EmployeeTokenSalaryPayoutArtifact.new(
        bbk.address
      )
      await bbk.transfer(
        employeeTokenSalaryPayoutContract.address,
        new BigNumber('1e24'),
        {
          from: bbkHolder
        }
      )
    })

    it('should add & remove employee', async () => {
      await testAddEmployee(
        employeeTokenSalaryPayoutContract,
        employees[0],
        defaultBbkSalaryAmount,
        defaultStartingBalance,
        {
          from: owner
        }
      )
      await testRemoveEmployee(
        bbk,
        employeeTokenSalaryPayoutContract,
        employees[0],
        defaultEndingBalance,
        {
          from: owner
        }
      )
    })

    it('should distribute bbk to all registered employees', async () => {
      await testAddManyEmployees(
        employeeTokenSalaryPayoutContract,
        employees,
        new BigNumber(defaultBbkSalaryAmount),
        defaultStartingBalance,
        {
          from: owner
        }
      )
      await testPayout(bbk, employeeTokenSalaryPayoutContract, employees, {
        from: owner,
        gasPrice
      })
    })

    it('should get correct total payout amount', async () => {
      await testAddManyEmployees(
        employeeTokenSalaryPayoutContract,
        employees,
        new BigNumber(defaultBbkSalaryAmount),
        defaultStartingBalance,
        {
          from: owner
        }
      )
      const expectedPayout = await employeeTokenSalaryPayoutContract.getTotalPayoutAmount()

      const realPayoutResult = await testPayout(
        bbk,
        employeeTokenSalaryPayoutContract,
        employees,
        {
          from: owner,
          gasPrice
        }
      )

      assert.equal(
        realPayoutResult.payoutAmount.toString(),
        expectedPayout.toString(),
        'Expected payout should match'
      )

      // eslint-disable-next-line no-console
      console.log(
        `Used gas amount for ${employees.length} accounts`,
        realPayoutResult.gasUsed
      )
    })
  })
})
