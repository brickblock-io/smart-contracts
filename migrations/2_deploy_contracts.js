/* eslint-disable no-console */
const ContractRegistry = artifacts.require('ContractRegistry')

module.exports = (deployer, network) => {
  console.log(`using ${network} network`)

  deployer
    .then(async () => {
      await deployer.deploy(ContractRegistry)
      return true
    })
    .catch(err => {
      // eslint-disable-next-line no-console
      console.error(err)
    })
}
