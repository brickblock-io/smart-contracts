const { send } = require('./general')

// increases time through ganache evm command
const timeTravel = async seconds => {
  if (seconds > 0) {
    const startBlock = await web3.eth.getBlock(web3.eth.blockNumber)

    await send('evm_increaseTime', [seconds])
    await send('evm_mine')

    const currentBlock = await web3.eth.getBlock(web3.eth.blockNumber)

    const oneMinuteInSeconds = 60
    const oneHourInSeconds = 3600
    const oneDayInSeconds = 86400

    let time = `${seconds} seconds`
    if (seconds >= oneMinuteInSeconds && seconds < oneHourInSeconds) {
      time = `${seconds / 60} minutes`
    } else if (seconds >= oneHourInSeconds && seconds < oneDayInSeconds) {
      time = `${seconds / 60 / 60} hours`
    } else if (seconds >= oneDayInSeconds) {
      time = `${seconds / 60 / 60 / 24} days`
    }

    /* eslint-disable no-console */
    console.log(`💫  Warped ${time} on new block`)
    console.log(`⏪  previous block timestamp: ${startBlock.timestamp}`)
    console.log(`✅  current block timestamp: ${currentBlock.timestamp}`)
    /* eslint-enable no-console */
  } else {
    // eslint-disable-next-line
    console.log('💫 Did not warp... 0 seconds was given as an argument')
  }
}

module.exports = {
  timeTravel
}
