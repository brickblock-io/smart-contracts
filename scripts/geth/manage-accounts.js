/* global personal */
/* eslint no-var:0 */
/* eslint no-console:0 */

var UNLOCK_DURATION_AS_SECONDS = 60 * 60

for (var index = 0; index < personal.listAccounts.length; index++) {
  var account = personal.listAccounts[index]
  console.log(account)
  personal.unlockAccount(account, 'bb', UNLOCK_DURATION_AS_SECONDS)
}

console.log(
  personal.listAccounts.length + ' accounts unlocked for ',
  +UNLOCK_DURATION_AS_SECONDS / 60 + ' minutes !'
)
