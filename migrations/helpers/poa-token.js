/* eslint-disable no-console */

// Ecosystem
const ContractAddresses = require('config/deployed-contracts')
const ContractRegistryAbi = require('build/contracts/ContractRegistry.json').abi
const IPoaTokenCrowdsaleAbi = require('build/contracts/IPoaTokenCrowdsale.json')
  .abi
const PoaManagerAbi = require('build/contracts/PoaManager.json').abi

// Utils
const chalk = require('chalk')
const readline = require('readline')

// Helpers
const { timeTravel } = require('helpers')

const LOCAL_TESTNET_ID = '4447'
const contractRegistryAddress =
  ContractAddresses[LOCAL_TESTNET_ID].ContractRegistry

const makeTransactionConfig = config =>
  Object.assign(
    {
      // 20 GWei
      gasPrice: 20e9,
      /*
       * Mainnet has a gas limit of roughly 8e6 at the time of writing
       * (source: https://ethstats.net )
       *
       * Truffle's gas limit defaults to 6721975
       * (source: https://github.com/trufflesuite/ganache-cli/blob/develop/args.js#L133 )
       *
       * We could tune this per contract, but here we just want to deploy contracts and
       * set up their state for e2e testing
       */
      gas: 6721975
    },
    config
  )

const instantiatePoaProxy = async () => {
  const ContractRegistry = web3.eth
    .contract(ContractRegistryAbi)
    .at(contractRegistryAddress)
  const poaManagerAddress = await ContractRegistry.getContractAddress(
    'PoaManager'
  )
  const PoaManager = web3.eth.contract(PoaManagerAbi).at(poaManagerAddress)
  const poaAddresses = await PoaManager.getTokenAddressList()
  const Poa = web3.eth.contract(IPoaTokenCrowdsaleAbi).at(poaAddresses[0])

  const initialStage = await Poa.stage()
  console.log(chalk.yellow(`➡️  PaoToken has "initialStage": ${initialStage}`))

  return Poa
}

/*
 * Helper to Skip to stage 1
 */
const startFiatSale = async () => {
  try {
    const Poa = await instantiatePoaProxy()

    console.log(chalk.yellow('➡️  Call "startFiatSale()" on Poa…'))
    const brokerAddress = '0xf17f52151ebef6c7334fad080c5704d77216b732'
    await Poa.startFiatSale(makeTransactionConfig({ from: brokerAddress }))
    const finalStage = await Poa.stage()

    console.log(
      chalk.green(`✅ Successfully moved POA stage to "${finalStage}"\n\n`)
    )
  } catch (e) {
    console.log(
      chalk.red('Error in poa-token helper "startFiatSale()" 💥\n\n'),
      e
    )
  }
}

/*
 * Helper to Skip to stage 2
 */
const startEthSale = async () => {
  try {
    /*
     * NOTE: This hack is required because the web3 objected only gets
     * injected into the first file that is being called from within the
     * truffle console. If any downstream functions in other files are
     * called, the web3 object won't be available.
     *
     * For example, without this line, the `timeTravel()` helper would fail
     * because web3 would be undefined in its context.
     */
    global.web3 = web3

    const Poa = await instantiatePoaProxy()
    const startTimeForEthFunding = await Poa.startTimeForEthFunding().toNumber()

    await timeTravel(startTimeForEthFunding)

    console.log(chalk.yellow('➡️  Call "startEthSale()" on Poa…'))
    const brokerAddress = '0xf17f52151ebef6c7334fad080c5704d77216b732'
    await Poa.startEthSale(makeTransactionConfig({ from: brokerAddress }))
    const finalStage = await Poa.stage()

    console.log(
      chalk.green(`✅ Successfully moved POA stage to "${finalStage}"\n\n`)
    )
  } catch (e) {
    console.log(
      chalk.red('Error in poa-token helper "startEthSale()" 💥\n\n'),
      e
    )
  }
}

module.exports = function(cb) {
  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  })
  prompt.question(
    'Which stage should poa Token "BBK-RE-DE123" be moved to? (FiatFunding | EthFunding)\n➡️   ',
    async input => {
      console.log(input)
      console.log(chalk.cyan(`\n🚀 Jumping to stage: ${input}`))
      switch (input) {
        case 'FiatFunding':
          await startFiatSale()
          break
        case 'EthFunding':
          await startEthSale()
          break

        default:
          console.log(
            chalk.red(
              `Stage "${input}" is invalid.\n\n\
              Supported stages are: FiatFunding | EthFunding.`
            )
          )
          break
      }

      cb()
    }
  )
}
