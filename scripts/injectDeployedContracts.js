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

const poaManagerRopstenAddress = process.env.POA_MANAGER_ROPSTEN_ADDRESS
const poaManagerKovanAddress = process.env.POA_MANAGER_KOVAN_ADDRESS
const poaManagerRinkebyAddress = process.env.POA_MANAGER_RINKEBY_ADDRESS

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

const poaManagerAbi = path.resolve('./build/contracts/PoaManager.json')

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
  !poaManagerRopstenAddress &&
  !poaManagerKovanAddress &&
  !poaManagerRinkebyAddress &&
  cpoaRopstenAddresses.length === 0 &&
  cpoaKovanAddresses.length === 0 &&
  cpoaRinkebyAddresses.length === 0 &&
  cpoaMainnetAddresses.length === 0
) {
  console.error('no contract addresses in .env!')
  process.exit(-1)
} else {
  setupContract(poaManagerRopstenAddress, poaManagerAbi, 3)
  setupContract(poaManagerKovanAddress, poaManagerAbi, 42)
  setupContract(poaManagerRinkebyAddress, poaManagerAbi, 4)
  resetCpoaAddressesConfig()
  exportCustomPoaAddresses(cpoaRopstenAddresses, 'ropsten')
  exportCustomPoaAddresses(cpoaKovanAddresses, 'kovan')
  exportCustomPoaAddresses(cpoaRinkebyAddresses, 'rinkeby')
  exportCustomPoaAddresses(cpoaMainnetAddresses, 'main')
}
