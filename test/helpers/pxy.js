const assert = require('assert')
const BigNumber = require('bignumber.js')
const { gasPrice } = require('../helpers/general')
const {
  defaultName,
  defaultSymbol,
  defaultFiatCurrency,
  broker,
  custodian,
  defaultTotalSupply,
  getDefaultStartTime,
  defaultFundingTimeout,
  defaultActivationTimeout,
  defaultFundingGoal,
  owner,
  timeTravel,
  testStartSale,
  determineNeededTimeTravel,
  testBuyRemainingTokens,
  testActivate,
  testBrokerClaim,
  whitelistedPoaBuyers,
  defaultIpfsHash
} = require('./poa')
const {
  getAllSimpleStorage,
  shortHexStorageToAscii,
  findNestedMappingStorage,
  findMappingStorage
} = require('./storage')

const checkPreSetupStorage = async poa => {
  const storage = await getAllSimpleStorage(poa.address)

  for (const item of storage) {
    assert.equal(
      item.data,
      '0x00',
      'all storage at least in range of 0-10 should be 0x00'
    )
  }
}

const setupContract = async (poa, reg) => {
  await poa.setupContract(
    defaultName,
    defaultSymbol,
    defaultFiatCurrency,
    broker,
    custodian,
    reg.address,
    defaultTotalSupply,
    await getDefaultStartTime(),
    defaultFundingTimeout,
    defaultActivationTimeout,
    defaultFundingGoal
  )
}

const checkPostSetupStorage = async (poa, reg) => {
  const storage = await getAllSimpleStorage(poa.address)
  const balances = storage[0].data
  const totalSupply = new BigNumber(storage[1].data)
  const allowance = storage[2].data
  // bool is packed in with address because bool + address < 32 bytes
  const paused = parseInt(storage[3].data.slice(0, 4), 16)
  const actualOwner = '0x' + storage[3].data.slice(4)
  const registry = storage[4].data
  const name = shortHexStorageToAscii(storage[5].data)
  const symbol = shortHexStorageToAscii(storage[6].data)
  const proofOfCustody = storage[7].data
  const fiatCurrency = shortHexStorageToAscii(storage[8].data)
  const actualBroker = storage[9].data
  const actualCustodian = storage[10].data
  const startTime = new BigNumber(storage[11].data)
  const fundingTimeout = new BigNumber(storage[12].data)
  const activationTimeout = new BigNumber(storage[13].data)
  const fundingGoalInCents = new BigNumber(storage[14].data)
  // storage beyond above are mappings and have no data yet... the are all blank

  assert.equal(
    balances,
    '0x00',
    'slot 0 balances should be an empty slot used for mapping locations'
  )
  assert.equal(
    totalSupply.toString(),
    defaultTotalSupply.toString(),
    'slot 1 should contain correct totalSupply'
  )
  assert.equal(
    allowance,
    '0x00',
    'slot 2 allowance should be an empty slot used for mapping location'
  )
  assert(paused, 'slot3 should contain bool indicating paused')
  assert.equal(actualOwner, owner, 'slot 3 should contain correct owner value')
  assert.equal(
    registry,
    reg.address,
    'slot 4 should contain correct registry address'
  )
  assert.equal(
    name,
    defaultName,
    'slot 5 should contain name along with name legnth'
  )
  assert.equal(
    symbol,
    defaultSymbol,
    'slot 6 should contain symbol along with symbol length'
  )
  assert.equal(
    proofOfCustody,
    '0x00',
    'slot 7 should contain empty entry for proofOfCustody'
  )
  assert.equal(
    fiatCurrency,
    defaultFiatCurrency,
    'slot 8 should contain correct fiatRate'
  )
  assert.equal(actualBroker, broker, 'slot 9 should contain correct broker')
  assert.equal(
    actualCustodian,
    custodian,
    'slot 10 should contain correct custodian'
  )
  assert(startTime.gt(0), 'slot 11 startTime should be more than 0')
  assert.equal(
    fundingTimeout.toString(),
    defaultFundingTimeout.toString(),
    'slot 12 should contain correct fundningTimeout'
  )
  assert.equal(
    activationTimeout.toString(),
    defaultActivationTimeout.toString(),
    'slot 13 should contain correct activationTimeout'
  )
  assert.equal(
    fundingGoalInCents.toString(),
    defaultFundingGoal.toString(),
    'slot 14 should contain correct fundingGoalInCents'
  )
}

const enterActiveStage = async (poa, fmr) => {
  // move into Funding
  const neededTime = await determineNeededTimeTravel(poa)
  await timeTravel(neededTime)
  await testStartSale(poa)

  // move into Pending
  await testBuyRemainingTokens(poa, {
    from: whitelistedPoaBuyers[0],
    gasPrice
  })

  // move into Active
  await testActivate(poa, fmr, defaultIpfsHash, {
    from: custodian
  })

  // clean out broker balance for easier debugging
  await testBrokerClaim(poa)
}

/*
assumes that:
enterActiveStage() has been run to give buy all tokens as whitelistedPoaBuyers[0]
testApprove() has been run to give whitelistedPoaBuyers[1] approval to spend whitelistedPoaBuyers[0]'s tokens
*/
const checkPostActiveStorage = async (poa, reg) => {
  const storage = await getAllSimpleStorage(poa.address)
  const balances = storage[0].data
  const totalSupply = new BigNumber(storage[1].data)
  const allowance = storage[2].data
  // bool paused is no longer packed or visible due to being 0
  const actualOwner = storage[3].data
  const registry = storage[4].data
  const name = shortHexStorageToAscii(storage[5].data)
  const symbol = shortHexStorageToAscii(storage[6].data)
  // this is an array length value because it is too big to fit into 32 bytes
  // get this by: web3.sha3(arrSlotLoc, { encoding: 'hex' })
  // arrSlotLoc is 0 padded to 64
  const proofOfCustodyLength = storage[7].data
  const fiatCurrency = shortHexStorageToAscii(storage[8].data)
  const actualBroker = storage[9].data
  const actualCustodian = storage[10].data
  const startTime = new BigNumber(storage[11].data)
  const fundingTimeout = new BigNumber(storage[12].data)
  const activationTimeout = new BigNumber(storage[13].data)
  const fundingGoalInCents = new BigNumber(storage[14].data)

  const {
    mappingValueStorage: investmentPerUserInWeiHex
  } = await findMappingStorage(poa.address, whitelistedPoaBuyers[0], 0, 20)

  const investmentPerUserInWei = new BigNumber(investmentPerUserInWeiHex)

  const {
    nestedMappingValueStorage: allowanceValueHex
  } = await findNestedMappingStorage(
    poa.address,
    whitelistedPoaBuyers[0],
    whitelistedPoaBuyers[1],
    new BigNumber(0),
    new BigNumber(20)
  )
  const allowanceValue = new BigNumber(allowanceValueHex)

  assert.equal(
    balances,
    '0x00',
    'slot 0 balances should be an empty slot used for mapping locations'
  )
  assert.equal(
    totalSupply.toString(),
    defaultTotalSupply.toString(),
    'slot 1 should contain correct totalSupply'
  )
  assert.equal(
    allowance,
    '0x00',
    'slot 2 allowance should be an empty slot used for mapping location'
  )
  assert.equal(actualOwner, owner, 'slot 3 should contain correct owner value')
  assert.equal(
    registry,
    reg.address,
    'slot 4 should contain correct registry address'
  )
  assert.equal(
    name,
    defaultName,
    'slot 5 should contain name along with name legnth'
  )
  assert.equal(
    symbol,
    defaultSymbol,
    'slot 6 should contain symbol along with symbol length'
  )
  assert.equal(
    proofOfCustodyLength,
    '0x5d',
    'slot 7 should contain empty entry for proofOfCustody'
  )
  assert.equal(
    fiatCurrency,
    defaultFiatCurrency,
    'slot 8 should contain correct fiatRate'
  )
  assert.equal(actualBroker, broker, 'slot 9 should contain correct broker')
  assert.equal(
    actualCustodian,
    custodian,
    'slot 10 should contain correct custodian'
  )
  assert(startTime.gt(0), 'slot 11 startTime should be more than 0')
  assert.equal(
    fundingTimeout.toString(),
    defaultFundingTimeout.toString(),
    'slot 12 should contain correct fundningTimeout'
  )
  assert.equal(
    activationTimeout.toString(),
    defaultActivationTimeout.toString(),
    'slot 13 should contain correct activationTimeout'
  )
  assert.equal(
    fundingGoalInCents.toString(),
    defaultFundingGoal.toString(),
    'slot 14 should contain correct fundingGoalInCents'
  )
  assert.equal(
    allowanceValue.toString(),
    new BigNumber(3e18).toString(),
    'allowance in mapping from slot 2 should match expected value'
  )
  assert.equal(
    investmentPerUserInWei.toString(),
    // calculated based on default values for poa tests
    new BigNumber('15000150001500015000').toString(),
    'investmentPerUserInWei should match expected value'
  )
}

const checkPostIsUpgradedStorage = async (poa, reg) => {
  const storage = await getAllSimpleStorage(poa.address)
  const balances = storage[0].data
  const totalSupply = new BigNumber(storage[1].data)
  const allowance = storage[2].data
  // bool paused is no longer packed or visible due to being 0
  const actualOwner = storage[3].data
  const registry = storage[4].data
  const name = shortHexStorageToAscii(storage[5].data)
  const symbol = shortHexStorageToAscii(storage[6].data)
  // this is an array length value because it is too big to fit into 32 bytes
  // get this by: web3.sha3(arrSlotLoc, { encoding: 'hex' })
  // arrSlotLoc is 0 padded to 64
  const proofOfCustodyLength = storage[7].data
  const fiatCurrency = shortHexStorageToAscii(storage[8].data)
  const actualBroker = storage[9].data
  const actualCustodian = storage[10].data
  const startTime = new BigNumber(storage[11].data)
  const fundingTimeout = new BigNumber(storage[12].data)
  const activationTimeout = new BigNumber(storage[13].data)
  const fundingGoalInCents = new BigNumber(storage[14].data)
  const isUpgraded = new BigNumber(storage[24].data.slice(0, 4))
  const stage = new BigNumber(storage[24].data.slice(4))

  const {
    mappingValueStorage: investmentPerUserInWeiHex
  } = await findMappingStorage(poa.address, whitelistedPoaBuyers[0], 0, 20)

  const investmentPerUserInWei = new BigNumber(investmentPerUserInWeiHex)

  const {
    nestedMappingValueStorage: allowanceValueHex
  } = await findNestedMappingStorage(
    poa.address,
    whitelistedPoaBuyers[0],
    whitelistedPoaBuyers[1],
    new BigNumber(0),
    new BigNumber(20)
  )
  const allowanceValue = new BigNumber(allowanceValueHex)

  assert.equal(
    balances,
    '0x00',
    'slot 0 balances should be an empty slot used for mapping locations'
  )
  assert.equal(
    totalSupply.toString(),
    defaultTotalSupply.toString(),
    'slot 1 should contain correct totalSupply'
  )
  assert.equal(
    allowance,
    '0x00',
    'slot 2 allowance should be an empty slot used for mapping location'
  )
  assert.equal(actualOwner, owner, 'slot 3 should contain correct owner value')
  assert.equal(
    registry,
    reg.address,
    'slot 4 should contain correct registry address'
  )
  assert.equal(
    name,
    defaultName,
    'slot 5 should contain name along with name legnth'
  )
  assert.equal(
    symbol,
    defaultSymbol,
    'slot 6 should contain symbol along with symbol length'
  )
  assert.equal(
    proofOfCustodyLength,
    '0x5d',
    'slot 7 should contain empty entry for proofOfCustody'
  )
  assert.equal(
    fiatCurrency,
    defaultFiatCurrency,
    'slot 8 should contain correct fiatRate'
  )
  assert.equal(actualBroker, broker, 'slot 9 should contain correct broker')
  assert.equal(
    actualCustodian,
    custodian,
    'slot 10 should contain correct custodian'
  )
  assert(startTime.gt(0), 'slot 11 startTime should be more than 0')
  assert.equal(
    fundingTimeout.toString(),
    defaultFundingTimeout.toString(),
    'slot 12 should contain correct fundningTimeout'
  )
  assert.equal(
    activationTimeout.toString(),
    defaultActivationTimeout.toString(),
    'slot 13 should contain correct activationTimeout'
  )
  assert.equal(
    fundingGoalInCents.toString(),
    defaultFundingGoal.toString(),
    'slot 14 should contain correct fundingGoalInCents'
  )
  assert.equal(
    allowanceValue.toString(),
    new BigNumber(3e18).toString(),
    'allowance in mapping from slot 2 should match expected value'
  )
  assert.equal(
    investmentPerUserInWei.toString(),
    // calculated based on default values for poa tests
    new BigNumber('15000150001500015000').toString(),
    'investmentPerUserInWei should match expected value'
  )
  assert(isUpgraded, 'slot 24 shoudl contain isUpgraded as true')
  assert.equal(
    stage.toString(),
    new BigNumber(4).toString(),
    'slot 24 should contain correct stage'
  )
}

/*


[ { slot: 0, data: '0x00' }, // balances
  { slot: 1, data: '0x152d02c7e14af6800000' }, // totalSupply
  { slot: 2, data: '0x00' }, // allowances
  { slot: 3, data: '0x627306090abab3a6e1400e9345bc60c78a8bef57' }, // owner
  { slot: 4, data: '0x2eca6fcfef74e2c8d03fbaf0ff6712314c9bd58b' }, // registry
  { slot: 5,
    data: '0x54657374506f610000000000000000000000000000000000000000000000000e' }, // name
  { slot: 6,
    data: '0x5450410000000000000000000000000000000000000000000000000000000006' }, // symbol
  { slot: 7, data: '0x5d' }, // length of proofOfAsset
  { slot: 8,
    data: '0x4555520000000000000000000000000000000000000000000000000000000006' }, // fiat currency
  { slot: 9, data: '0xf17f52151ebef6c7334fad080c5704d77216b732' }, // broker
  { slot: 10, data: '0xc5fdf4076b8f3a5357c5e395ab970b5b54098fef' }, // custodian
  { slot: 11, data: '0x5b06e93f' }, // start time
  { slot: 12, data: '0x015180' }, // funding timeout
  { slot: 13, data: '0x093a80' }, // activation timeout
  { slot: 14, data: '0x07a120' }, // funding goal in cents
  { slot: 15, data: '0x00' },
  { slot: 16, data: '0xd02b3cf3c0fbc998' }, // per token payout rate
  { slot: 17, data: '0x00' },
  { slot: 18, data: '0x00' },
  { slot: 19, data: '0x00' },
  { slot: 20, data: '0x00' },
  { slot: 21, data: '0x00' },
  { slot: 22, data: '0x00' },
  { slot: 23, data: '0x00' },
  { slot: 24, data: '0x0104' }, // isUpgraded & stage
  { slot: 25, data: '0x00' },
  { slot: 26, data: '0x00' },
  { slot: 27, data: '0x00' },
  { slot: 28, data: '0x00' },
  { slot: 29, data: '0x00' },
  { slot: 30, data: '0x00' },
  { slot: 31, data: '0x00' },
  { slot: 32, data: '0x00' },
  { slot: 33, data: '0x00' },
  { slot: 34, data: '0x00' },
  { slot: 35, data: '0x00' } ]
*/

module.exports = {
  checkPreSetupStorage,
  setupContract,
  checkPostSetupStorage,
  enterActiveStage,
  checkPostActiveStorage,
  checkPostIsUpgradedStorage
}
