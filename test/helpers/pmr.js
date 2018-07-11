const PoaManager = artifacts.require('PoaManager.sol')
const PoaToken = artifacts.require('PoaToken.sol')
const PoaCrowdsale = artifacts.require('PoaCrowdsale')

const {
  setupEcosystem,
  testSetCurrencyRate,
  defaultName32,
  defaultSymbol32,
  defaultFiatCurrency,
  defaultFiatCurrency32,
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
  defaultIpfsHashArray32,
  stages,
  whitelistedPoaBuyers
} = require('./poa')

const { gasPrice } = require('./general')

const accounts = web3.eth.accounts
const owner = accounts[0]
// must be accounts 2 in order to work with poa test helpers
const custodian = accounts[2]

const setupPoaManager = async () => {
  const poatm = await PoaToken.new()
  const poacm = await PoaCrowdsale.new()
  const { reg, exr, exp, fmr } = await setupEcosystem()
  const pmr = await PoaManager.new(reg.address)

  await reg.updateContractAddress('PoaManager', pmr.address)
  await reg.updateContractAddress('PoaTokenMaster', poatm.address)
  await reg.updateContractAddress('PoaCrowdsaleMaster', poacm.address)

  await testSetCurrencyRate(exr, exp, defaultFiatCurrency, defaultFiatRate, {
    from: owner,
    value: 1e18
  })

  return {
    poatm,
    reg,
    pmr,
    fmr
  }
}

const addToken = async (pmr, config) => {
  const defaultStartTime = await getDefaultStartTime()

  const txReceipt = await pmr.addToken(
    defaultName32,
    defaultSymbol32,
    defaultFiatCurrency32,
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
    from: whitelistedPoaBuyers[whitelistedPoaBuyers.length - 1],
    gasPrice
  })

  // move into Active
  await testActivate(poa, fmr, defaultIpfsHashArray32, {
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
    stages.Active,
    'poa should start in stage Active'
  )
  assert.equal(
    postStage.toString(),
    stages.Terminated,
    'poa should be in stage Terminated after terminate'
  )
}

const testToggleWhitelistTransfers = async (pmr, addedToken, config) => {
  const preWhitelistTransfers = await addedToken.whitelistTransfers()

  await pmr.toggleTokenWhitelistTransfers(addedToken.address, config)

  const postWhitelistTransfers = await addedToken.whitelistTransfers()

  assert(
    preWhitelistTransfers != postWhitelistTransfers,
    'pre whitelistTransfers should be inverse of post'
  )
}

module.exports = {
  setupPoaManager,
  addToken,
  moveTokenToActive,
  testPauseToken,
  testUnpauseToken,
  testTerminateToken,
  testToggleWhitelistTransfers
}
