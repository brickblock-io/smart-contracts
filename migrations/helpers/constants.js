const BigNumber = require('bignumber.js')

/*
 * Human readable variables for large numbers.
 */
const oneWeekInSec = 7 * 24 * 60 * 60
const twoWeeksInSec = 2 * oneWeekInSec
const oneHundredThousandEuroInCents = new BigNumber(10000000)
const oneHundredThousandTokensInWei = new BigNumber(100000e18)

module.exports = {
  oneWeekInSec,
  twoWeeksInSec,
  oneHundredThousandTokensInWei,
  oneHundredThousandEuroInCents
}
