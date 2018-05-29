const BigNumber = require('bignumber.js')
const { waitForEvent, gasPrice } = require('./general')
const {
  determineNeededTimeTravel,
  timeTravel,
  testStartSale,
  whitelistedPoaBuyers,
  owner,
  testBuyTokens,
  testBuyRemainingTokens,
  testActivate,
  custodian,
  defaultIpfsHash,
  testPayout,
  testClaim,
  testTerminate,
  testChangeCustodianAddress,
  setupPoaProxyAndEcosystem,
  fundingTimeoutContract,
  testReclaim
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
  const StageEvent = poa.StageEvent()

  const neededTime = await determineNeededTimeTravel(
    poa,
    whitelistedPoaBuyers[0]
  )
  await timeTravel(neededTime)
  await testStartSale(poa)

  const { args: triggeredLoggerEvent } = await waitForEvent(LoggerStageEvent)
  const { args: triggeredEvent } = await waitForEvent(StageEvent)

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredLoggerEvent.tokenAddress,
    poa.address,
    'stage event tokenAddress should match poa.address'
  )
  assert.equal(
    triggeredLoggerEvent.stage.toString(),
    new BigNumber(1).toString(),
    'stage event stage should be 1 (Funding)'
  )
  assert.equal(
    triggeredEvent.stage.toString(),
    new BigNumber(1).toString(),
    'stage event stage should be 1 (Funding)'
  )
  checkLoggerEventsEqualsPoaEvents(triggeredLoggerEvent, triggeredEvent)
}

const testBuyTokensEvents = async (poa, reg, pmr, log) => {
  const from = whitelistedPoaBuyers[0]
  const value = new BigNumber(1e18)

  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const LoggerBuyEvent = log.BuyEvent()
  const BuyEvent = poa.BuyEvent()

  await testBuyTokens(poa, {
    from,
    value,
    gasPrice
  })

  const { args: triggeredLoggerEvent } = await waitForEvent(LoggerBuyEvent)
  const { args: triggeredEvent } = await waitForEvent(BuyEvent)

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
  assert.equal(triggeredEvent.buyer, from, 'buy event buyer should match from')
  assert.equal(
    triggeredEvent.amount.toString(),
    value.toString(),
    'buy event amount should match value'
  )
  checkLoggerEventsEqualsPoaEvents(triggeredLoggerEvent, triggeredEvent)
}

const testBuyRemainingTokensEvents = async (poa, reg, pmr, log) => {
  const from = whitelistedPoaBuyers[1]

  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const LoggerBuyEvent = log.BuyEvent()
  const BuyEvent = poa.BuyEvent()

  const value = await testBuyRemainingTokens(poa, {
    from,
    gasPrice
  })

  const { args: triggeredLoggerEvent } = await waitForEvent(LoggerBuyEvent)
  const { args: triggeredEvent } = await waitForEvent(BuyEvent)

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
  assert.equal(triggeredEvent.buyer, from, 'buy event buyer should match from')
  assert.equal(
    triggeredEvent.amount.toString(),
    value.toString(),
    'buy event amount should match value'
  )
  checkLoggerEventsEqualsPoaEvents(triggeredLoggerEvent, triggeredEvent)
}

const testActivateEvents = async (poa, reg, pmr, fmr, log) => {
  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const LoggerStageEvent = log.StageEvent()
  const StageEvent = poa.StageEvent()
  const LoggerProofOfCustodyUpdatedEvent = log.ProofOfCustodyUpdatedEvent()
  const ProofOfCustodyUpdatedEvent = poa.ProofOfCustodyUpdatedEvent()

  await testActivate(poa, fmr, defaultIpfsHash, {
    from: custodian,
    gasPrice
  })

  const { args: triggeredLoggerStageEvent } = await waitForEvent(
    LoggerStageEvent
  )
  const { args: triggeredStageEvent } = await waitForEvent(StageEvent)

  const { args: triggeredLoggerProofEvent } = await waitForEvent(
    LoggerProofOfCustodyUpdatedEvent
  )
  const { args: triggeredProofEvent } = await waitForEvent(
    ProofOfCustodyUpdatedEvent
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
    new BigNumber(4).toString(),
    'stage event should match 3 (Active)'
  )
  assert.equal(
    triggeredStageEvent.stage.toString(),
    new BigNumber(4).toString(),
    'stage event should match 3 (Active)'
  )
  assert.equal(
    triggeredLoggerProofEvent.tokenAddress,
    poa.address,
    'logger proof of custody updated event token address should match poa.address'
  )
  assert.equal(
    triggeredLoggerProofEvent.ipfsHash,
    defaultIpfsHash,
    'logger proof of custody updated even ipfs hash should match defaultIpfsHash'
  )
  assert.equal(
    triggeredProofEvent.ipfsHash,
    defaultIpfsHash,
    'proof of custody updated even ipfs hash should match defaultIpfsHash'
  )
  checkLoggerEventsEqualsPoaEvents(
    triggeredLoggerStageEvent,
    triggeredStageEvent
  )
  checkLoggerEventsEqualsPoaEvents(
    triggeredLoggerProofEvent,
    triggeredProofEvent
  )
}

const testPayoutEvents = async (poa, reg, pmr, fmr, log) => {
  const from = custodian
  const value = new BigNumber(1e18)
  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const LoggerPayoutEvent = log.PayoutEvent()
  const PayoutEvent = poa.PayoutEvent()

  await testPayout(poa, fmr, {
    from,
    value,
    gasPrice
  })

  const { args: triggeredLoggerEvent } = await waitForEvent(LoggerPayoutEvent)
  const { args: triggeredEvent } = await waitForEvent(PayoutEvent)

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
  assert(
    triggeredEvent.amount.greaterThan(0),
    'payout event amount should be more than 0'
  )
  checkLoggerEventsEqualsPoaEvents(triggeredLoggerEvent, triggeredEvent)
}

const testClaimEvents = async (poa, reg, pmr, log) => {
  const from = whitelistedPoaBuyers[0]
  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const LoggerClaimEvent = log.ClaimEvent()
  const ClaimEvent = poa.ClaimEvent()

  await testClaim(poa, {
    from,
    gasPrice
  })

  const { args: triggeredLoggerEvent } = await waitForEvent(LoggerClaimEvent)
  const { args: triggeredEvent } = await waitForEvent(ClaimEvent)

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
  assert.equal(
    triggeredEvent.claimer,
    from,
    'claim event claimer should match from address'
  )
  assert(
    triggeredEvent.payout.greaterThan(0),
    'claim event amount should be more than 0'
  )
  checkLoggerEventsEqualsPoaEvents(triggeredLoggerEvent, triggeredEvent)
}

const testTerminateEvents = async (poa, reg, pmr, log) => {
  const from = custodian
  // change to actual PoaManager contract so that logger validation works...
  await poaManagerToPoaManager(reg, pmr.address)

  const LoggerTerminatedEvent = log.TerminatedEvent()
  const TerminatedEvent = poa.TerminatedEvent()

  await testTerminate(poa, {
    from,
    gasPrice
  })

  const { args: triggeredLoggerEvent } = await waitForEvent(
    LoggerTerminatedEvent
  )
  // there are no arguments for regular Terminated event...
  // the fact that this does not timeout is proof it was logged
  await waitForEvent(TerminatedEvent)

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
  const CustodianChangedEvent = poa.CustodianChangedEvent()

  await testChangeCustodianAddress(poa, newCustodian, {
    from,
    gasPrice
  })

  const { args: triggeredLoggerEvent } = await waitForEvent(
    LoggerCustodianChangedEvent
  )
  const { args: triggeredEvent } = await waitForEvent(CustodianChangedEvent)

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
  assert.equal(
    triggeredEvent.oldAddress,
    custodian,
    'custodian changed event old custodian should match custodian'
  )
  assert.equal(
    triggeredEvent.newAddress,
    newCustodian,
    'custodian changed event new custodian should match newCustodian'
  )
  checkLoggerEventsEqualsPoaEvents(triggeredLoggerEvent, triggeredEvent)
}

const testReclaimEvents = async () => {
  const value = new BigNumber(1e18)
  const from = whitelistedPoaBuyers[0]

  // need a whole new instance in order to test this...
  const { poa, reg, log, pmr } = await setupPoaProxyAndEcosystem()
  await pmr.listToken(poa.address)
  // move into Funding
  const neededTime = await determineNeededTimeTravel(poa)
  await timeTravel(neededTime)
  await testStartSale(poa)
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
  const StageEvent = poa.StageEvent()
  const LoggerReclaimEvent = log.ReclaimEvent()
  const ReclaimEvent = poa.ReclaimEvent()

  await testReclaim(poa, { from }, true)

  const { args: triggeredLoggerStageEvent } = await waitForEvent(
    LoggerStageEvent
  )
  const { args: triggeredLoggerReclaimEvent } = await waitForEvent(
    LoggerReclaimEvent
  )
  const { args: triggeredStageEvent } = await waitForEvent(StageEvent)
  const { args: triggeredReclaimEvent } = await waitForEvent(ReclaimEvent)

  // change back so that other testing functions will work with owner...
  await poaManagerToOwner(reg)

  assert.equal(
    triggeredLoggerStageEvent.tokenAddress,
    poa.address,
    'logger stage event token address should match poa.address'
  )
  assert.equal(
    triggeredLoggerStageEvent.stage.toString(),
    new BigNumber(3).toString(),
    'logger stage event stage should match 3, Failed'
  )
  assert.equal(
    triggeredStageEvent.stage.toString(),
    new BigNumber(3).toString(),
    'stage event stage should match 3, Failed'
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
  assert.equal(
    triggeredReclaimEvent.reclaimer,
    from,
    'reclaim event reclaimer should match from address'
  )
  assert(
    triggeredReclaimEvent.amount.greaterThan(0),
    'reclaim event amount should be greater than 0'
  )
  checkLoggerEventsEqualsPoaEvents(
    triggeredLoggerReclaimEvent,
    triggeredReclaimEvent
  )
  checkLoggerEventsEqualsPoaEvents(
    triggeredLoggerStageEvent,
    triggeredStageEvent
  )
}

const checkLoggerEventsEqualsPoaEvents = (loggerArgs, poaArgs) => {
  // eslint-disable-next-line no-unused-vars
  const { tokenAddress, ...loggerArgsWithoutTokenAddress } = loggerArgs

  assert.deepEqual(
    loggerArgsWithoutTokenAddress,
    poaArgs,
    'loggerArgs without tokenAddress should match poaArgs'
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
