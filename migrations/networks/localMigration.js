/* eslint-disable no-console */
const chalk = require('chalk')
const BigNumber = require('bignumber.js')
const { table } = require('table')

const migrationHelpers = require('../helpers')

const localMigration = async (deployer, accounts, contracts, web3) => {
  const {
    brickblockToken,
    constants: {
      oneWeekInSec,
      twoWeeksInSec,
      oneHundredThousandEuroInCents,
      oneHundredThousandTokensInWei
    },
    exchangeRates,
    general: {
      addContractsToRegistry,
      deployContracts,
      getEtherBalance,
      unixTimeWithOffsetInSec
    },
    poaManager,
    whitelist
  } = migrationHelpers

  const owner = accounts[0]
  const broker = accounts[1]
  const custodian = accounts[2]
  const contributors = accounts.slice(4, 6)
  const whitelistedInvestor = accounts[4]
  const ownerStartEtherBalance = await getEtherBalance(owner)
  const brokerStartEtherBalance = await getEtherBalance(owner)
  let ownerPreEtherBalance, ownerPostEtherBalance, brokerPostEtherBalance

  /*
   * Get deployed contract instances first
   */
  ownerPreEtherBalance = await getEtherBalance(owner)
  const instances = await deployContracts(deployer, accounts, contracts)
  ownerPostEtherBalance = await getEtherBalance(owner)
  const deployContractsGasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)

  /*
   * Add contract instances to our contract registry
   */
  ownerPreEtherBalance = await getEtherBalance(owner)
  await addContractsToRegistry(instances, { from: owner })
  ownerPostEtherBalance = await getEtherBalance(owner)
  const addToRegistryGasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)

  /*
   * Set ETH <> Fiat exchange rate in our oracle
   */
  ownerPreEtherBalance = await getEtherBalance(owner)
  await exchangeRates.setFiatRate(
    instances.ExchangeRates,
    instances.ExchangeRateProvider,
    {
      currencyName: 'EUR',
      queryString: 'https://min-api.cryptocompare.com/data/price?fsym=ETH',
      callIntervalInSec: 30,
      callbackGasLimit: 150000,
      useStub: true
    },
    { from: owner }
  )
  ownerPostEtherBalance = await getEtherBalance(owner)
  const setFiatRateGasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)

  /*
   * Finalize BBK crowdsale and distribute tokens to accounts[4-6]
   */
  ownerPreEtherBalance = await getEtherBalance(owner)
  await brickblockToken.finalizeBbkCrowdsale(
    instances.BrickblockToken,
    {
      fountainAddress: instances.BrickblockAccount.address,
      contributors,
      tokenAmountPerContributor: new BigNumber(100e18)
    },
    { from: owner }
  )
  ownerPostEtherBalance = await getEtherBalance(owner)
  const finalizeBbkCrowdsaleGasCost = ownerPreEtherBalance.sub(
    ownerPostEtherBalance
  )

  /*
   * Add broker to list of active brokers in PoaManager
   */
  ownerPreEtherBalance = await getEtherBalance(owner)
  await poaManager.addBroker(instances.PoaManager, { broker }, { from: owner })
  ownerPostEtherBalance = await getEtherBalance(owner)
  const addBrokerGasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)

  /*
   * Deploy new POA token from the previously added broker address
   */
  const brokerPreEtherBalance = await getEtherBalance(broker)
  await poaManager.deployPoa(
    instances.PoaManager,
    {
      name: 'Local Testnet Token',
      symbol: 'BBK-RE-DE123',
      fiatCurrency: 'EUR',
      custodian,
      totalSupply: oneHundredThousandTokensInWei,
      // startTimeForEthFunding needs a little offset so that it isn't too close to `block.timestamp` which would fail
      startTimeForEthFunding: unixTimeWithOffsetInSec(60),
      endTimeForEthFunding: unixTimeWithOffsetInSec(oneWeekInSec),
      activationTimeout: unixTimeWithOffsetInSec(twoWeeksInSec),
      fundingGoalInCents: oneHundredThousandEuroInCents
    },
    { from: broker }
  )
  brokerPostEtherBalance = await getEtherBalance(broker)
  const deployPoaTokenGasCost = brokerPreEtherBalance.sub(
    brokerPostEtherBalance
  )

  /*
   * Whitelist accounts[4] to be able to buy POA tokens in platform
   */
  ownerPreEtherBalance = await getEtherBalance(owner)
  await whitelist.addAddress(
    instances.Whitelist,
    {
      investor: whitelistedInvestor
    },
    { from: owner }
  )
  ownerPostEtherBalance = await getEtherBalance(owner)
  const whitelistAddressGasCost = ownerPreEtherBalance.sub(
    ownerPostEtherBalance
  )

  /*
   * Display gas cost for deploying full ecosystem
   */
  ownerPostEtherBalance = await getEtherBalance(owner)
  brokerPostEtherBalance = await getEtherBalance(broker)
  const totalGasCost = ownerStartEtherBalance
    .sub(ownerPostEtherBalance)
    .add(brokerStartEtherBalance.sub(brokerPostEtherBalance))

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
      web3.fromWei(finalizeBbkCrowdsaleGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(finalizeBbkCrowdsaleGasCost).toString()}`
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
      'Whitelist Investor',
      web3.fromWei(whitelistAddressGasCost, 'gwei').toString(),
      `Ξ ${web3.fromWei(whitelistAddressGasCost).toString()}`
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
