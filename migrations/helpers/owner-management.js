const chalk = require('chalk')
const logger = require('../../scripts/lib/logger')

const transferOwnershipOfAllContracts = async (contracts, owner, newOwner) => {
  const contractNames = Object.keys(contracts)
  let totalGasUsed = 0
  for (let index = 0; index < contractNames.length; index++) {
    const contractName = contractNames[index]
    const contract = contracts[contractName]
    const isOwnable = typeof contract.owner === 'function'

    if (isOwnable) {
      const isOwner = (await contract.owner.call()) === owner

      if (isOwner) {
        logger.info(chalk.yellow(`Transferring ownership of ${contractName}`))
        const tx = await contract.transferOwnership(newOwner, { from: owner })
        totalGasUsed += tx.receipt.gasUsed
        logger.info(
          chalk.yellow(
            `\n Transferred ownership of ${contractName} from '${owner}' to '${newOwner}'`
          )
        )
      }
    }
  }

  logger.info('total gas used', totalGasUsed)

  return {
    gasUsed: totalGasUsed
  }
}

module.exports = {
  transferOwnershipOfAllContracts
}
