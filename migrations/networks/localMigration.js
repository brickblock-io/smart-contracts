/* eslint-disable no-console */
const bbk = require('../helpers/bbk')
const BigNumber = require('bignumber.js')
const { table } = require('table')
const {
  deployContracts,
  addContractsToRegistry,
  setFiatRate,
  getEtherBalance
} = require('../helpers/general')

const localMigration = async (deployer, accounts, contracts, web3) => {
  const owner = accounts[0]
  const contributors = accounts.slice(2, 5)
  const ownerPreEtherBalance = await getEtherBalance(owner)

  const {
    contracts: instances,
    gasCost: deployContractsGasCost
  } = await deployContracts(deployer, accounts, contracts)

  const { gasCost: addToRegistryGasCost } = await addContractsToRegistry({
    contracts: instances,
    owner
  })

  console.log('setting EUR rate')
  await setFiatRate(instances.exr, instances.exp, 'EUR', 5e4, true, {
    from: owner,
    value: 2e18
  })

  const { gasCost: finalizeBbkGasCost } = await bbk.finalizeBbk(
    instances.bbk,
    owner,
    instances.bat.address,
    contributors,
    new BigNumber('1e21')
  )

  const ownerPostEtherBalance = await getEtherBalance(owner)
  const totalGasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)

  const tableData = [
    ['Action Name', 'Gas Cost Wei', 'Gas Cost Ether'],
    [
      'Deploy Contracts',
      deployContractsGasCost.toString(),
      web3.fromWei(deployContractsGasCost).toString()
    ],
    [
      'Register Contracts',
      addToRegistryGasCost.toString(),
      web3.fromWei(addToRegistryGasCost).toString()
    ],
    [
      'Finalize BBK',
      finalizeBbkGasCost.toString(),
      web3.fromWei(finalizeBbkGasCost).toString()
    ],
    [
      'Total (including above plus minor actions)',
      totalGasCost.toString(),
      web3.fromWei(totalGasCost).toString()
    ]
  ]

  console.log(table(tableData))
}

module.exports = {
  localMigration
}
