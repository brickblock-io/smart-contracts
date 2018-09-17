/* eslint-disable no-console */
const truffleConfig = require('../../truffle')

let web3

const setWeb3 = _web3 => (web3 = _web3)

// given an offset in second, returns seconds since unix epoch
const unixTimeWithOffsetInSec = (offset = 0) =>
  Math.floor(Date.now() / 1000) + offset

const getEtherBalance = address => {
  return new Promise((resolve, reject) => {
    web3.eth.getBalance(address, (err, res) => {
      if (err) reject(err)

      resolve(res)
    })
  })
}

const sendTransaction = args => {
  return new Promise(function(resolve, reject) {
    web3.eth.sendTransaction(args, (err, res) => {
      if (err) {
        reject(err)
      } else {
        resolve(res)
      }
    })
  })
}

const getDefaultGasPrice = networkName => {
  const networkProperties = truffleConfig.networks[networkName]

  return networkProperties.gasPrice
}

const calculateUsedGasFromCost = (networkName, totalcost) => {
  const gasPrice = getDefaultGasPrice(networkName)

  return totalcost.div(gasPrice)
}

const isValidAddress = address => {
  if (/^(0x)?[0-9a-f]{40}$/i.test(address)) {
    return true
  } else {
    return false
  }
}

const isBigNumber = value => {
  const keys = Object.keys(value)
  return keys.includes('s') && keys.includes('e') && keys.includes('c')
}

const getAccounts = accounts => {
  return {
    owner: accounts[0],
    broker: accounts[1],
    custodian: accounts[2],
    whitelistedInvestor: accounts[3],
    contributors: accounts.slice(4, 6)
  }
}

module.exports = {
  setWeb3,
  getEtherBalance,
  unixTimeWithOffsetInSec,
  getDefaultGasPrice,
  calculateUsedGasFromCost,
  sendTransaction,
  isValidAddress,
  getAccounts,
  isBigNumber
}
