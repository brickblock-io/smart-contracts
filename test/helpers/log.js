const BigNumber = require('bignumber.js')
const { waitForEvent, gasPrice } = require('./general')
const {
  owner,
  broker,
  custodian,
  determineNeededTimeTravel,
  timeTravel,
  testStartEthSale,
  whitelistedPoaBuyers,
  testBuyTokens,
  testBuyRemainingTokens,
  testActivate,
  defaultIpfsHashArray32,
  defaultIpfsHash,
  testPayout,
  testClaim,
  testTerminate,
  testChangeCustodianAddress,
  setupPoaProxyAndEcosystem,
  fundingTimeoutContract,
  testReclaim,
  stages
} = require('./poa')

// change PoaManager reg entry to owner for easier testing...
const poaManagerToOwner = reg => reg.updateContractAddress('PoaManager', owner)

// change PoaManager reg entry back to correct contract
const poaManagerToPoaManager = (reg, addr) =>
  reg.updateContractAddress('PoaManager', addr)

// only meant to be used for transition from stage 0 to stage 1
const testPreFundingToFundingEvent = async (poa, reg, pmr, log) => {
  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)
  const LoggerStageEvent = log.StageEvent()

  const neededTime = await determineNeededTimeTravel(
    poa,
    whitelistedPoaBuyers[0]
  )
  await timeTravel(neededTime)
  await testStartEthSale(poa)

  const { args: triggeredLoggerEvent } = await waitForEvent(LoggerStageEvent)

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredLoggerEvent.tokenAddress,
    poa.address,
    'stage event tokenAddress should match poa.address'
  )
  assert.equal(
    triggeredLoggerEvent.stage.toString(),
    stages.EthFunding,
    'stage event stage should be in Funding Stage'
  )
}

const testBuyTokensEvents = async (poa, reg, pmr, log) => {
  const from = whitelistedPoaBuyers[0]
  const value = new BigNumber(1e18)

  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const LoggerBuyEvent = log.BuyEvent()

  await testBuyTokens(poa, {
    from,
    value,
    gasPrice
  })

  const { args: triggeredLoggerEvent } = await waitForEvent(LoggerBuyEvent)

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredLoggerEvent.tokenAddress,
    poa.address,
    'logger buy event tokenAddress should match poa.address'
  )
  assert.equal(
    triggeredLoggerEvent.buyer,
    from,
    'logger buy event buyer should match from'
  )
  assert.equal(
    triggeredLoggerEvent.amount.toString(),
    value.toString(),
    'logger buy event amount should match value'
  )
}

const testBuyRemainingTokensEvents = async (poa, reg, pmr, log) => {
  const from = whitelistedPoaBuyers[1]

  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const LoggerBuyEvent = log.BuyEvent()

  const value = await testBuyRemainingTokens(poa, {
    from,
    gasPrice
  })

  const { args: triggeredLoggerEvent } = await waitForEvent(LoggerBuyEvent)

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredLoggerEvent.tokenAddress,
    poa.address,
    'logger buy event tokenAddress should match poa.address'
  )
  assert.equal(
    triggeredLoggerEvent.buyer,
    from,
    'logger buy event buyer should match from'
  )
  assert.equal(
    triggeredLoggerEvent.amount.toString(),
    value.toString(),
    'logger buy event amount should match value'
  )
}

const testActivateEvents = async (poa, reg, pmr, fmr, log) => {
  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)
  const LoggerStageEvent = log.StageEvent()
  const LoggerProofOfCustodyUpdatedEvent = log.ProofOfCustodyUpdatedEvent()

  await testActivate(poa, fmr, defaultIpfsHashArray32, {
    from: custodian,
    gasPrice
  })

  const { args: triggeredLoggerStageEvent } = await waitForEvent(
    LoggerStageEvent
  )

  const { args: triggeredLoggerProofEvent } = await waitForEvent(
    LoggerProofOfCustodyUpdatedEvent
  )

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredLoggerStageEvent.tokenAddress,
    poa.address,
    'logger stage event should match poa.address'
  )
  assert.equal(
    triggeredLoggerStageEvent.stage.toString(),
    stages.Active,
    'stage event should match Active stage'
  )
  assert.equal(
    triggeredLoggerProofEvent.tokenAddress,
    poa.address,
    'logger proof of custody updated event token address should match poa.address'
  )
  assert.equal(
    triggeredLoggerProofEvent.ipfsHash,
    defaultIpfsHash,
    'logger proof of custody updated event ipfsHash should match defaultIpfsHash'
  )
}

const testPayoutEvents = async (poa, reg, pmr, fmr, log) => {
  const from = broker
  const value = new BigNumber(1e18)
  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const LoggerPayoutEvent = log.PayoutEvent()

  await testPayout(poa, fmr, {
    from,
    value,
    gasPrice
  })

  const { args: triggeredLoggerEvent } = await waitForEvent(LoggerPayoutEvent)

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredLoggerEvent.tokenAddress,
    poa.address,
    'logger payout event token address should match poa.address'
  )
  assert(
    triggeredLoggerEvent.amount.greaterThan(0),
    'logger payout event amount should be more than 0'
  )
}

const testClaimEvents = async (poa, reg, pmr, log) => {
  const from = whitelistedPoaBuyers[0]
  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const LoggerClaimEvent = log.ClaimEvent()

  await testClaim(poa, {
    from,
    gasPrice
  })

  const { args: triggeredLoggerEvent } = await waitForEvent(LoggerClaimEvent)

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredLoggerEvent.tokenAddress,
    poa.address,
    'logger claim event token address should match poa.address'
  )
  assert.equal(
    triggeredLoggerEvent.claimer,
    from,
    'logger claim event claimer should match from address'
  )
  assert(
    triggeredLoggerEvent.payout.greaterThan(0),
    'logger claim event amount should be more than 0'
  )
}

const testTerminateEvents = async (poa, reg, pmr, log) => {
  const from = custodian
  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const LoggerTerminatedEvent = log.TerminatedEvent()

  await testTerminate(poa, {
    from,
    gasPrice
  })

  const { args: triggeredLoggerEvent } = await waitForEvent(
    LoggerTerminatedEvent
  )

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredLoggerEvent.tokenAddress,
    poa.address,
    'logger claim event token address should match poa.address'
  )
}

const testChangeCustodianEvents = async (poa, reg, pmr, log) => {
  const from = custodian
  const newCustodian = web3.eth.accounts[9]
  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const LoggerCustodianChangedEvent = log.CustodianChangedEvent()

  await testChangeCustodianAddress(poa, newCustodian, {
    from,
    gasPrice
  })

  const { args: triggeredLoggerEvent } = await waitForEvent(
    LoggerCustodianChangedEvent
  )

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredLoggerEvent.tokenAddress,
    poa.address,
    'logger custodian changed event token address should match poa.address'
  )
  assert.equal(
    triggeredLoggerEvent.oldAddress,
    custodian,
    'logger custodian changed event old custodian should match custodian'
  )
  assert.equal(
    triggeredLoggerEvent.newAddress,
    newCustodian,
    'logger custodian changed event new custodian should match newCustodian'
  )
}

const testReclaimEvents = async () => {
  const value = new BigNumber(1e18)
  const from = whitelistedPoaBuyers[0]

  // need a whole new instance in order to test this...
  const { poa, reg, log, pmr } = await setupPoaProxyAndEcosystem()
  await pmr.listToken(poa.address)
  // move into "EthFunding" stage
  const neededTime = await determineNeededTimeTravel(poa)
  await timeTravel(neededTime)
  await testStartEthSale(poa)
  // purchase tokens to reclaim when failed
  await testBuyTokens(poa, {
    from,
    value,
    gasPrice
  })
  await fundingTimeoutContract(poa)

  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const LoggerStageEvent = log.StageEvent()
  const LoggerReclaimEvent = log.ReclaimEvent()

  await testReclaim(poa, { from }, true)

  const { args: triggeredLoggerStageEvent } = await waitForEvent(
    LoggerStageEvent
  )
  const { args: triggeredLoggerReclaimEvent } = await waitForEvent(
    LoggerReclaimEvent
  )
  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredLoggerStageEvent.tokenAddress,
    poa.address,
    'logger stage event token address should match poa.address'
  )
  assert.equal(
    triggeredLoggerStageEvent.stage.toString(),
    stages.Failed,
    'logger stage event stage should match Failed'
  )
  assert.equal(
    triggeredLoggerReclaimEvent.tokenAddress,
    poa.address,
    'logger reclaim event token address should match poa.address'
  )
  assert.equal(
    triggeredLoggerReclaimEvent.reclaimer,
    from,
    'logger reclaim event reclaimer should match from address'
  )
  assert(
    triggeredLoggerReclaimEvent.amount.greaterThan(0),
    'logger reclaim event amount should be greater than 0'
  )
}

module.exports = {
  poaManagerToOwner,
  poaManagerToPoaManager,
  testPreFundingToFundingEvent,
  testBuyTokensEvents,
  testBuyRemainingTokensEvents,
  testActivateEvents,
  testPayoutEvents,
  testClaimEvents,
  testTerminateEvents,
  testChangeCustodianEvents,
  testReclaimEvents
}
