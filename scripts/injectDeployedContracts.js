/* eslint-disable no-console */
// console output is ok in yarn task
/* eslint-disable security/detect-non-literal-fs-filename */
// this is ok since we know what files we are dealing with here
/* eslint-disable security/detect-non-literal-require */
// this is ok since we know what files we are dealing with here

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const utils = require('ethereumjs-util')
const cpoaAddressConfigPath = `${__dirname}/../build/cpoaAddressesConfig.json`

// this will go away soon and be replaced by PoaManager...
const bbkRopstenAddress = process.env.BRICKBLOCK_ROPSTEN_ADDRESS
const bbkKovanAddress = process.env.BRICKBLOCK_KOVAN_ADDRESS
const bbkRinkebyAddress = process.env.BRICKBLOCK_RINKEBY_ADDRESS

// these should stick around for the forseeable future...
const cpoaRopstenAddresses = process.env.CUSTOM_POA_ROPSTEN_ADDRESSES
  ? process.env.CUSTOM_POA_ROPSTEN_ADDRESSES.split(',')
  : []
const cpoaKovanAddresses = process.env.CUSTOM_POA_KOVAN_ADDRESSES
  ? process.env.CUSTOM_POA_KOVAN_ADDRESSES.split(',')
  : []
const cpoaRinkebyAddresses = process.env.CUSTOM_POA_RINKEBY_ADDRESSES
  ? process.env.CUSTOM_POA_RINKEBY_ADDRESSES.split(',')
  : []
const cpoaMainnetAddresses = process.env.CUSTOM_POA_MAINNET_ADDRESSES
  ? process.env.CUSTOM_POA_MAINNET_ADDRESSES.split(',')
  : []

const bbkABI = path.resolve('./build/contracts/Brickblock.json')

const resetCpoaAddressesConfig = () => {
  fs.writeFileSync(cpoaAddressConfigPath, JSON.stringify({}, null, 2))
}

const setupContract = (contractAddress, contractABIPath, chainId) => {
  const contract = require(contractABIPath)
  const sanitizedAddress = contractAddress.toLowerCase()

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
      address: sanitizedAddress,
      updated_at: Date.now()
    }
  }

  Object.assign(contract.networks, networks)
  fs.writeFileSync(contractABIPath, JSON.stringify(contract, null, 2))

  console.log(`Injected ${chainId}:${sanitizedAddress} into ${contractABIPath}`)
}

const exportCustomPoaAddresses = (addresses, network) => {
  if (addresses.length === 0) {
    console.log(
      `⚠️  ⚠️  ⚠️  NO CONTRACT ADDRESSES FOUND FOR NETWORK ${network}! I sure hope you know what you are doing... ⚠️  ⚠️  ⚠️`
    )
    console.log('an empty array will be written to config for this network')
  }

  const sanitizedAddresses = addresses.map(address => address.toLowerCase())

  const cpoaAddressConfig = require(cpoaAddressConfigPath)
  cpoaAddressConfig[network] = sanitizedAddresses
  fs.writeFileSync(
    cpoaAddressConfigPath,
    JSON.stringify(cpoaAddressConfig, null, 2)
  )
  console.log(
    `Wrote customPoaToken addresses to config file for network ${network}`
  )
}

if (
  !bbkRopstenAddress &&
  !bbkKovanAddress &&
  !bbkRinkebyAddress &&
  cpoaRopstenAddresses.length === 0 &&
  cpoaKovanAddresses.length === 0 &&
  cpoaRinkebyAddresses.length === 0 &&
  cpoaMainnetAddresses.length === 0
) {
  console.error('no contract addresses in .env!')
  process.exit(-1)
} else {
  setupContract(bbkRopstenAddress, bbkABI, 3)
  setupContract(bbkKovanAddress, bbkABI, 42)
  setupContract(bbkRinkebyAddress, bbkABI, 4)
  resetCpoaAddressesConfig()
  exportCustomPoaAddresses(cpoaRopstenAddresses, 'ropsten')
  exportCustomPoaAddresses(cpoaKovanAddresses, 'kovan')
  exportCustomPoaAddresses(cpoaRinkebyAddresses, 'rinkeby')
  exportCustomPoaAddresses(cpoaMainnetAddresses, 'main')
}
