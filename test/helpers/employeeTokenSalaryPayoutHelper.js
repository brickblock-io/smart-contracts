// EmployeeTokenSalaryPayout Helper

const BigNumber = require('bignumber.js')
const { waitForEvent, getReceipt } = require('./general')

const testAddEmployee = async (
  employeeTokenSalaryPayoutContract,
  employee,
  quarterlyAmount,
  initialPayout,
  config
) => {
  await employeeTokenSalaryPayoutContract.addEmployee(
    employee,
    quarterlyAmount,
    initialPayout,
    config
  )

  const employeeData = await getEmployeeData(
    employeeTokenSalaryPayoutContract,
    employee
  )
  assert.equal(
    employeeData.initialPayout.toString(),
    initialPayout.toString(),
    'initialPayout balance does not match'
  )

  assert.equal(
    employeeData.quarterlyAmount.toString(),
    quarterlyAmount.toString(),
    'Quarterly amount does not match'
  )

  return employeeData
}

const testAddManyEmployees = async (
  employeeTokenSalaryPayoutContract,
  employees,
  quarterlyAmount,
  initialPayout,
  config
) => {
  for (let index = 0; index < employees.length; index++) {
    const employee = employees[index]
    await testAddEmployee(
      employeeTokenSalaryPayoutContract,
      employee,
      quarterlyAmount,
      initialPayout,
      config
    )
  }
}

const testRemoveEmployee = async (
  bbk,
  employeeTokenSalaryPayoutContract,
  employee,
  endingBalance,
  config
) => {
  const preBonusContractBbkBalance = await bbk.balanceOf(
    employeeTokenSalaryPayoutContract.address
  )
  const preEmployeeBbkBalance = await bbk.balanceOf(employee)
  await employeeTokenSalaryPayoutContract.removeEmployee(
    employee,
    endingBalance,
    config
  )

  const employeeData = await getEmployeeData(
    employeeTokenSalaryPayoutContract,
    employee
  )
  const postBonusContractBbkBalance = await bbk.balanceOf(
    employeeTokenSalaryPayoutContract.address
  )
  const postEmployeeBbkBalance = await bbk.balanceOf(employee)

  const expectedBonusContractBalance = preBonusContractBbkBalance.minus(
    endingBalance
  )

  const expectedEmployeeBalance = preEmployeeBbkBalance.plus(endingBalance)

  assert.equal(
    postBonusContractBbkBalance.toString(),
    expectedBonusContractBalance.toString(),
    'Bonus contract balance does not match with the expected'
  )

  assert.equal(
    postEmployeeBbkBalance.toString(),
    expectedEmployeeBalance.toString(),
    'Employee balance does not match with the expected.'
  )

  return employeeData
}

const testPayout = async (
  bbk,
  employeeTokenSalaryPayoutContract,
  employees,
  config
) => {
  const preBonusContractBbkBalance = await bbk.balanceOf(
    employeeTokenSalaryPayoutContract.address
  )
  let expectedTotalDistroAmount = new BigNumber(0)

  //collect employee data before payout
  const preEmployeeObject = []

  for (let index = 0; index < employees.length; index++) {
    const employeeAddress = employees[index]
    const employeeData = await getEmployeeData(
      employeeTokenSalaryPayoutContract,
      employeeAddress
    )
    employeeData.balance = await bbk.balanceOf(employeeAddress)
    employeeData.expectedBalanceAfterPayout = employeeData.balance
      .plus(employeeData.initialPayout)
      .plus(employeeData.quarterlyAmount)

    expectedTotalDistroAmount = expectedTotalDistroAmount.plus(
      employeeData.expectedBalanceAfterPayout
    )
    preEmployeeObject.push(employeeData)
  }

  const txHash = await employeeTokenSalaryPayoutContract.distributePayouts(
    config
  )
  const tx = await getReceipt(txHash)

  //collect employee data after payout
  const postEmployeeObject = []
  for (let index = 0; index < employees.length; index++) {
    const employeeAddress = employees[index]
    const employeeData = await getEmployeeData(
      employeeTokenSalaryPayoutContract,
      employeeAddress
    )
    employeeData.balance = await bbk.balanceOf(employeeAddress)
    postEmployeeObject.push(employeeData)
  }

  const postBonusContractBbkBalance = await bbk.balanceOf(
    employeeTokenSalaryPayoutContract.address
  )
  const { args: distribute } = await waitForEvent(
    employeeTokenSalaryPayoutContract.Distribute()
  )
  const expectedBonusContractBalance = preBonusContractBbkBalance.minus(
    expectedTotalDistroAmount
  )

  for (let index = 0; index < employees.length; index++) {
    const currentPreEmployeeObject = preEmployeeObject[index]
    const currentPostEmployeeObject = postEmployeeObject[index]

    assert.equal(
      currentPostEmployeeObject.balance.toString(),
      currentPreEmployeeObject.expectedBalanceAfterPayout.toString(),
      'Expected balance does not match for user after payout'
    )
  }

  assert.equal(
    postBonusContractBbkBalance.toString(),
    expectedBonusContractBalance.toString(),
    'Bonus contract balance does not match with the expected'
  )

  assert.equal(
    distribute.amount.toString(),
    expectedTotalDistroAmount.toString(),
    'Total distributed payout amount should match the expected'
  )

  return {
    payoutAmount: distribute.amount,
    gasUsed: tx.gasUsed
  }
}

const getEmployeeData = async (
  employeeTokenSalaryPayoutContract,
  employeeAddress
) => {
  const [
    initialPayout,
    quarterlyAmount,
    index
  ] = await employeeTokenSalaryPayoutContract.employees(employeeAddress)

  return {
    initialPayout,
    quarterlyAmount,
    index
  }
}

module.exports = {
  testAddEmployee,
  testAddManyEmployees,
  testRemoveEmployee,
  testPayout
}
