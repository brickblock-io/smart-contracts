/* eslint-disable */
const { init } = require('./helpers/arguments')

// dummy exports to make truffle happy
module.exports = (deployer, network, accounts) => {
  init(network)
}
