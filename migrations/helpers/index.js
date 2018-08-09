const brickblockToken = require('./bbk')
const constants = require('./constants')
const general = require('./general')
const poaManager = require('./poa-manager')
const exchangeRates = require('./exchange-rates')
const whitelist = require('./whitelist')

/*
 * IMPORTANT CONVENTION
 * There's a clear convention for all migration helpers to avoid confusion.
 * The function signature of a migration helper always follows this pattern:
 *
 * function nameOfHelper(
 *   contractInstanceToWorkWith,
 *   params = { allArguments: 'passedTo', theSmartContract: 'method' })
 *   txConfig = { from: 'accountToSendTransactionFrom', gas: defaultValueCouldBeOverriddenHere, ... }
 * ) {
 *   contractInstanceToWorkWith.smartContractMethod(...params, txConfig)
 * }
 */

module.exports = {
  brickblockToken,
  constants,
  exchangeRates,
  general,
  poaManager,
  whitelist
}
