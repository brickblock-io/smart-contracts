/* global eth,miner */
/* eslint no-var:0 */
/* eslint no-console:0 */

function automine() {
  if (eth.getBlock('pending').transactions.length > 0) {
    if (eth.mining) return

    console.log('Pending transactions! Mining...')
    miner.start(1)
  } else {
    miner.stop()
    console.log('No transactions! Mining stopped.')
  }
}

eth.filter('latest', function() {
  automine()
})
eth.filter('pending', function() {
  automine()
})

automine()
