const { send } = require('./general')

// increases time through ganache evm command
const timeTravel = async seconds => {
  /* eslint-disable no-console */
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

    console.log(`💫  Warped ${time} on new block`)
    console.log(`⏪  previous block timestamp: ${startBlock.timestamp}`)
    console.log(`✅  current block timestamp: ${currentBlock.timestamp}`)
  } else {
    console.log('💫 Did not warp... 0 seconds was given as an argument')
  }
}

const timeTravelToTarget = async targetTime => {
  const currentTime = await getCurrentBlockTime()

  // Add 1 second to compensate for `> targetTime` checks
  const timeToTravelInSeconds = targetTime
    .minus(currentTime)
    .add(1)
    .toNumber()

  return timeTravel(timeToTravelInSeconds)
}

const getCurrentBlockTime = async () =>
  (await web3.eth.getBlock(web3.eth.blockNumber)).timestamp

const getTimeInFutureBySeconds = async secondsInFuture =>
  (await getCurrentBlockTime()) + secondsInFuture

module.exports = {
  getCurrentBlockTime,
  getTimeInFutureBySeconds,
  timeTravel,
  timeTravelToTarget,
}
