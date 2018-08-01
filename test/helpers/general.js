const WarpTool = artifacts.require('tools/WarpTool')
const ContractRegistry = artifacts.require('ContractRegistry')
const Whitelist = artifacts.require('Whitelist')
const FeeManager = artifacts.require('FeeManager')
const AccessToken = artifacts.require('AccessToken')
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
    const startBlock = await web3.eth.getBlock(web3.eth.blockNumber)

    await send('evm_increaseTime', [seconds])
    await send('evm_mine')

    const currentBlock = await web3.eth.getBlock(web3.eth.blockNumber)

    const oneMinuteInSeconds = 60
    const oneHourInSeconds = 3600
    const oneDayInSeconds = 86400

    let time = `${seconds} seconds`
    if (seconds >= oneMinuteInSeconds && seconds < oneHourInSeconds) {
      time = `${seconds / 60} minutes`
    } else if (seconds >= oneHourInSeconds && seconds < oneDayInSeconds) {
      time = `${seconds / 60 / 60} hours`
    } else if (seconds >= oneDayInSeconds) {
      time = `${seconds / 60 / 60 / 24} days`
    }

    /* eslint-disable no-console */
    console.log(`💫  Warped ${time} on new block`)
    console.log(`⏪  previous block timestamp: ${startBlock.timestamp}`)
    console.log(`✅  current block timestamp: ${currentBlock.timestamp}`)
    /* eslint-enable no-console */
  } else {
    // eslint-disable-next-line
    console.log('💫 Did not warp... 0 seconds was given as an argument')
  }
}

const setupRegistry = async () => {
  const reg = await ContractRegistry.new()
  const wht = await Whitelist.new()
  const fmr = await FeeManager.new(reg.address)
  const act = await AccessToken.new(reg.address)
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
  const act = AccessToken.at(actAddress)
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

const warpBlocks = blocks =>
  new Promise(async resolve => {
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
    const txHash = await fn.apply(null, args)

    if (web3.version.network === 4448) {
      // if network is devGeth
      await waitForReceiptStatusSuccessOrThrow(txHash)
    }

    assert(false, 'the contract should throw here')
  } catch (error) {
    assert(
      /invalid opcode/.test(error.message || error) ||
      /invalid argument/.test(error.message || error) || // needed for geth compatibility
        /revert/.test(error.message || error),
      `the error message should be "invalid opcode", "invalid argument" or "revert", the error was ${error}`
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
  if (typeof txHash === 'object' && txHash.receipt) {
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

const toBytes32 = text => {
  return web3.toHex(text)
}

const waitForReceiptStatusSuccessOrThrow = async txHash => {
  // Geth does not return error when revert happens.

  const receipt = await getReceipt(txHash)
  if (receipt.status === '0x0') {
    throw new Error('revert')
  }

  return receipt
}

const sleep = sleepTime =>
  new Promise(resolve => setTimeout(resolve, sleepTime))

const waitForTxToBeMined = txHash =>
  // waiting for a transaction to be mined into a block
  // required for geth compatibility
  new Promise(async (resolve, reject) => {
    const timeout = Date.now() + 10 * 1000 // 10 seconds to get a receipt
    let done = false

    while (timeout > Date.now() && !done) {
      web3.eth.getTransactionReceipt(txHash, (err, res) => {
        if (err || res === null) {
          // eslint-disable-next-line no-console
          console.log('Waiting for tx to be Mined.', `txHash: ${txHash}`)
          return
        }

        done = true
        resolve(true)
      })

      await sleep(1 * 1000) // 1 second interval
    }

    if (!done) reject(false)
  })

const percentBigInt = (numerator, denominator, precision) => {
  if (typeof numerator === 'number') {
    numerator = new BigNumber(numerator)
  }

  // caution, check safe-to-multiply here
  const _numerator = numerator.times(new BigNumber(10).pow(precision))
  // with rounding of last digit
  const _quotient = _numerator.div(denominator).floor()
  return _quotient
}

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
  waitForEvent,
  toBytes32,
  waitForReceiptStatusSuccessOrThrow,
  waitForTxToBeMined,
  percentBigInt
}
