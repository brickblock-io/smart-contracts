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

module.exports = {
  setWeb3,
  getEtherBalance,
  unixTimeWithOffsetInSec,
  getDefaultGasPrice,
  calculateUsedGasFromCost,
  sendTransaction
}
