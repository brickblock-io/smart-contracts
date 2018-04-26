const addToken = async (pmr, custodian, broker) => {
  const txReceipt = await pmr.addToken('test', 'TST', custodian, 1000, 1e18, {
    from: broker
  })

  const tokenAddress = txReceipt.logs[0].args.token

  return { tokenAddress, txReceipt }
}

module.exports = {
  addToken
}
