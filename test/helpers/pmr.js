const PoaManager = artifacts.require('PoaManager.sol')
const PoaToken = artifacts.require('PoaToken.sol')
const BigNumber = require('bignumber.js')
const {
  setupEcosystem,
  testSetCurrencyRate,
  defaultName,
  defaultSymbol,
  defaultFiatCurrency,
  defaultTotalSupply,
  defaultFundingTimeout,
  defaultActivationTimeout,
  defaultFundingGoal,
  defaultFiatRate,
  getDefaultStartTime,
  determineNeededTimeTravel,
  timeTravel,
  testStartSale,
  testBuyRemainingTokens,
  testActivate,
  defaultIpfsHash
} = require('./poa')

const { gasPrice } = require('./general')

const accounts = web3.eth.accounts
const owner = accounts[0]
// must be accounts 2 in order to work with poa test helpers
const custodian = accounts[2]

const setupPoaManager = async () => {
  const poam = await PoaToken.new()
  const { reg, exr, exp, fmr } = await setupEcosystem()
  const pmr = await PoaManager.new(reg.address)

  await reg.updateContractAddress('PoaManager', pmr.address)
  await reg.updateContractAddress('PoaTokenMaster', poam.address)

  await testSetCurrencyRate(exr, exp, defaultFiatCurrency, defaultFiatRate, {
    from: owner,
    value: 1e18
  })

  return {
    poam,
    reg,
    pmr,
    fmr
  }
}

const addToken = async (pmr, config) => {
  const defaultStartTime = await getDefaultStartTime()

  const txReceipt = await pmr.addToken(
    defaultName,
    defaultSymbol,
    defaultFiatCurrency,
    custodian,
    defaultTotalSupply,
    defaultStartTime,
    defaultFundingTimeout,
    defaultActivationTimeout,
    defaultFundingGoal,
    config
  )

  const tokenAddress = txReceipt.logs[0].args.token

  return {
    tokenAddress,
    txReceipt
  }
}

const moveTokenToActive = async (poa, fmr) => {
  const neededTime = await determineNeededTimeTravel(poa)
  await timeTravel(neededTime)

  await testStartSale(poa)
  await testBuyRemainingTokens(poa, {
    // must be accounts 4 - 8 to work with poa test helpers
    from: accounts[8],
    gasPrice
  })

  // move into Active
  await testActivate(poa, fmr, defaultIpfsHash, {
    from: custodian
  })
}

const testPauseToken = async (pmr, poa, config) => {
  assert.equal(await poa.paused(), false, 'token should begin unpaused')

  await pmr.pauseToken(poa.address, config)

  assert.equal(await poa.paused(), true, 'token should then become paused')
}

const testUnpauseToken = async (pmr, poa, config) => {
  assert.equal(await poa.paused(), true, 'token should begin paused')

  await pmr.unpauseToken(poa.address, config)

  assert.equal(await poa.paused(), false, 'token should then become unpaused')
}

const testTerminateToken = async (pmr, poa, config) => {
  const preStage = await poa.stage()

  await pmr.terminateToken(poa.address, config)

  const postStage = await poa.stage()

  assert.equal(
    preStage.toString(),
    new BigNumber(4).toString(),
    'poa should start in stage 4, Active'
  )
  assert.equal(
    postStage.toString(),
    new BigNumber(5).toString(),
    'poa should be in stage 5, Terminated after terminate'
  )
}

module.exports = {
  setupPoaManager,
  addToken,
  moveTokenToActive,
  testPauseToken,
  testUnpauseToken,
  testTerminateToken
}
