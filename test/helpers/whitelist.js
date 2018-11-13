const addAddress = async ({
  addressToWhitelist,
  ownerAddress,
  whitelistContract,
  isPaused,
}) => {
  assert.equal(
    await whitelistContract.whitelisted(addressToWhitelist),
    false,
    'should start false'
  )

  await whitelistContract.addAddress(addressToWhitelist, {
    from: ownerAddress,
  })

  assert.equal(
    await whitelistContract.whitelisted(addressToWhitelist),
    isPaused ? false : true,
    'should be changed to true'
  )
}

const removeAddress = async ({
  addressToWhitelist,
  ownerAddress,
  whitelistContract,
  isPaused,
}) => {
  assert.equal(
    await whitelistContract.whitelisted(addressToWhitelist),
    isPaused ? false : true,
    'should start true'
  )

  await whitelistContract.removeAddress(addressToWhitelist, {
    from: ownerAddress,
  })

  assert.equal(
    await whitelistContract.whitelisted(addressToWhitelist),
    false,
    'should be changed to false'
  )
}

module.exports = { addAddress, removeAddress }
