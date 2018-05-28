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

// test to see if numbers are within range range = allowable difference
const areInRange = (bigNum1, bigNum2, range) =>
  (bigNum1.greaterThanOrEqualTo(bigNum2) &&
    bigNum1.sub(range).lessThanOrEqualTo(bigNum2)) ||
  (bigNum1.lessThanOrEqualTo(bigNum2) &&
    bigNum1.add(range).greaterThanOrEqualTo(bigNum2))

const send = (method, params = []) =>
  web3.currentProvider.send({ id: 0, jsonrpc: '2.0', method, params })

// increases time through ganache evm command
const timeTravel = async seconds => {
  if (seconds > 0) {
    await send('evm_increaseTime', [seconds])
    await send('evm_mine')

    const previousBlock = await web3.eth.getBlock(web3.eth.blockNumber - 1)
    const currentBlock = await web3.eth.getBlock(web3.eth.blockNumber)
    /* eslint-disable no-console */
    console.log(`💫  Warped ${seconds} seconds on new block`)
    console.log(`⏪  previous block timestamp: ${previousBlock.timestamp}`)
    console.log(`✅  current block timestamp: ${currentBlock.timestamp}`)
    /* eslint-enable no-console */
  } else {
    // eslint-disable-next-line
    console.log('💫 Did not warp... 0 seconds was given as an argument')
  }
}

const setupRegistry = async () => {
  const reg = await BrickblockContractRegistry.new()
  const wht = await BrickblockWhitelist.new()
  const fmr = await BrickblockFeeManager.new(reg.address)
  const act = await BrickblockAccessToken.new(reg.address)
  const bbk = await BrickblockToken.new(web3.eth.accounts[0])
  const bat = await BrickblockAccount.new(reg.address, 1000)
  await reg.updateContractAddress('Whitelist', wht.address)
  await reg.updateContractAddress('FeeManager', fmr.address)
  await reg.updateContractAddress('AccessToken', act.address)
  await reg.updateContractAddress('BrickblockToken', bbk.address)
  await reg.updateContractAddress('BrickblockAccount', bat.address)

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

const getGasUsed = async txHash => {
  const receipt = await getReceipt(txHash)
  return receipt.gasUsed
}

// tests the amount in Bignumber is in given range
const isInRange = (amount, gte, lte) => {
  return amount.gte(gte) && amount.lte(lte)
}

const testIsInRange = (amount, gte, lte, message) => {
  const res = isInRange(amount, gte, lte)
  message += ` ${gte} < ${amount} < ${lte} is expected`
  assert.ok(res, message)
}

const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const getRandomBigInt = (min, max) => {
  return BigNumber.random()
    .mul(max.sub(min).plus(1))
    .floor()
    .plus(min)
}

const gasPrice = new BigNumber(30e9)
const bigZero = new BigNumber(0)
const addressZero = '0x' + '0'.repeat(40)

const printJSON = x => JSON.stringify(x, null, 2)

const checkForEvent = (eventName, eventArgs, txReceipt) => {
  assert.equal(txReceipt.logs.length, 1, 'there should be one event emitted')

  const log = txReceipt.logs[0]
  assert.equal(log.event, eventName, `the event emitted is ${eventName}`)
  assert.deepEqual(
    printJSON(log.args),
    printJSON(eventArgs),
    `the event args should match ${printJSON(eventArgs)} ${printJSON(log.args)}`
  )
}

const waitForEvent = (event, optTimeout) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearTimeout(timeout)
      return reject(new Error('Timeout waiting for event'))
    }, optTimeout || 20000)
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    event.watch((err, res) => {
      clearTimeout(timeout)
      if (err) {
        return reject(err)
      }

      event.stopWatching()
      resolve(res)
    })
  })

module.exports = {
  addressZero,
  areInRange,
  bigZero,
  checkForEvent,
  finalizeBbk,
  gasPrice,
  getEtherBalance,
  getGasUsed,
  getRandomBigInt,
  getRandomInt,
  getReceipt,
  isInRange,
  lockAllBbk,
  sendTransaction,
  setupRegistry,
  testIsInRange,
  testWillThrow,
  timeTravel,
  warpBlocks,
  waitForEvent
}
