// snapshot from commit hash 60b8371a5caf75e37be74d809a24447e2e366cca

const assert = require('assert')

const WarpTool = artifacts.require('WarpTool')

const BigNumber = require('bignumber.js')

const warpBlocks = blocks => {
  return new Promise(async resolve => {
    const warpTool = await WarpTool.new()
    for (let i = 0; i < blocks - 1; i++) {
      // log every fifth block
      if (i % 5 === 0) {
        // eslint-disable-next-line no-console
        console.log('💫  warping blocks')
      }

      await warpTool.warp()
    }

    // eslint-disable-next-line no-console
    console.log('✅  warp complete')
    resolve(true)
  })
}

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
      /invalid opcode/.test(error) || /revert/.test(error),
      `the error message should be invalid opcode or revert, the error was ${error}`
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
  bigZero,
  gasPrice,
  getEtherBalance,
  getReceipt,
  sendTransaction,
  testWillThrow,
  warpBlocks
}
