/* eslint-disable no-console */
const chalk = require('chalk')
const { table } = require('table')
const { calculateUsedGasFromCost } = require('./general')

const showStatistics = (costs, globals) => {
  const {
    deployContractsGasCost,
    addToRegistryGasCost,
    finalizeBbkCrowdsaleGasCost,
    setFiatRateGasCost,
    addBrokerGasCost,
    deployPoaTokenGasCost,
    whitelistAddressGasCost,
    changeOwnerGasCost,
    totalGasCost
  } = costs

  const { web3, network } = globals

  const tableData = [
    ['Action Name', 'Gas Cost GWei', 'Gas Cost Ether', 'Gas Used']
  ]

  if (deployContractsGasCost) {
    tableData.push([
      'Deploy Contracts',
      web3.fromWei(deployContractsGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(deployContractsGasCost).toString()}`,
      calculateUsedGasFromCost(network, deployContractsGasCost).toString()
    ])
  }

  if (addToRegistryGasCost) {
    tableData.push([
      'Register Contracts',
      web3.fromWei(addToRegistryGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(addToRegistryGasCost).toString()}`,
      calculateUsedGasFromCost(network, addToRegistryGasCost).toString()
    ])
  }

  if (finalizeBbkCrowdsaleGasCost) {
    tableData.push([
      'Finalize BBK',
      web3.fromWei(finalizeBbkCrowdsaleGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(finalizeBbkCrowdsaleGasCost).toString()}`,
      calculateUsedGasFromCost(network, finalizeBbkCrowdsaleGasCost).toString()
    ])
  }

  if (setFiatRateGasCost) {
    tableData.push([
      'Set Fiat Rate',
      web3.fromWei(setFiatRateGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(setFiatRateGasCost).toString()}`,
      calculateUsedGasFromCost(network, setFiatRateGasCost).toString()
    ])
  }

  if (addBrokerGasCost) {
    tableData.push([
      'Add Broker',
      web3.fromWei(addBrokerGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(addBrokerGasCost).toString()}`,
      calculateUsedGasFromCost(network, addBrokerGasCost).toString()
    ])
  }

  if (deployPoaTokenGasCost) {
    tableData.push([
      'Deploy POA Token',
      web3.fromWei(deployPoaTokenGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(deployPoaTokenGasCost).toString()}`,
      calculateUsedGasFromCost(network, deployPoaTokenGasCost).toString()
    ])
  }

  if (whitelistAddressGasCost) {
    tableData.push([
      'Whitelist Investor',
      web3.fromWei(whitelistAddressGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(whitelistAddressGasCost).toString()}`,
      calculateUsedGasFromCost(network, whitelistAddressGasCost).toString()
    ])
  }

  if (changeOwnerGasCost) {
    tableData.push([
      'Change Owner',
      web3.fromWei(changeOwnerGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(changeOwnerGasCost).toString()}`,
      calculateUsedGasFromCost(network, changeOwnerGasCost).toString()
    ])
  }

  if (totalGasCost) {
    tableData.push([
      chalk.bold('Total'),
      web3.fromWei(totalGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(totalGasCost).toString()}`,
      calculateUsedGasFromCost(network, totalGasCost).toString()
    ])
  }

  console.log(table(tableData))
}

module.exports = { showStatistics }
