/* eslint-disable no-console */
const BigNumber = require('bignumber.js')

const migrationHelpers = require('../helpers')

const localMigration = async (deployer, accounts, contracts, web3, network) => {
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
    whitelist,
    statistics
  } = migrationHelpers

  const owner = accounts[0]
  const broker = accounts[1]
  const custodian = accounts[2]
  const contributors = accounts.slice(4, 6)
  const whitelistedInvestor = accounts[4]
  const ownerStartEtherBalance = await getEtherBalance(owner)
  const brokerStartEtherBalance = await getEtherBalance(broker)
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
      // startTimeForEthFundingPeriod needs a little offset so that it isn't too close to `block.timestamp` which would fail
      startTimeForEthFundingPeriod: unixTimeWithOffsetInSec(60),
      durationForEthFundingPeriod: oneWeekInSec,
      durationForActivationPeriod: twoWeeksInSec,
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

  statistics.showStatistics(
    {
      deployContractsGasCost,
      addToRegistryGasCost,
      finalizeBbkCrowdsaleGasCost,
      setFiatRateGasCost,
      addBrokerGasCost,
      deployPoaTokenGasCost,
      whitelistAddressGasCost,
      totalGasCost
    },
    {
      web3,
      network
    }
  )
}

module.exports = {
  localMigration
}
