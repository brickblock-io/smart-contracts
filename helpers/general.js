const send = (method, params = []) =>
  web3.currentProvider.send({ id: 0, jsonrpc: '2.0', method, params })

/*
   * IMPORTANT
   * We should always use this function to create the transaction config object
   * that gets passed to the actual smart contract calls to ensure we're using
   * the correct gas values and are not running into problem with different
   * default values between `truffle develop` and `yarn ganache-cli`
   */
const makeTransactionConfig = config =>
  Object.assign(
    {
      // 20 GWei
      gasPrice: 20e9,
      /*
         * Mainnet has a gas limit of roughly 8e6 at the time of writing
         * (source: https://ethstats.net )
         *
         * Truffle's gas limit defaults to 6721975
         * (source: https://github.com/trufflesuite/ganache-cli/blob/develop/args.js#L133 )
         *
         * We could tune this per contract, but here we just want to deploy contracts and
         * set up their state for e2e testing
         */
      gas: 6721975,
    },
    config
  )

const resolvePromiseMap = async obj => {
  const keys = Object.keys(obj)
  const values = Object.values(obj)

  const resolvedValues = await Promise.all(values)

  return keys.reduce((acc, key, index) => {
    acc[key] = resolvedValues[index]
    return acc
  }, {})
}

module.exports = {
  makeTransactionConfig,
  resolvePromiseMap,
  send,
}
