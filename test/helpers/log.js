const BigNumber = require('bignumber.js')
const { timeTravel } = require('helpers')
const { waitForEvent, gasPrice } = require('./general')
const {
  broker,
  custodian,
  defaultIpfsHash,
  defaultIpfsHashArray32,
  determineNeededTimeTravel,
  forcePoaTimeout,
  setupPoaProxyAndEcosystem,
  stages,
  testActivate,
  testBuyRemainingTokens,
  testBuyTokens,
  testChangeCustodianAddress,
  testClaim,
  testPayActivationFee,
  testPayout,
  testReclaim,
  testStartEthSale,
  testTerminate,
  testUpdateProofOfCustody,
  whitelistedPoaBuyers
} = require('./poa')

// only meant to be used for transition from stage 0 to stage 1
const testPreFundingToFundingEvent = async (poa, reg, pmr, log) => {
  const PoaLoggerStageEvent = log.Stage()

  const neededTime = await determineNeededTimeTravel(
    poa,
    whitelistedPoaBuyers[0]
  )
  await timeTravel(neededTime)
  await testStartEthSale(poa)

  const { args: triggeredPoaLogger } = await waitForEvent(PoaLoggerStageEvent)

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

  const PoaLoggerBuyEvent = log.Buy()

  await testBuyTokens(poa, {
    from,
    value,
    gasPrice
  })

  const { args: triggeredPoaLogger } = await waitForEvent(PoaLoggerBuyEvent)

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

  const PoaLoggerBuyEvent = log.Buy()

  const value = await testBuyRemainingTokens(poa, {
    from,
    gasPrice
  })

  const { args: triggeredPoaLogger } = await waitForEvent(PoaLoggerBuyEvent)

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

  const PoaLoggerPayoutEvent = log.Payout()

  await testPayout(poa, fmr, {
    from,
    value,
    gasPrice
  })

  const { args: triggeredPoaLogger } = await waitForEvent(PoaLoggerPayoutEvent)

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

  const PoaLoggerClaimEvent = log.Claim()

  await testClaim(poa, {
    from,
    gasPrice
  })

  const { args: triggeredPoaLogger } = await waitForEvent(PoaLoggerClaimEvent)

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

  const PoaLoggerTerminatedEvent = log.Terminated()

  await testTerminate(
    poa,
    pmr,
    {
      from,
      gasPrice
    },
    { callPoaDirectly: true }
  )

  const { args: triggeredPoaLogger } = await waitForEvent(
    PoaLoggerTerminatedEvent
  )

  assert.equal(
    triggeredPoaLogger.tokenAddress,
    poa.address,
    'logger claim event token address should match poa.address'
  )
}

const testChangeCustodianEvents = async (poa, reg, pmr, log) => {
  const from = custodian
  const newCustodian = web3.eth.accounts[9]

  const PoaLoggerCustodianChangedEvent = log.CustodianChanged()

  await testChangeCustodianAddress(poa, newCustodian, {
    from,
    gasPrice
  })

  const { args: triggeredPoaLoggerEvent } = await waitForEvent(
    PoaLoggerCustodianChangedEvent
  )

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
  const { poa, log, pmr } = await setupPoaProxyAndEcosystem()
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

  const PoaLoggerStageEvent = log.Stage()
  const PoaLoggerReclaimEvent = log.ReClaim()

  await testReclaim(poa, { from }, true)

  const { args: triggeredPoaLoggerStage } = await waitForEvent(
    PoaLoggerStageEvent
  )
  const { args: triggeredPoaLoggerReClaim } = await waitForEvent(
    PoaLoggerReclaimEvent
  )

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
  testActivateEvents,
  testBuyRemainingTokensEvents,
  testBuyTokensEvents,
  testChangeCustodianEvents,
  testClaimEvents,
  testPayoutEvents,
  testPreFundingToFundingEvent,
  testReclaimEvents,
  testTerminateEvents
}
