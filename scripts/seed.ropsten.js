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

require('../config/env')

const Web3 = require('web3')
const contract = require('truffle-contract')

const web3 = new Web3()
web3.setProvider(new Web3.providers.HttpProvider('http://localhost:8545'))

const Brickblock = contract(require('contracts/Brickblock.json'))
Brickblock.setProvider(web3.currentProvider)
Brickblock.setNetwork(3)

const POAToken = contract(require('contracts/POAToken.json'))
POAToken.setProvider(web3.currentProvider)
POAToken.setNetwork(3)

const metamaskOwner = web3.eth.accounts.find(
  account =>
    account === '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'.toLowerCase()
)

const investorAccount = web3.eth.accounts.find(
  account =>
    account === '0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0'.toLowerCase()
)

console.log(
  metamaskOwner
    ? `using owner account: ${metamaskOwner}`
    : 'You dont have the owner account please import it to your client'
)

console.log(
  metamaskOwner
    ? `using investor account: ${investorAccount}`
    : 'You dont have the investor account please import it to your client'
)

const broker = metamaskOwner
const investor = investorAccount

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
    console.log(`transaction created for ${aToken.name}: ${txid}`)
    return new Promise((resolve, reject) => {
      const watcher = bb.TokenAdded({}, { fromBlock: 0 }, (err, event) => {
        if (err) {
          console.error('This is strange ...', err)
          reject(err)
        }
        console.log(event)
        if (event.transactionHash !== txid) return // these are not the txs you are looking for
        resolve(event.args.token) // the address of the token created
        watcher.stopWatching()
      })
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
  const week = day * 7
  const month = day * 30
  const tokens = [
    {
      name: 'WonderfulContract',
      symbol: 'WDR',
      custodian: broker,
      timeout: 1e18,
      totalSupply: 1000 * 1e18 /* 1e9 Ether */
    },
    {
      name: 'SuperContract',
      symbol: 'SPR',
      custodian: broker,
      timeout: day * 5,
      totalSupply: 1000 * 1e18
    },
    {
      name: 'GreatContract',
      symbol: 'GRT',
      custodian: broker,
      timeout: week,
      totalSupply: 1000 * 1e18
    },
    {
      name: 'AmazingContract',
      symbol: 'AMZ',
      custodian: broker,
      timeout: month,
      totalSupply: 1000 * 1e18
    },
    {
      name: 'CoolContract',
      symbol: 'COO',
      custodian: broker,
      timeout: month,
      totalSupply: 1000 * 1e18
    },
    {
      name: 'NeatContract',
      symbol: 'NET',
      custodian: broker,
      timeout: month,
      totalSupply: 1000 * 1e18
    },
    {
      name: 'OKContract',
      symbol: 'OKC',
      custodian: broker,
      timeout: 1e18,
      totalSupply: 1000 * 1e18
    },
    {
      name: 'HoorayContract',
      symbol: 'HOO',
      custodian: broker,
      timeout: 1e18,
      totalSupply: 1000 * 1e18
    },
    {
      name: 'AnotherContract',
      symbol: 'ANO',
      custodian: broker,
      timeout: 1e18,
      totalSupply: 1000 * 1e18
    },
    {
      name: 'PendingContract',
      symbol: 'PDG',
      custodian: broker,
      timeout: day,
      totalSupply: 10 * 1e18
    },
    {
      name: 'FailedContract',
      symbol: 'FLD',
      custodian: broker,
      timeout: 10,
      totalSupply: 1 * 1e18
    },
    {
      name: 'ActivatedContract',
      symbol: 'ACV',
      custodian: broker,
      timeout: 10,
      totalSupply: 10 * 1e18
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
      tokens.slice(-3).map(async aToken => {
        await makePending(aToken)
      })
    )

    console.log('Make Pending done')

    await activatePoA(tokens.slice(-2)[0])
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
