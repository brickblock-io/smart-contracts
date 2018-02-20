const BigNumber = require('bignumber.js')

const sendTransaction = (web3, args) => {
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

const testWillThrow = async (fn, args) => {
  try {
    await fn.apply(null, args)
    assert(false, 'the contract should throw here')
  } catch (error) {
    assert(
      /invalid opcode/.test(error),
      `the error message should be invalid opcode, the error was ${error}`
    )
  }
}

const getEtherBalance = address => {
  return new Promise((resolve, reject) => {
    web3.eth.getBalance(address, (err, res) => {
      if (err) reject(err)

      resolve(res)
    })
  })
}

const getReceipt = txHash => {
  // seems that sometimes actual transaction is returned instead of txHash
  if (typeof txHash === 'object') {
    return txHash.receipt
  }

  return new Promise(function(resolve, reject) {
    web3.eth.getTransactionReceipt(txHash, (err, res) => {
      if (err) {
        reject(err)
      }

      resolve(res)
    })
  })
}

const gasPrice = new BigNumber(30e9)
const bigZero = new BigNumber(0)

module.exports = {
  testWillThrow,
  getEtherBalance,
  getReceipt,
  gasPrice,
  bigZero,
  sendTransaction
}
