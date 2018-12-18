/* eslint-disable no-console */
const BigNumber = require('bignumber.js')
const { argv } = require('../helpers/arguments')
const logger = require('../../scripts/lib/logger')

const migrationHelpers = require('../helpers')

const deploymentActions = async (
  deployer,
  accounts,
  contracts,
  web3,
  network
) => {
  const {
    brickblockToken,
    exchangeRates,
    general: { getEtherBalance, sendTransaction, isValidAddress, getAccounts },
    deployment: { deployContracts },
    registry: { addContractsToRegistry },
    poaManager,
    whitelist,
    statistics,
    ownerManagement: { transferOwnershipOfAllContracts },
  } = migrationHelpers

  const {
    owner,
    issuer,
    custodian,
    whitelistedInvestor,
    contributors,
  } = getAccounts(accounts)

  const ownerStartEtherBalance = await getEtherBalance(owner)
  const issuerStartEtherBalance = await getEtherBalance(issuer)
  let ownerPreEtherBalance,
    ownerPostEtherBalance,
    issuerPostEtherBalance,
    addToRegistryGasCost,
    setFiatRateGasCost,
    finalizeBbkCrowdsaleGasCost,
    addIssuerGasCost,
    deployPoaTokenGasCost,
    whitelistAddressGasCost,
    changeOwnerGasCost

  // Use stub for exchange rate provider only in local testnet
  const useStub = network.search('dev') > -1

  // default actions group
  const actions = {
    register: argv.register,
    setRate: argv.setRate,
    finalizeBbk: argv.finalizeBbk,
    addIssuer: argv.addIssuer,
    addToWhiteList: argv.addToWhiteList,
  }

  let hasParams = false
  Object.keys(actions).forEach(key => {
    hasParams = hasParams || actions[key]
  })

  if (argv.default) {
    Object.keys(actions).forEach(key => {
      actions[key] = true
    })
  }

  /*
   * Get deployed contract instances first
   */
  ownerPreEtherBalance = await getEtherBalance(owner)
  const instances = await deployContracts(deployer, accounts, contracts, {
    useExpStub: useStub,
    useExistingContracts: argv.useExistingContracts,
    network,
  })
  ownerPostEtherBalance = await getEtherBalance(owner)
  const deployContractsGasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)

  if (actions.register) {
    /*
     * Add contract instances to our contract registry
     */
    ownerPreEtherBalance = await getEtherBalance(owner)
    await addContractsToRegistry(instances, { from: owner })
    ownerPostEtherBalance = await getEtherBalance(owner)
    addToRegistryGasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)
  }

  if (actions.setRate) {
    /*
     * Set ETH <> Fiat exchange rate in our oracle
     */
    ownerPreEtherBalance = await getEtherBalance(owner)
    const symbol = argv.setRateSymbol
    await exchangeRates.setFiatRate(
      instances.ExchangeRates,
      instances.ExchangeRateProvider,
      {
        currencyName: symbol,
        queryString: `json(https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=${symbol}).${symbol}`,
        callIntervalInSec: argv.setRateInterval,
        callbackGasLimit: argv.setRateGasLimit,
        useStub,
      },
      { from: owner }
    )
    ownerPostEtherBalance = await getEtherBalance(owner)
    setFiatRateGasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)
  }

  if (actions.finalizeBbk) {
    /*
     * Finalize BBK crowdsale and distribute tokens to accounts[4-6]
     */
    ownerPreEtherBalance = await getEtherBalance(owner)
    await brickblockToken.finalizeBbkCrowdsale(
      instances.BrickblockToken,
      {
        fountainAddress: instances.BrickblockAccount.address,
        contributors,
        tokenAmountPerContributor: new BigNumber(100e18),
        network,
      },
      { from: owner }
    )
    ownerPostEtherBalance = await getEtherBalance(owner)
    finalizeBbkCrowdsaleGasCost = ownerPreEtherBalance.sub(
      ownerPostEtherBalance
    )
  }

  if (actions.addIssuer) {
    /*
     * Add issuer to list of active issuers in PoaManager
     */
    ownerPreEtherBalance = await getEtherBalance(owner)
    await poaManager.addIssuer(
      instances.PoaManager,
      { issuer },
      { from: owner }
    )
    ownerPostEtherBalance = await getEtherBalance(owner)
    addIssuerGasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)
  }

  if (argv.deployPoa) {
    /*
     * Deploy new POA token from the previously added issuer address
     */
    const issuerPreEtherBalance = await getEtherBalance(issuer)
    if (issuerPreEtherBalance.lt('3.25e16')) {
      await sendTransaction({
        from: owner,
        to: issuer,
        value: new BigNumber(3.25e16),
      })
    }

    await poaManager.deployPoa(
      instances.PoaManager,
      {
        name: argv.deployPoaName,
        symbol: argv.deployPoaSymbol,
        fiatCurrency: argv.deployPoaCurrency,
        custodian: argv.deployPoaCustodian || custodian,
        totalSupply: argv.deployPoaTotalSupply,
        // startTimeForFundingPeriod needs a little offset so that it isn't too close to `block.timestamp` which would fail
        startTimeForFundingPeriod: argv.deployPoaStartTimeForFunding,
        durationForFiatFundingPeriod: argv.deployPoaDurationForFiatFunding,
        durationForEthFundingPeriod: argv.deployPoaDurationForEthFunding,
        durationForActivationPeriod: argv.deployPoaDurationForActivation,
        fundingGoalInCents: argv.deployPoaFundingGoalInCents,
        listToken: argv.deployPoaListToken,
      },
      { from: argv.deployPoaIssuer || issuer }
    )
    issuerPostEtherBalance = await getEtherBalance(issuer)
    deployPoaTokenGasCost = issuerPreEtherBalance.sub(issuerPostEtherBalance)
  }

  if (actions.addToWhiteList) {
    /*
     * Whitelist accounts[4] to be able to buy POA tokens in platform
     */

    let addressToWhiteList
    if (isValidAddress(argv.addToWhiteList)) {
      addressToWhiteList = argv.addToWhiteList
    } else {
      if (typeof argv.addToWhiteList !== 'undefined') {
        logger.error(
          'The address given to whitelist is not a valid Ethereum address. Falling back to default...'
        )
      }

      addressToWhiteList = whitelistedInvestor
    }

    ownerPreEtherBalance = await getEtherBalance(owner)
    await whitelist.addAddress(
      instances.Whitelist,
      {
        investor: addressToWhiteList,
      },
      { from: owner }
    )
    ownerPostEtherBalance = await getEtherBalance(owner)
    whitelistAddressGasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)
  }

  if (argv.changeOwner) {
    /*
     * Used for changing ownership of all contracts to the real owner
     * Usually used on mainnet deployment
     */
    ownerPreEtherBalance = await getEtherBalance(owner)

    const newOwner = process.env.NEW_OWNER
    await transferOwnershipOfAllContracts(instances, owner, newOwner)
    ownerPostEtherBalance = await getEtherBalance(owner)
    changeOwnerGasCost = ownerPreEtherBalance.sub(ownerPostEtherBalance)
  }

  /*
   * Display gas cost for deploying full ecosystem
   */
  ownerPostEtherBalance = await getEtherBalance(owner)
  issuerPostEtherBalance = await getEtherBalance(issuer)
  const totalGasCost = ownerStartEtherBalance
    .sub(ownerPostEtherBalance)
    .add(issuerStartEtherBalance.sub(issuerPostEtherBalance))

  statistics.showStatistics(
    {
      deployContractsGasCost,
      addToRegistryGasCost,
      finalizeBbkCrowdsaleGasCost,
      setFiatRateGasCost,
      addIssuerGasCost,
      deployPoaTokenGasCost,
      whitelistAddressGasCost,
      changeOwnerGasCost,
      totalGasCost,
    },
    {
      web3,
      network,
    }
  )
}

module.exports = deploymentActions
