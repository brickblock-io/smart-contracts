const BigNumber = require('bignumber.js')
const { timeTravel } = require('helpers')
const { waitForEvent, gasPrice } = require('./general')
const {
  owner,
  broker,
  custodian,
  determineNeededTimeTravel,
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
  forcePoaTimeout,
  testReclaim,
  stages,
  testUpdateProofOfCustody,
  testPayActivationFee
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
  const PoaLoggerStageEvent = log.Stage()

  const neededTime = await determineNeededTimeTravel(
    poa,
    whitelistedPoaBuyers[0]
  )
  await timeTravel(neededTime)
  await testStartEthSale(poa)

  const { args: triggeredPoaLogger } = await waitForEvent(PoaLoggerStageEvent)

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredPoaLogger.tokenAddress,
    poa.address,
    'stage event tokenAddress should match poa.address'
  )
  assert.equal(
    triggeredPoaLogger.stage.toString(),
    stages.EthFunding,
    'stage event stage should be in Funding Stage'
  )
}

const testBuyTokensEvents = async (poa, reg, pmr, log) => {
  const from = whitelistedPoaBuyers[0]
  const value = new BigNumber(1e18)

  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const PoaLoggerBuyEvent = log.Buy()

  await testBuyTokens(poa, {
    from,
    value,
    gasPrice
  })

  const { args: triggeredPoaLogger } = await waitForEvent(PoaLoggerBuyEvent)

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredPoaLogger.tokenAddress,
    poa.address,
    'logger buy event tokenAddress should match poa.address'
  )
  assert.equal(
    triggeredPoaLogger.buyer,
    from,
    'logger buy event buyer should match from'
  )
  assert.equal(
    triggeredPoaLogger.amount.toString(),
    value.toString(),
    'logger buy event amount should match value'
  )
}

const testBuyRemainingTokensEvents = async (poa, reg, pmr, log) => {
  const from = whitelistedPoaBuyers[1]

  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const PoaLoggerBuyEvent = log.Buy()

  const value = await testBuyRemainingTokens(poa, {
    from,
    gasPrice
  })

  const { args: triggeredPoaLogger } = await waitForEvent(PoaLoggerBuyEvent)

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredPoaLogger.tokenAddress,
    poa.address,
    'logger buy event tokenAddress should match poa.address'
  )
  assert.equal(
    triggeredPoaLogger.buyer,
    from,
    'logger buy event buyer should match from'
  )
  assert.equal(
    triggeredPoaLogger.amount.toString(),
    value.toString(),
    'logger buy event amount should match value'
  )
}

const testActivateEvents = async (poa, reg, pmr, fmr, log) => {
  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)
  const PoaLoggerStageEvent = log.Stage()
  const PoaLoggerProofOfCustodyUpdatedEvent = log.ProofOfCustodyUpdated()

  await testUpdateProofOfCustody(poa, defaultIpfsHashArray32, {
    from: custodian
  })

  const { args: triggeredPoaLoggerProof } = await waitForEvent(
    PoaLoggerProofOfCustodyUpdatedEvent
  )

  await testPayActivationFee(poa, fmr)

  await testActivate(poa, fmr, {
    from: custodian,
    gasPrice
  })

  const { args: triggeredPoaLoggerStage } = await waitForEvent(
    PoaLoggerStageEvent
  )

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredPoaLoggerStage.tokenAddress,
    poa.address,
    'logger stage event should match poa.address'
  )
  assert.equal(
    triggeredPoaLoggerStage.stage.toString(),
    stages.Active,
    'stage event should match Active stage'
  )
  assert.equal(
    triggeredPoaLoggerProof.tokenAddress,
    poa.address,
    'logger proof of custody updated event token address should match poa.address'
  )
  assert.equal(
    triggeredPoaLoggerProof.ipfsHash,
    defaultIpfsHash,
    'logger proof of custody updated event ipfsHash should match defaultIpfsHash'
  )
}

const testPayoutEvents = async (poa, reg, pmr, fmr, log) => {
  const from = broker
  const value = new BigNumber(1e18)
  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const PoaLoggerPayoutEvent = log.Payout()

  await testPayout(poa, fmr, {
    from,
    value,
    gasPrice
  })

  const { args: triggeredPoaLogger } = await waitForEvent(PoaLoggerPayoutEvent)

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredPoaLogger.tokenAddress,
    poa.address,
    'logger payout event token address should match poa.address'
  )
  assert(
    triggeredPoaLogger.amount.greaterThan(0),
    'logger payout event amount should be more than 0'
  )
}

const testClaimEvents = async (poa, reg, pmr, log) => {
  const from = whitelistedPoaBuyers[0]
  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const PoaLoggerClaimEvent = log.Claim()

  await testClaim(poa, {
    from,
    gasPrice
  })

  const { args: triggeredPoaLogger } = await waitForEvent(PoaLoggerClaimEvent)

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredPoaLogger.tokenAddress,
    poa.address,
    'logger claim event token address should match poa.address'
  )
  assert.equal(
    triggeredPoaLogger.claimer,
    from,
    'logger claim event claimer should match from address'
  )
  assert(
    triggeredPoaLogger.payout.greaterThan(0),
    'logger claim event amount should be more than 0'
  )
}

const testTerminateEvents = async (poa, reg, pmr, log) => {
  const from = custodian
  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const PoaLoggerTerminatedEvent = log.Terminated()

  await testTerminate(poa, {
    from,
    gasPrice
  })

  const { args: triggeredPoaLogger } = await waitForEvent(
    PoaLoggerTerminatedEvent
  )

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredPoaLogger.tokenAddress,
    poa.address,
    'logger claim event token address should match poa.address'
  )
}

const testChangeCustodianEvents = async (poa, reg, pmr, log) => {
  const from = custodian
  const newCustodian = web3.eth.accounts[9]
  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const PoaLoggerCustodianChangedEvent = log.CustodianChanged()

  await testChangeCustodianAddress(poa, newCustodian, {
    from,
    gasPrice
  })

  const { args: triggeredPoaLoggerEvent } = await waitForEvent(
    PoaLoggerCustodianChangedEvent
  )

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredPoaLoggerEvent.tokenAddress,
    poa.address,
    'logger custodian changed event token address should match poa.address'
  )
  assert.equal(
    triggeredPoaLoggerEvent.oldAddress,
    custodian,
    'logger custodian changed event old custodian should match custodian'
  )
  assert.equal(
    triggeredPoaLoggerEvent.newAddress,
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
  await forcePoaTimeout(poa)

  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const PoaLoggerStageEvent = log.Stage()
  const PoaLoggerReclaimEvent = log.ReClaim()

  await testReclaim(poa, { from }, true)

  const { args: triggeredPoaLoggerStage } = await waitForEvent(
    PoaLoggerStageEvent
  )
  const { args: triggeredPoaLoggerReClaim } = await waitForEvent(
    PoaLoggerReclaimEvent
  )
  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredPoaLoggerStage.tokenAddress,
    poa.address,
    'logger stage event token address should match poa.address'
  )
  assert.equal(
    triggeredPoaLoggerStage.stage.toString(),
    stages.TimedOut,
    'logger stage event stage should match TimedOut'
  )
  assert.equal(
    triggeredPoaLoggerReClaim.tokenAddress,
    poa.address,
    'logger reclaim event token address should match poa.address'
  )
  assert.equal(
    triggeredPoaLoggerReClaim.reclaimer,
    from,
    'logger reclaim event reclaimer should match from address'
  )
  assert(
    triggeredPoaLoggerReClaim.amount.greaterThan(0),
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
