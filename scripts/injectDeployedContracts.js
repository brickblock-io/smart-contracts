/* eslint-disable no-console */
// console output is ok in yarn task

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const utils = require('ethereumjs-util')

const chainId = process.env.CHAINID
const contractAddress = process.env.BRICKBLOCK_CONTRACT_ADDRESS
const fileName = path.resolve('./build/contracts/Brickblock.json')

if (!contractAddress) {
  console.error(
    'no address configured, please specify via env CHAINID and BRICKBLOCK_CONTRACT_ADDRESS'
  )
  process.exit(-1)
}

const contract = require(fileName)

const events = contract.abi.filter(item => item.type === 'event').map(event => {
  const key =
    '0x' +
    utils
      .sha3(`${event.name}(${event.inputs.map(input => input.type).join(',')})`)
      .hexSlice()
  const ret = {}
  ret[key] = event
  return ret
})
const networks = {
  [chainId]: {
    events,
    links: {},
    address: contractAddress,
    updated_at: Date.now()
  }
}

Object.assign(contract.networks, networks)
fs.writeFileSync(fileName, JSON.stringify(contract, null, 2))

console.log(`Injected ${chainId}:${contractAddress} into ${fileName}`)
