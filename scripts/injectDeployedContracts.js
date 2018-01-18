/* eslint-disable no-console */
// console output is ok in yarn task

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const utils = require('ethereumjs-util')

// this will go away soon and be replaced by BrickblockUmbrella...
const bbkRopstenAddress = process.env.BRICKBLOCK_ROPSTEN_ADDRESS
const bbkKovanAddress = process.env.BRICKBLOCK_KOVAN_ADDRESS

// these should stick around for the forseeable future...
const cpoaRopstenAddress = process.env.CUSTOM_POA_ROPSTEN_ADDRESS
const cpoaKovanAddress = process.env.CUSTOM_POA_KOVAN_ADDRESS
const cpoaMainAddress = process.env.CUSTOM_POA_MAINNET_ADDRESS

const bbkABI = path.resolve('./build/contracts/Brickblock.json')
const cpoaABI = path.resolve('./build/contracts/CustomPOAToken.json')

let contract

if(
  !bbkRopstenAddress ||
  !bbkKovanAddress ||
  !cpoaRopstenAddress ||
  !cpoaKovanAddress
) {
  console.error('missing a contract address in .env')
  process.exit(-1)
} else {
  setupContract(bbkRopstenAddress, bbkABI, 3)
  setupContract(bbkKovanAddress, bbkABI, 42)
  setupContract(cpoaRopstenAddress, cpoaABI, 3)
  setupContract(cpoaKovanAddress, cpoaABI, 42)
  setupContract(cpoaMainAddress, cpoaABI, 0)
}

function setupContract(contractAddress, contractABIPath, chainId) {
  const contract = require(contractABIPath)

  const events = contract.abi
    .filter(item => item.type === 'event')
    .map(event => {
      const key =
        '0x' +
        utils
          .sha3(
            `${event.name}(${event.inputs.map(input => input.type).join(',')})`
          )
          .hexSlice()
      const ret = {}
      ret[key] = event
      return ret
    })

  const networks = {
    [chainId.toString()]: {
      events,
      links: {},
      address: contractAddress,
      updated_at: Date.now()
    }
  }

  Object.assign(contract.networks, networks)
  fs.writeFileSync(contractABIPath, JSON.stringify(contract, null, 2))

  console.log(`Injected ${chainId}:${contractAddress} into ${contractABIPath}`)
}
