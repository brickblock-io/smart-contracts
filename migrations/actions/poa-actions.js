const { argv } = require('../helpers/arguments')
const logger = require('../../scripts/lib/logger')

const migrationHelpers = require('../helpers')

const poaActions = async (deployer, accounts, contracts, web3, network) => {
  const {
    general: { isValidAddress, isBigNumber, getAccounts },
    deployment: { deployContracts }
  } = migrationHelpers

  const { executeAddress, executeTxConfig, executeFunctionName } = argv

  const { IPoaTokenCrowdsale } = contracts
  const useStub = network.search('dev') > -1

  const instances = await deployContracts(deployer, accounts, contracts, {
    useExpStub: useStub,
    useExistingContracts: argv.useExistingContracts,
    network
  })

  let contractAddress
  if (isValidAddress(executeAddress)) {
    contractAddress = executeAddress
  } else if (Number.isInteger(executeAddress)) {
    const tokenList = await instances.PoaManager.getTokenAddressList()
    contractAddress = tokenList[executeAddress]
  } else {
    logger.error(
      '--execute-address must be a valid ethereum address or an index number'
    )
    process.exit(1)
  }

  const poaTokenInstance = IPoaTokenCrowdsale.at(contractAddress)

  const txConfigParsed =
    typeof executeTxConfig === 'string' ? JSON.parse(executeTxConfig) : {}

  if (
    typeof txConfigParsed.from !== 'undefined' &&
    isValidAddress(txConfigParsed.from) === false
  ) {
    logger.info(`getting ${txConfigParsed.from} from accounts`)

    txConfigParsed.from = getAccounts(accounts)[txConfigParsed.from]
    if (typeof txConfigParsed.from === 'undefined') {
      logger.error(
        `Invalid address please check the name of the address. The possible choices are: ${Object.keys(
          getAccounts(accounts)
        )}`
      )
      process.exit(1)
    }
  }

  const fnArguments = [...argv.executeArguments]
  if (Object.keys(txConfigParsed).length > 0) {
    fnArguments.push(txConfigParsed)
  }

  logger.info(
    `Calling ${executeFunctionName}(${JSON.stringify(
      ...fnArguments,
      null,
      2
    )}) function in PoaToken Contract at ${contractAddress}`
  )

  const tx = await poaTokenInstance[executeFunctionName].apply(
    poaTokenInstance,
    fnArguments
  )

  logger.info(isBigNumber(tx) ? tx.toString() : tx)
}

module.exports = poaActions
