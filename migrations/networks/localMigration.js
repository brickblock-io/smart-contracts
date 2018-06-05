/* eslint-disable no-console */
const bbk = require('../helpers/bbk')
const BigNumber = require('bignumber.js')
const {
  deployContracts,
  addContractsToRegistry,
  setFiatRate
} = require('../helpers/general')

const localMigration = async (deployer, accounts, contracts) => {
  const owner = accounts[0]
  const contributors = accounts.slice(2, 5)

  const instances = await deployContracts(deployer, accounts, contracts)

  await addContractsToRegistry({ contracts: instances, owner })

  console.log('setting EUR rate')
  await setFiatRate(instances.exr, instances.exp, 'EUR', 5e4, true, {
    from: owner,
    value: 2e18
  })

  await bbk.finalizeBbk(
    instances.bbk,
    owner,
    instances.bat.address,
    contributors,
    new BigNumber('1e21')
  )
}

module.exports = {
  localMigration
}
