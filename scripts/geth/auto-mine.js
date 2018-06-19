/* global eth,miner,txpool */
/* eslint no-var:0 */
/* eslint no-console:0 */

// function automine() {
//   if (eth.getBlock('pending').transactions.length > 0) {
//     if (eth.mining) return
//
//     console.log('Pending transactions! Mining...')
//     miner.start(1)
//   } else {
//     miner.stop()
//     console.log('No transactions! Mining stopped.')
//   }
// }
//
// eth.filter('latest', function() {
//   automine()
// })
// eth.filter('pending', function() {
//   automine()
// })
//
// automine()

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
