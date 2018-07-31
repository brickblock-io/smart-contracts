/* eslint-disable no-console */
const chalk = require('chalk')
const BigNumber = require('bignumber.js')
const { table } = require('table')

const {
  oneWeekInMs,
  twoWeeksInMs,
  oneHundredThousandEuroInCents,
  oneHundredThousandTokensInWei
} = require('../../config/constants')
const {
  deployContracts,
  addContractsToRegistry,
  getEtherBalance
} = require('../helpers/general')
const bbk = require('../helpers/bbk')
const poaManager = require('../helpers/poa-manager')
const exchangeRates = require('../helpers/exchange-rates')

const localMigration = async (deployer, accounts, contracts, web3) => {
  const owner = accounts[0]
  const broker = accounts[1]
  const custodian = accounts[2]
  const contributors = accounts.slice(4, 6)
  const ownerPreEtherBalance = await getEtherBalance(owner)
  const brokerPreEtherBalance = await getEtherBalance(broker)

  /*
   * Get deployed contract instances first
   */
  const {
    contracts: instances,
    gasCost: deployContractsGasCost
  } = await deployContracts(deployer, accounts, contracts)

  /*
   * Add contract instances to our contract registry
   */
  const { gasCost: addToRegistryGasCost } = await addContractsToRegistry({
    contracts: instances,
    owner
  })

  /*
   * Set ETH <> Fiat exchange rate in our oracle
   */
  const { gasCost: setFiatRateGasCost } = await exchangeRates.setFiatRate(
    instances.exr,
    instances.exp,
    {
      currencyName: 'EUR',
      queryString: 'https://min-api.cryptocompare.com/data/price?fsym=ETH',
      callIntervalInSec: 30,
      callbackGasLimit: 150000,
      useStub: true,
      config: {
        from: owner,
        value: 2e18
      }
    }
  )

  /*
   * Finalize BBK crowdsale and distribute tokens to accounts[4-6]
   */
  const { gasCost: finalizeBbkGasCost } = await bbk.finalizeBbk(
    instances.bbk,
    owner,
    instances.bat.address,
    contributors,
    new BigNumber('1e21')
  )

  /*
   * Add broker to list of active brokers in PoaManager
   */
  const { gasCost: addBrokerGasCost } = await poaManager.addBroker(
    instances.pmr,
    { addresses: { owner, broker } }
  )

  /*
   * Deploy new POA token from the previously added broker address
   */

  const { gasCost: deployPoaTokenGasCost } = await poaManager.deployPoa(
    instances.pmr,
    {
      addresses: {
        broker,
        custodian
      },
      poa: {
        name: 'Local Testnet Token',
        symbol: 'BBK-RE-DE123',
        fiatCurrency: 'EUR',
        totalSupply: oneHundredThousandTokensInWei,
        startTime: Date.now(),
        fundingTimeout: Date.now() + oneWeekInMs,
        activationTimeout: Date.now() + twoWeeksInMs,
        fundingGoalInCents: oneHundredThousandEuroInCents
      }
    }
  )

  const ownerPostEtherBalance = await getEtherBalance(owner)
  const brokerPostEtherBalance = await getEtherBalance(broker)
  const totalGasCost = ownerPreEtherBalance
    .sub(ownerPostEtherBalance)
    .add(brokerPreEtherBalance.sub(brokerPostEtherBalance))

  const tableData = [
    ['Action Name', 'Gas Cost GWei', 'Gas Cost Ether'],
    [
      'Deploy Contracts',
      web3.fromWei(deployContractsGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(deployContractsGasCost).toString()}`
    ],
    [
      'Register Contracts',
      web3.fromWei(addToRegistryGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(addToRegistryGasCost).toString()}`
    ],
    [
      'Finalize BBK',
      web3.fromWei(finalizeBbkGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(finalizeBbkGasCost).toString()}`
    ],
    [
      'Set Fiat Rate',
      web3.fromWei(setFiatRateGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(setFiatRateGasCost).toString()}`
    ],
    [
      'Add Broker',
      web3.fromWei(addBrokerGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(addBrokerGasCost).toString()}`
    ],
    [
      'Deploy POA Token',
      web3.fromWei(deployPoaTokenGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(deployPoaTokenGasCost).toString()}`
    ],
    [
      chalk.bold('Total'),
      web3.fromWei(totalGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(totalGasCost).toString()}`
    ]
  ]

  console.log(table(tableData))
}

module.exports = {
  localMigration
}
