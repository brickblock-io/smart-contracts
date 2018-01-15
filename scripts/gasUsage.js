/*
   Creates a PoA Contract and does diffrent stuff with it.

   will shoe useful information about Gas Usage
*/

/* eslint-disable no-console */
// console output is ok in yarn task

const paths = require('../config/paths.js')
const Web3 = require('web3')
const Contract = require('truffle-contract')

const web3 = new Web3()
web3.setProvider(new Web3.providers.HttpProvider('http://localhost:8545'))

// This is only dangerous when the filename is derived from user-input which its not here
// eslint-disable-next-line security/detect-non-literal-require
const Brickblock = Contract(require(paths.appContracts + '/Brickblock.json'))
Brickblock.setProvider(web3.currentProvider)
Brickblock.setNetwork('local-dev-testrpc')

// This is only dangerous when the filename is derived from user-input which its not here
// eslint-disable-next-line security/detect-non-literal-require
const PoAToken = Contract(require(paths.appContracts + '/POAToken.json'))
PoAToken.setProvider(web3.currentProvider)
PoAToken.setNetwork('local-dev-testrpc')

const broker = web3.eth.accounts[0]
const investor = web3.eth.accounts[9]
const investor2 = web3.eth.accounts[8]

const maxGas = 4712388

function constructSignature(custodian, symbol, totalSupply) {
  let amount = web3.toAscii(web3.toHex(totalSupply))
  while (amount.length < 32) amount = '\x00' + amount

  // produces bytes of form
  // 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 c2ab c38d for total supply of 0xabcd
  const payload = web3.toHex(symbol + amount)
  // results in hex string like
  // "0x544b4e000000000000000000000000000000000000000000000000000000000000abcd"
  const hash = web3.sha3(payload, { encoding: 'hex' })
  const signature = web3.eth.sign(custodian, hash)
  const r = signature.slice(0, 66)
  const s = '0x' + signature.slice(66, 130)
  let v = '0x' + signature.slice(130, 132)
  v = web3.toDecimal(v) + 27

  return { v, r, s }
}

function awaitReceipt(txid) {
  return new Promise(resolve => {
    const aWait = async () => {
      const receipt = await web3.eth.getTransactionReceipt(txid)
      if (!receipt) {
        setTimeout(aWait, 100) // eslint-disable-line no-undef
      } else {
        resolve(receipt)
      }
    }
    aWait()
  })
}

async function createBB() {
  try {
    const BB = web3.eth.contract(Brickblock.abi)
    const contract = BB.new({
      from: broker,
      gas: maxGas,
      data: Brickblock.unlinked_binary
    })
    return awaitReceipt(contract.transactionHash)
  } catch (err) {
    console.error(`Creating BrickBlock umbrella Contract failed : ${err}`)
    throw err
  }
}

async function createToken(aToken) {
  try {
    console.log(`Creating PoATokenContract for ${aToken.symbol}`)
    const bb = await Brickblock.deployed()
    const estimateGas = await bb.addToken.estimateGas(
      aToken.name,
      aToken.symbol,
      aToken.custodian,
      aToken.timeout,
      aToken.totalSupply,
      {
        from: broker,
        gas: maxGas
      }
    )
    const txid = await bb.addToken.sendTransaction(
      aToken.name,
      aToken.symbol,
      aToken.custodian,
      aToken.timeout,
      aToken.totalSupply,
      {
        from: broker,
        gas: maxGas
      }
    )
    return new Promise((resolve, reject) => {
      const watcher = bb.TokenAdded(
        {},
        { fromBlock: 0 },
        async (err, event) => {
          if (err) {
            console.error('Error from Event', err)
            reject(err)
            return
          }

          if (event.transactionHash !== txid) return

          const receipt = await web3.eth.getTransactionReceipt(txid)
          resolve({
            addr: event.args.token,
            gasUsed: receipt.gasUsed,
            estimateGas: estimateGas
          })
          watcher.stopWatching()
        }
      )
    })
  } catch (err) {
    console.error(`Token Creation Failed [${aToken.symbol}] :${err}`)
    throw err
  }
}
async function buyTokens(aToken, amount, investee) {
  console.log(`Buying Tokens ${aToken.symbol}`)
  try {
    const poa = await PoAToken.at(aToken.addr)
    if (!amount) amount = await poa.balanceOf(await poa.owner()) // buy all of it

    const args = {
      from: investee,
      value: amount
    }
    const estimateGas = await poa.buy.estimateGas(args)
    const txid = await poa.buy.sendTransaction(args)
    const ret = await awaitReceipt(txid)
    ret.estimateGas = estimateGas
    return ret
  } catch (err) {
    console.error(`Can't buy everything [${aToken.symbol}] :${err}`)
    throw err
  }
}

async function activatePoA(aToken, signee) {
  console.log(`Activate [${aToken.symbol}]`)
  try {
    if (!signee) signee = broker

    const poa = await PoAToken.at(aToken.addr)
    const signature = constructSignature(
      signee,
      await poa.symbol(),
      await poa.totalSupply()
    )
    const estimateGas = await poa.activate.estimateGas(
      signature.v,
      signature.r,
      signature.s,
      {
        from: broker
      }
    )
    const txid = await poa.activate.sendTransaction(
      signature.v,
      signature.r,
      signature.s,
      {
        from: broker
      }
    )
    const ret = await awaitReceipt(txid)
    ret.estimateGas = estimateGas
    return ret
  } catch (err) {
    console.error('Activation Failed', err)
    throw err
  }
}

async function sell(aToken, amount, investee) {
  console.log(`Sell tokens back to the Broker[${aToken.symbol}]`)
  try {
    const poa = await PoAToken.at(aToken.addr)
    if (!amount) amount = await poa.balanceOf(investee) // buy all of it

    const estimateGas = await poa.sell.estimateGas(amount, { from: investee })
    const txid = await poa.sell.sendTransaction(amount, { from: investee })
    const ret = await awaitReceipt(txid)
    ret.estimateGas = estimateGas
    return ret
  } catch (err) {
    console.error('Sell failed', err)
    throw err
  }
}

async function liquidated(aToken, amount, investee) {
  console.log(
    `call Liquidated to get ether to invostor after sell[${aToken.symbol}]`
  )
  try {
    const poa = await PoAToken.at(aToken.addr)
    const estimateGas = await poa.liquidated.estimateGas(investee, {
      from: broker,
      value: amount
    })
    const txid = await poa.liquidated.sendTransaction(investee, {
      from: broker,
      value: amount
    })
    const ret = await awaitReceipt(txid)
    ret.estimateGas = estimateGas
    return ret
  } catch (err) {
    console.error('Liquidated failed', err)
    throw err
  }
}

async function payout(aToken, amount) {
  console.log(`payout some dividends [${aToken.symbol}]`)
  try {
    const poa = await PoAToken.at(aToken.addr)
    const estimateGas = await poa.payout.estimateGas({
      from: broker,
      value: amount
    })
    const txid = await poa.payout.sendTransaction({
      from: broker,
      value: amount
    })
    const ret = await awaitReceipt(txid)
    ret.estimateGas = estimateGas
    return ret
  } catch (err) {
    console.error('payout failed', err)
    throw err
  }
}

async function claim(aToken, investee) {
  console.log(`claim dividends [${aToken.symbol}]`)
  try {
    const poa = await PoAToken.at(aToken.addr)
    const estimateGas = await poa.claim.estimateGas({ from: investee })
    const txid = await poa.claim.sendTransaction({ from: investee })
    const ret = await awaitReceipt(txid)
    ret.estimateGas = estimateGas
    return ret
  } catch (err) {
    console.error('claim failed', err)
    throw err
  }
}

async function transfer(aToken, from, to, amount) {
  console.log(`transfer some tokens [${aToken.symbol}]`)
  try {
    const poa = await PoAToken.at(aToken.addr)
    if (!amount) amount = await poa.balanceOf(from)

    const estimateGas = await poa.transfer.estimateGas(to, amount, {
      from: from
    })
    const txid = await poa.transfer.sendTransaction(to, amount, { from: from })
    const ret = await awaitReceipt(txid)
    ret.estimateGas = estimateGas
    return ret
  } catch (err) {
    console.error('transfer failed', err)
    throw err
  }
}

async function reclaim(aToken, investee) {
  console.log(`reclaim funding after failed [${aToken.symbol}]`)
  try {
    const poa = await PoAToken.at(aToken.addr)
    const estimateGas = await poa.reclaim.estimateGas({ from: investee })
    const txid = await poa.reclaim.sendTransaction({ from: investee })
    const ret = await awaitReceipt(txid)
    ret.estimateGas = estimateGas
    return ret
  } catch (err) {
    console.error('reclaim failed', err)
    throw err
  }
}

async function collectGasUsage() {
  const day = 24 * 60 * 60
  const aToken = {
    name: 'TestContract',
    symbol: 'TST',
    custodian: broker,
    timeout: day,
    totalSupply: 5 * 10e17
  }

  const secondToken = {
    name: 'SecondContract With A Long And Expensive Name',
    symbol: 'SCD',
    custodian: broker,
    timeout: day,
    totalSupply: 2 * 10e17
  }

  const failedToken = {
    name: 'FailedToken',
    symbol: 'FLD',
    custodian: broker,
    timeout: 2, // 2 seconds
    totalSupply: 2 * 10e17
  }
  const results = {}

  // missing : ERC20 functions

  try {
    const BrickBlockDeployment = await createBB()
    results.BrickBlockDeployment = { gasUsage: BrickBlockDeployment.gasUsed }
    // prepare failed contract now, will be failed at the end of script due to timeout

    const createFailedResponse = await createToken(failedToken)
    failedToken.addr = createFailedResponse.addr

    const createResponse = await createToken(aToken)
    results.creation = {
      gasUsage: createResponse.gasUsed,
      gasEstim: createResponse.estimateGas
    }
    aToken.addr = createResponse.addr

    const secondTokenResponse = await createToken(secondToken)
    results.otherCreation = {
      gasUsage: secondTokenResponse.gasUsed,
      gasEstim: secondTokenResponse.estimateGas
    }
    secondToken.addr = secondTokenResponse.addr

    // first buy per Investor is more expensive
    const firstBuyResponse = await buyTokens(aToken, 1 * 10e17, investor2)
    results.buySome = {
      gasUsage: firstBuyResponse.gasUsed,
      gasEstim: firstBuyResponse.estimateGas
    }

    const secondBuyResponse = await buyTokens(aToken, 1 * 10e17, investor2)
    results.buySomeMore = {
      gasUsage: secondBuyResponse.gasUsed,
      gasEstim: secondBuyResponse.estimateGas
    }

    const buyAll = await buyTokens(aToken, null, investor) // buy all remaining
    results.buyAllFirst = {
      gasUsage: buyAll.gasUsed,
      gasEstim: buyAll.estimateGas
    }

    await buyTokens(secondToken, 1 * 10e17, investor2)
    const buyAllSecondResponse = await buyTokens(secondToken, null, investor2)
    results.buyAllSecond = {
      gasUsage: buyAllSecondResponse.gasUsed,
      gasEstim: buyAllSecondResponse.estimateGas
    }

    const failedActivationResponse = await activatePoA(aToken, investor)
    results.failedActivation = {
      gasUsage: failedActivationResponse.gasUsed,
      gasEstim: failedActivationResponse.estimateGas
    }

    const activationResponse = await activatePoA(aToken, broker)
    results.activation = {
      gasUsage: activationResponse.gasUsed,
      gasEstim: activationResponse.estimateGas
    }

    const sellSomeResponse = await sell(aToken, 1 * 10e17, investor2)
    results.sellSome = {
      gasUsage: sellSomeResponse.gasUsed,
      gasEstim: sellSomeResponse.estimateGas
    }

    const sellSomeMoreResponse = await sell(aToken, 1 * 10e16, investor2)
    results.sellSomeMore = {
      gasUsage: sellSomeMoreResponse.gasUsed,
      gasEstim: sellSomeMoreResponse.estimateGas
    }

    const sellAllResponse = await sell(aToken, null, investor2)
    results.sellAll = {
      gasUsage: sellAllResponse.gasUsed,
      gasEstim: sellAllResponse.estimateGas
    }

    const sellWithoutTokensResponse = await sell(aToken, null, investor2)
    results.sellWithoutTokens = {
      gasUsage: sellWithoutTokensResponse.gasUsed,
      gasEstim: sellWithoutTokensResponse.estimateGas
    }

    const liquidatedSomeResponse = await liquidated(aToken, 1 * 1e18, investor2)
    results.liquidateSome = {
      gasUsage: liquidatedSomeResponse.gasUsed,
      gasEstim: liquidatedSomeResponse.estimateGas
    }

    const liquidatedAllResponse = await liquidated(aToken, 1 * 10e17, investor2)
    results.liquidateAll = {
      gasUsage: liquidatedAllResponse.gasUsed,
      gasEstim: liquidatedAllResponse.estimateGas
    }

    await activatePoA(secondToken, broker)
    await sell(secondToken, null, investor2)
    const liquidateWholeContractResponse = await liquidated(
      secondToken,
      2 * 10e17,
      investor2
    )
    results.liquidateWholeContract = {
      gasUsage: liquidateWholeContractResponse.gasUsed,
      gasEstim: liquidateWholeContractResponse.estimateGas
    }

    const firstPayoutResponse = await payout(aToken, 1 * 10e17)
    results.firstPayout = {
      gasUsage: firstPayoutResponse.gasUsed,
      gasEstim: firstPayoutResponse.estimateGas
    }

    const firstClaimResponse = await claim(aToken, investor)
    results.firstClaim = {
      gasUsage: firstClaimResponse.gasUsed,
      gasEstim: firstClaimResponse.estimateGas
    }

    const secondPayoutResponse = await payout(aToken, 1 * 10e17)
    results.secondPayout = {
      gasUsage: secondPayoutResponse.gasUsed,
      gesEstim: secondPayoutResponse.estimateGas
    }

    const secondClaimResponse = await claim(aToken, investor)
    results.secondClaim = {
      gasUsage: secondClaimResponse.gasUsed,
      gasEstim: secondClaimResponse.estimateGas
    }

    const transferFirstResponse = await transfer(
      aToken,
      investor,
      investor2,
      0.5 * 10e17
    )
    results.firstTransfer = {
      gasUsage: transferFirstResponse.gasUsed,
      gasEstim: transferFirstResponse.estimateGas
    }

    const transferSecondResponse = await transfer(
      aToken,
      investor,
      investor2,
      0.5 * 10e17
    )
    results.secondTransfer = {
      gasUsage: transferSecondResponse.gasUsed,
      gasEstim: transferSecondResponse.estimateGas
    }

    await payout(aToken, 1 * 10e17)
    const transferWithPayoutResponse = await transfer(
      aToken,
      investor,
      investor2,
      0.5 * 10e17
    )
    results.transferWithPayout = {
      gasUsage: transferWithPayoutResponse.gasUsed,
      gasEstim: transferWithPayoutResponse.estimateGas
    }

    const transferAllResponse = await transfer(aToken, investor, investor2)
    results.transferAll = {
      gasUsage: transferAllResponse.gasUsed,
      gasEstim: transferAllResponse.estimateGas
    }

    await payout(aToken, 1 * 10e17)
    const transferAllWithPayoutResponse = await transfer(
      aToken,
      investor2,
      investor
    )
    results.transferAllWithPayout = {
      gasUsage: transferAllWithPayoutResponse.gasUsed,
      gasEstim: transferAllWithPayoutResponse.estimateGas
    }

    const reclaimResponse = await reclaim(failedToken, investor2)
    results.reclaim = {
      gasUsage: reclaimResponse.gasUsed,
      gasEstim: reclaimResponse.estimateGas
    }

    console.log('Results : ', JSON.stringify(results, 2, 2))
    return results
  } catch (err) {
    console.error('Failed', err)
    console.log('Results : ', JSON.stringify(results, 2, 2))

    throw err
  }
}

collectGasUsage()
  .then(() => {
    console.log('done')
    process.exit(true)
    return
  })
  .catch(err => {
    console.error(err)
    process.exit(false)
  })
