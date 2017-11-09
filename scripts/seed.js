/*
   Creates 4 PoA Contracts
   1 for every possible of the 4 stages a PoA contract can have:
   - 0: funding
   - 1: pending
   - 2: failed
   - 3: active
*/

/* eslint-disable no-console */
// console output is ok in yarn task

// require('../config/env')

const Web3 = require('web3')
const contract = require('truffle-contract')

const web3 = new Web3()
web3.setProvider(new Web3.providers.HttpProvider('http://localhost:9545'))

const Brickblock = contract(require('contracts/Brickblock.json'))
Brickblock.setProvider(web3.currentProvider)
Brickblock.setNetwork('local-dev-testrpc')

const POAToken = contract(require('contracts/POAToken.json'))
POAToken.setProvider(web3.currentProvider)
POAToken.setNetwork('local-dev-testrpc')

const broker = web3.eth.accounts[0]
const investor = web3.eth.accounts[9]

const maxGas = 4712388

async function createToken(aToken) {
  try {
    console.log(`Creating POATokenContract for ${aToken.symbol}`)
    const bb = await Brickblock.deployed()
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
            console.error('This is strange ...', err)
            reject(err)
          }
          if (event.transactionHash !== txid) return // these are not the txs you are looking for
          resolve(event.args.token) // the address of the token created
          watcher.stopWatching()
        }
      )
    })
  } catch (err) {
    console.error(`Token Creation Failed [${aToken.symbol}] :${err}`)
    throw err
  }
}
async function makePending(aToken) {
  console.log(`Buying all the Supply ${aToken.symbol}`)
  try {
    const poa = await POAToken.at(aToken.addr)
    const remainingTokens = await poa.balanceOf(await poa.owner()) // owner holds remaining tokens
    await poa.buy.sendTransaction({
      from: investor,
      value: remainingTokens
    })
    return new Promise((resolve, reject) => {
      const watcher = poa.Stage({}, { fromBlock: 0 }, (err, event) => {
        if (err) {
          console.error('Error from Event', err)
          reject(err)
          return
        }
        console.log(
          `Stage Change Event [${aToken.symbol}]`,
          web3.toDecimal(event.args.stage)
        )
        if (web3.toDecimal(event.args.stage) === 1) {
          // pending
          resolve(true)
          watcher.stopWatching()
        }
      })
    })
  } catch (err) {
    console.error(`Can't buy everything [${aToken.symbol}] :${err}`)
    throw err
  }
}

function constructSignature(custoidan, symbol, totalSupply) {
  let amount = web3.toAscii(web3.toHex(totalSupply))
  while (amount.length < 32) amount = '\x00' + amount

  const payload = web3.toHex(symbol + amount)
  const hash = web3.sha3(payload, { encoding: 'hex' })
  const signature = web3.eth.sign(broker, hash)
  const r = signature.slice(0, 66)
  const s = '0x' + signature.slice(66, 130)
  let v = '0x' + signature.slice(130, 132)
  v = web3.toDecimal(v) + 27

  return { v, r, s }
}

async function activatePoA(aToken) {
  try {
    const poa = await POAToken.at(aToken.addr)
    const signature = constructSignature(
      broker,
      await poa.symbol(),
      await poa.totalSupply()
    )
    await poa.activate.sendTransaction(signature.v, signature.r, signature.s, {
      from: broker
    })
    return new Promise((resolve, reject) => {
      const watcher = poa.Stage({}, { fromBlock: 0 }, (err, event) => {
        if (err) {
          console.error('Error from Event', err)
          reject(err)
          return
        }
        console.log(
          `Waiting for Activation. Stage is : ${aToken.symbol}[${web3.toDecimal(
            event.args.stage
          )}]`
        )
        if (web3.toDecimal(event.args.stage) === 3) {
          // pending
          resolve(true)
          watcher.stopWatching()
        }
      })
    })
  } catch (err) {
    console.error('Activation Failed', err)
    throw err
  }
}

async function createDevEnvironment() {
  const day = 24 * 60 * 60
  const tokens = [
    {
      name: 'TestContract',
      symbol: 'TST',
      custodian: broker,
      timeout: day,
      totalSupply: 10 * 10e17 /* 10 Ether */
    },
    {
      name: 'PendingContract',
      symbol: 'PDG',
      custodian: broker,
      timeout: day,
      totalSupply: 10 * 10e17
    },
    {
      name: 'FailedContract',
      symbol: 'FLD',
      custodian: broker,
      timeout: 10,
      totalSupply: 10 * 10e17
    },
    {
      name: 'ActivatedContract',
      symbol: 'ACV',
      custodian: broker,
      timeout: 10,
      totalSupply: 10 * 10e17
    }
  ]

  try {
    await Promise.all(
      tokens.map(async aToken => {
        const addr = await createToken(aToken)
        aToken.addr = addr
        console.log(`Token Created [${aToken.symbol}] : ${aToken.addr}`)
      })
    )

    console.log('Tokens Created')

    await Promise.all(
      tokens.slice(1).map(async aToken => {
        await makePending(aToken)
      })
    )

    console.log('Make Pending done')

    await activatePoA(tokens.slice(-1)[0])
  } catch (err) {
    console.error('Failed', err)
    throw err
  }
}

createDevEnvironment()
  .then(() => {
    console.log('Created some tokens for your pleasure')
  })
  .catch(err => console.error(err))
