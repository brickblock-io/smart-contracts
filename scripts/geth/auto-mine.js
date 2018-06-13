/* global eth,miner,txpool */
/* eslint no-var:0 */
/* eslint no-console:0 */

function automine(milliSeconds) {
  setInterval(function() {
    if (!eth.mining && (txpool.status.pending || txpool.status.queued)) {
      console.log('miner start')
      miner.start()
    } else if (eth.mining) {
      console.log('miner stop')
      miner.stop()
    }
  }, milliSeconds)
}

automine(500)

/*
 * NOTE: This automine implementation would be better because it
 * doesn't rely on setInterval. Unfortunately there seems
 * to be a bug (race condition?) in it which causes some tests
 * to time out.
 *
 * Try using this implementation with test/main-tests/AccessToken.js
 * and it'll work fine, even faster than the above implementation.
 * However, running test/main-tests/ContractRegistry.js will time
 * out with this implementation.
 *
 * function automine() {
 *   if (eth.getBlock('pending').transactions.length > 0) {
 *     if (eth.mining) return
 *
 *     console.log('Pending transactions! Mining...')
 *     miner.start(1)
 *   } else {
 *     miner.stop()
 *     console.log('No transactions! Mining stopped.')
 *   }
 * }
 *
 * eth.filter('latest', function() {
 *   automine()
 * })
 * eth.filter('pending', function() {
 *   automine()
 * })
 *
 * automine()
 */
