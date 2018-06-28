const fs = require('fs')
const path = require('path')
const R = require('ramda')
const sha3 = require('ethereumjs-util').sha3

// all the deployed contracts that are singletons and need to be known by downstream consumers (like
// platform web client) are stored here
const deployedContractsByNetwork = require('../config/deployed-contracts.js')

// truffle compiles and then saves artifacts here
const contractBuildDirectory = path.resolve(__dirname, '../build/contracts')

// here is what is included in the published npm module
const deployedContractsDirectory = path.resolve(
  __dirname,
  '../deployed-contracts'
)

// ensure this directory exists since we do not check this into git
if (!fs.existsSync(deployedContractsDirectory))
  fs.mkdirSync(deployedContractsDirectory)

// we group by contract name; seems more natural in the JSON file to organize by network
const deployedAddressesGroupedByContractName = R.toPairs(
  deployedContractsByNetwork
).reduce((acc, [networkId, contractsInNetwork]) => {
  R.toPairs(contractsInNetwork).forEach(([contractName, contractAddress]) => {
    // if accumulator does not have contract yet, set as empty hashmap
    if (acc[contractName] == null) acc[contractName] = {}

    // TODO: once CustomPOAToken is out, this can be removed
    if (contractName === 'CustomPOAToken') {
      const networkNames = {
        1: 'mainnet',
        4: 'rinkeby',
        42: 'kovan',
        4447: 'testnet'
      }
      // must be an array since CustomPOAToken is handle so "special" in platform
      acc[contractName][networkNames[networkId]] = [].concat(
        contractAddress.map(x => x.toLowerCase())
      )
      return
    }

    acc[contractName][networkId] = { address: contractAddress.toLowerCase() }
  })

  return acc
}, {})

// TODO:
// hopefully we never need to use CustomPOAToken and this can be removed soon
const customPoaAddressFilename = path.resolve(
  __dirname,
  '../deployed-contracts/CustomPOAToken-addresses.json'
)
const customPoaTokenAddresses =
  deployedAddressesGroupedByContractName.CustomPOAToken
delete deployedAddressesGroupedByContractName.CustomPOAToken
fs.writeFileSync(
  customPoaAddressFilename,
  JSON.stringify(customPoaTokenAddresses)
)
// end TODO: hope we remove real soon

fs.readdirSync(contractBuildDirectory).forEach(contractArtifactFilename => {
  // this is the output from truffle compile
  const contractArtifact = JSON.parse(
    fs.readFileSync(path.join(contractBuildDirectory, contractArtifactFilename))
  )

  // this is the minimal data needed to work with the contract
  // if something wants to deploy an instance of the contract, should use truffle compiled output
  const deployedContractArtifact = R.pick(['abi'], contractArtifact)

  const contractName = contractArtifactFilename.replace('.json', '')

  // add the addresses into the build artifact
  if (!R.isNil(deployedAddressesGroupedByContractName[contractName])) {
    deployedContractArtifact.networks =
      deployedAddressesGroupedByContractName[contractName]

    // TODO:
    // we use `truffle-contract` in platform, and it must have all events in each network property...
    // ideally this would be read from the ABI but somehow this lib does its own weird thing
    const events = contractArtifact.abi
      .filter(item => item.type === 'event')
      .map(event => {
        const key =
          '0x' +
          sha3(
            `${event.name}(${event.inputs.map(input => input.type).join(',')})`
          ).hexSlice()
        return { [key]: event }
      })

    deployedContractArtifact.networks = R.merge(
      deployedContractArtifact.networks,
      { events }
    )
    // end TODO: if we ever stop using truffle-contract this block can go away
  }

  // write the deployed contract to be used by consuming applications
  fs.writeFileSync(
    path.join(deployedContractsDirectory, contractArtifactFilename),
    JSON.stringify(deployedContractArtifact)
  )
})
