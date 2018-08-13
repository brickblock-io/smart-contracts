/* eslint-disable no-console */
// Ecosystem
const poaTokenProxyABI = require('../../build/contracts/IPoaTokenCrowdsale.json')
  .abi

// Utils
const chalk = require('chalk')
const readline = require('readline')

const instantiatePoaProxy = async () => {
  const poaTokenProxyAddress = '0x1ecced27e8ac1256a9f7f19004735d27d729203c'
  const poaToken = web3.eth.contract(poaTokenProxyABI).at(poaTokenProxyAddress)

  const initialStage = await poaToken.stage()
  console.log(chalk.yellow(`➡️  paoToken has initialStage: ${initialStage}`))

  return poaToken
}

/*
 * Helper to Skip to stage 1
 */
const startFiatSale = async () => {
  try {
    const poaToken = await instantiatePoaProxy(web3)

    console.log(chalk.yellow('➡️  call startFiatSale on poaCrowdSale…'))
    const brokerAddress = '0xf17f52151ebef6c7334fad080c5704d77216b732'
    await poaToken.startFiatSale({ from: brokerAddress, gasPrice: 1e9 })
    const finalStage = await poaToken.stage()

    console.log(
      chalk.cyan(
        `✅ Successfully moved POA token contract stage to "${finalStage}"\n\n`
      )
    )
  } catch (e) {
    console.log(chalk.red('poa-token helper startFiatSale 💥\n\n'), e)
  }
}

// TODO this does not really work, and I'm not suyre why :(

/*
 * Helper to Skip to stage 2
 */
const startEthSale = async () => {
  try {
    const poaToken = await instantiatePoaProxy(web3)
    const startTimeForEthFunding = await poaToken.startTimeForEthFunding()

    console.log(
      chalk.yellow(
        `➡️  timetravel ${startTimeForEthFunding}ms to startTimeForEthFunding…`
      )
    )
    await web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [startTimeForEthFunding],
      id: new Date().getSeconds()
    })
    console.log(chalk.yellow('➡️  mine latest block…'))
    await web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      params: [],
      id: new Date().getSeconds()
    })

    console.log(chalk.yellow('➡️  call startEthSale on poaCrowdSale…'))
    const brokerAddress = '0xf17f52151ebef6c7334fad080c5704d77216b732'
    await poaToken.startEthSale({ from: brokerAddress, gasPrice: 1e9 })
    const finalStage = await poaToken.stage()

    console.log(
      chalk.cyan(
        `✅ Successfully moved POA token contract stage to "${finalStage}"\n\n`
      )
    )
  } catch (e) {
    console.log(chalk.red('poa-token helper startEthSale 💥\n\n'), e)
  }
}

// TODO async makes the cli duplicate letters :P
module.exports = function(cb) {
  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  prompt.question(
    'Which stage should poa Token "BBK-RE-DE123" should be moved to? (FiatFunding | EthFunding)',
    async input => {
      console.log(input)
      console.log(chalk.yellow(`Jumping to stage: ${input}`))
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
              `Stage "${input}" is not valid.\n\n\
              Supported stages are: FiatFunding | EthFunding.`
            )
          )
          break
      }

      cb()
    }
  )
}
