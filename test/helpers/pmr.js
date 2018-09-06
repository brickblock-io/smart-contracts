const PoaManager = artifacts.require('PoaManager.sol')
const PoaToken = artifacts.require('PoaToken.sol')
const PoaCrowdsale = artifacts.require('PoaCrowdsale')

const { timeTravel } = require('helpers')
const {
  defaultActivationTimeout,
  defaultFiatCurrency,
  defaultFiatCurrency32,
  defaultFiatRate,
  defaultFundingGoal,
  defaultFundingTimeout,
  defaultIpfsHashArray32,
  defaultName32,
  defaultSymbol32,
  defaultTotalSupply,
  determineNeededTimeTravel,
  getDefaultStartTime,
  setupEcosystem,
  stages,
  testActivate,
  testBuyRemainingTokens,
  testPayActivationFee,
  testSetCurrencyRate,
  testStartEthSale,
  testUpdateProofOfCustody,
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

  await testStartEthSale(poa)
  await testBuyRemainingTokens(poa, {
    from: whitelistedPoaBuyers[whitelistedPoaBuyers.length - 1],
    gasPrice
  })

  await testUpdateProofOfCustody(poa, defaultIpfsHashArray32, {
    from: custodian
  })

  await testPayActivationFee(poa, fmr)

  await testActivate(poa, fmr, {
    from: custodian
  })
}

const testPauseToken = async (pmr, poa, config) => {
  await pmr.pauseToken(poa.address, config)
}

const testUnpauseToken = async (pmr, poa, config) => {
  await pmr.unpauseToken(poa.address, config)
}

const testTerminateToken = async (pmr, poa, config) => {
  const preStage = await poa.stage()
  assert.equal(
    preStage.toString(),
    stages.Active,
    'poa should start in stage Active'
  )

  await pmr.terminateToken(poa.address, config)

  const postStage = await poa.stage()
  assert.equal(
    postStage.toString(),
    stages.Terminated,
    'poa should be in stage Terminated after terminate'
  )
}

const testToggleWhitelistTokenTransfers = async (pmr, addedToken, config) => {
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
  testToggleWhitelistTokenTransfers
}
