/* eslint-disable no-console */

// Utils
const BigNumber = require('bignumber.js')
const contract = require('truffle-contract')
const Web3 = require('web3')
const migrationHelpers = require('../migrations/helpers')
const deployPoaTokensInEveryStage = require('./deploy-poa-in-every-stage')
const {
  makeTransactionConfig,
  resolvePromiseMap,
} = require('../helpers/general')

// Contracts
const AccessTokenABI = require('../build/contracts/AccessToken.json')
const BrickblockAccountABI = require('../build/contracts/BrickblockAccount.json')
const BrickblockTokenABI = require('../build/contracts/BrickblockToken.json')
const ContractRegistryABI = require('../build/contracts/ContractRegistry.json')
const ExchangeRateProviderStubABI = require('../build/contracts/ExchangeRateProviderStub.json')
const ExchangeRatesABI = require('../build/contracts/ExchangeRates.json')
const FeeManagerABI = require('../build/contracts/FeeManager.json')
const PoaCrowdsaleABI = require('../build/contracts/PoaCrowdsale.json')
const PoaLoggerABI = require('../build/contracts/PoaLogger.json')
const PoaManagerABI = require('../build/contracts/PoaManager.json')
const PoaTokenABI = require('../build/contracts/PoaToken.json')
const WhitelistABI = require('../build/contracts/Whitelist.json')

const deployContract = async (abi, { web3, args, txConfig }) => {
  console.log(`\n➡️   Deploying ${abi.contractName}…`)

  const Contract = contract(abi)
  Contract.setProvider(web3.currentProvider)
  const deployedContractInstance = args
    ? await Contract.new(...args, txConfig)
    : await Contract.new(txConfig)

  return deployedContractInstance
}

const deploySmartContracts = async ganachePort => {
  // connect to local testnet
  const web3 = new Web3(
    new Web3.providers.HttpProvider(`http://localhost:${ganachePort}`)
  )

  const accounts = {
    // we select the first account from web.eth.accounts in portal web client
    fiatInvestor: web3.eth.accounts[0],
    ethInvestor: web3.eth.accounts[1],
    owner: web3.eth.accounts[2],
    bonus: web3.eth.accounts[3],
    issuer: web3.eth.accounts[4],
    custodian: web3.eth.accounts[5],
    anyone: web3.eth.accounts[9],
  }

  console.log('\n🚀  Deploying contracts…\n')

  // we need ContractRegistry to deploy most contracts in the ecosystem, so it goes first
  const ContractRegistry = await deployContract(ContractRegistryABI, {
    web3,
    txConfig: makeTransactionConfig({ from: accounts.owner }),
  })

  // the other contract are not dependant on anything else, and can go at once
  const contractEcosystem = await resolvePromiseMap({
    ContractRegistry,
    AccessToken: deployContract(AccessTokenABI, {
      web3,
      args: [ContractRegistry.address],
      txConfig: makeTransactionConfig({ from: accounts.owner }),
    }),
    BrickblockAccount: deployContract(BrickblockAccountABI, {
      web3,
      args: [
        ContractRegistry.address,
        // 2 years in seconds
        migrationHelpers.general.unixTimeWithOffsetInSec(
          60 * 60 * 24 * 365 * 2
        ),
      ],
      txConfig: makeTransactionConfig({ from: accounts.owner }),
    }),
    BrickblockToken: deployContract(BrickblockTokenABI, {
      web3,
      args: [accounts.bonus],
      txConfig: makeTransactionConfig({ from: accounts.owner }),
    }),
    // NOTE: we are using the test stub for this contract, so we can use `simulate__callback`
    ExchangeRateProvider: deployContract(ExchangeRateProviderStubABI, {
      web3,
      args: [ContractRegistry.address],
      txConfig: makeTransactionConfig({ from: accounts.owner }),
    }),
    ExchangeRates: deployContract(ExchangeRatesABI, {
      web3,
      args: [ContractRegistry.address],
      txConfig: makeTransactionConfig({ from: accounts.owner }),
    }),
    FeeManager: deployContract(FeeManagerABI, {
      web3,
      args: [ContractRegistry.address],
      txConfig: makeTransactionConfig({ from: accounts.owner }),
    }),
    PoaLogger: deployContract(PoaLoggerABI, {
      web3,
      args: [ContractRegistry.address],
      txConfig: makeTransactionConfig({ from: accounts.owner }),
    }),
    PoaManager: deployContract(PoaManagerABI, {
      web3,
      args: [ContractRegistry.address],
      txConfig: makeTransactionConfig({ from: accounts.owner }),
    }),
    PoaCrowdsaleMaster: deployContract(PoaCrowdsaleABI, {
      web3,
      txConfig: makeTransactionConfig({ from: accounts.owner }),
    }),
    PoaTokenMaster: deployContract(PoaTokenABI, {
      web3,
      txConfig: makeTransactionConfig({ from: accounts.owner }),
    }),
    Whitelist: deployContract(WhitelistABI, {
      web3,
      txConfig: makeTransactionConfig({ from: accounts.owner }),
    }),
  })

  console.log('\n✅  Successfully deployed all contracts\n\n')

  // Add contract instances to our contract registry
  await migrationHelpers.registry.addContractsToRegistry(
    contractEcosystem,
    makeTransactionConfig({ from: accounts.owner })
  )

  // Set ETH <> Fiat exchange rate in our oracle
  const exchangeRateParams = await migrationHelpers.exchangeRates.setFiatRate(
    contractEcosystem.ExchangeRates,
    contractEcosystem.ExchangeRateProvider,
    undefined, // use defaults as defined in this helper
    makeTransactionConfig({ from: accounts.owner })
  )

  // Finalize BBK crowdsale and distribute tokens to investor
  await migrationHelpers.brickblockToken.finalizeBbkCrowdsale(
    contractEcosystem.BrickblockToken,
    {
      fountainAddress: contractEcosystem.BrickblockAccount.address,
      contributors: [accounts.fiatInvestor, accounts.ethInvestor],
      tokenAmountPerContributor: new BigNumber(100e18),
    },
    makeTransactionConfig({ from: accounts.owner })
  )

  // Add issuer to list of active issuers in PoaManager
  await migrationHelpers.poaManager.addIssuer(
    contractEcosystem.PoaManager,
    { issuer: accounts.issuer },
    makeTransactionConfig({ from: accounts.owner })
  )

  // Whitelist the fiat and eth investors
  await Promise.all(
    [accounts.fiatInvestor, accounts.ethInvestor].map(investorAddress =>
      migrationHelpers.whitelist.addAddress(
        contractEcosystem.Whitelist,
        { investor: investorAddress },
        makeTransactionConfig({ from: accounts.owner })
      )
    )
  )

  // Lock some BBK tokens, otherwise `payFee` will always fail during POA `payActivationFee`
  await Promise.all(
    [accounts.fiatInvestor, accounts.ethInvestor].map(async investorAddress => {
      const lockAmount = 10e18

      await contractEcosystem.BrickblockToken.approve(
        contractEcosystem.AccessToken.address,
        lockAmount,
        makeTransactionConfig({ from: investorAddress })
      )

      await contractEcosystem.AccessToken.lockBBK(
        lockAmount,
        makeTransactionConfig({ from: investorAddress })
      )
    })
  )

  // Deploy one POA in each stage it can be in
  await deployPoaTokensInEveryStage(
    accounts,
    contractEcosystem.PoaManager,
    {
      fiatCurrency: exchangeRateParams.currencyName,
      exchangeRate: exchangeRateParams.desiredExchangeRate,
    },
    web3
  )
}

module.exports = deploySmartContracts
