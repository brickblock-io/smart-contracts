const WarpTool = artifacts.require('tools/WarpTool')
const BrickblockContractRegistry = artifacts.require(
  'BrickblockContractRegistry'
)
const BrickblockWhitelist = artifacts.require('BrickblockWhitelist')
const BrickblockFeeManager = artifacts.require('BrickblockFeeManager')
const BrickblockAccessToken = artifacts.require('BrickblockAccessToken')
const BrickblockToken = artifacts.require('BrickblockToken')
const BrickblockAccount = artifacts.require('BrickblockAccount')

const BigNumber = require('bignumber.js')

const setupRegistry = async () => {
  const reg = await BrickblockContractRegistry.new()
  const wht = await BrickblockWhitelist.new()
  const fmr = await BrickblockFeeManager.new(reg.address)
  const act = await BrickblockAccessToken.new(reg.address)
  const bbk = await BrickblockToken.new(web3.eth.accounts[0])
  const bat = await BrickblockAccount.new(reg.address, 1000)
  await reg.updateContract('Whitelist', wht.address)
  await reg.updateContract('FeeManager', fmr.address)
  await reg.updateContract('AccessToken', act.address)
  await reg.updateContract('BrickblockToken', bbk.address)
  await reg.updateContract('BrickblockAccount', bat.address)

  return {
    whitelist: wht,
    feeManager: fmr,
    accessToken: act,
    registry: reg
  }
}

const finalizeBbk = async reg => {
  const bbkAddress = await reg.getContractAddress('BrickblockToken')
  const bbk = BrickblockToken.at(bbkAddress)
  const actAddress = await reg.getContractAddress('AccessToken')
  await bbk.changeFountainContractAddress(actAddress)
  const accounts = web3.eth.accounts.slice(1)
  for (const account of accounts) {
    await bbk.distributeTokens(account, 1e18)
    const bbkBalance = await bbk.balanceOf(account)
    assert.equal(
      bbkBalance.toString(),
      new BigNumber(1e18).toString(),
      'each account should get 1e18 BBK'
    )
  }

  await bbk.finalizeTokenSale()
  await bbk.unpause()
  const paused = await bbk.paused()
  assert.equal(paused, false, 'BBK should be unpaused')
}

const lockAllBbk = async reg => {
  const bbkAddress = await reg.getContractAddress('BrickblockToken')
  const actAddress = await reg.getContractAddress('AccessToken')
  const bbk = BrickblockToken.at(bbkAddress)
  const act = BrickblockAccessToken.at(actAddress)
  const accounts = web3.eth.accounts
  for (const account of accounts) {
    const balance = await bbk.balanceOf(account)
    await bbk.approve(act.address, balance, { from: account })
    await act.lockBBK(balance, { from: account })
    const lockedBBK = await act.lockedBbkOf(account)
    assert.equal(
      lockedBBK.toString(),
      balance.toString(),
      'each account should lock BBK token balance'
    )
  }
}

// assumes even length arrays of addresses and statuses for Broker or Token
const structToObject = arrayResponse => {
  const addressIndex = 0
  const statusIndex = 1
  const addresses = arrayResponse[addressIndex]
  const statuses = arrayResponse[statusIndex]
  const objectResponse = []
  for (let i = 0; i < addresses.length; i++) {
    objectResponse.push({
      address: addresses[i],
      active: statuses[i]
    })
  }

  return objectResponse
}

// assumes that passed in tuple from contract is a Broker or Token
const tupleToObject = tupleArray => {
  const address = tupleArray[0]
  const active = tupleArray[1]
  return {
    address,
    active
  }
}

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
  setupRegistry,
  finalizeBbk,
  lockAllBbk,
  structToObject,
  tupleToObject,
  bigZero,
  gasPrice,
  getEtherBalance,
  getReceipt,
  sendTransaction,
  testWillThrow,
  warpBlocks
}
