const BigNumber = require('bignumber.js')

const getAllSimpleStorage = async addr => {
  let slot = 0
  let zeroCounter = 0
  const simpleStorage = []
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await web3.eth.getStorageAt(addr, slot)
    if (new BigNumber(data).equals(0)) {
      zeroCounter++
    }

    simpleStorage.push({
      slot,
      data
    })
    slot++

    if (zeroCounter > 20) {
      break
    }
  }

  return simpleStorage
}

const findMappingStorage = async (address, key, startSlot, endSlot) => {
  const bigStart = startSlot.add ? startSlot : new BigNumber(startSlot)
  const bigEnd = endSlot.add ? endSlot : new BigNumber(endSlot)

  for (
    let mappingSlot = bigStart;
    mappingSlot.lt(bigEnd);
    mappingSlot = mappingSlot.add(1)
  ) {
    const mappingValueSlot = getMappingSlot(mappingSlot.toString(), key)
    const mappingValueStorage = await web3.eth.getStorageAt(
      address,
      mappingValueSlot
    )
    if (mappingValueStorage != '0x00') {
      return {
        mappingValueStorage,
        mappingValueSlot,
        mappingSlot
      }
    }
  }

  return null
}

const standardizeInput = input => {
  input = input.replace('0x', '')
  return input.length >= 64 ? input : '0'.repeat(64 - input.length) + input
}

const getMappingSlot = (mappingSlot, key) => {
  const mappingSlotPadded = standardizeInput(mappingSlot)
  const keyPadded = standardizeInput(key)
  const slot = web3.sha3(keyPadded.concat(mappingSlotPadded), {
    encoding: 'hex'
  })

  return slot
}

const getMappingStorage = async (address, mappingSlot, key) => {
  const mappingKeySlot = getMappingSlot(mappingSlot.toString(), key)
  const complexStorage = await web3.eth.getStorageAt(address, mappingKeySlot)
  return complexStorage
}

const getNestedMappingStorage = async (address, mappingSlot, key, key2) => {
  const nestedMappingSlot = getMappingSlot(mappingSlot.toString(), key)

  const nestedMappingValueSlot = getMappingSlot(nestedMappingSlot, key2)

  const nestedMappingValueStorage = await web3.eth.getStorageAt(
    address,
    nestedMappingValueSlot
  )

  return {
    nestedMappingSlot,
    nestedMappingValueSlot,
    nestedMappingValueStorage
  }
}

const findNestedMappingStorage = async (
  address,
  key,
  key2,
  slotStart,
  slotEnd
) => {
  const bigStart = new BigNumber(slotStart)
  const bigEnd = new BigNumber(slotEnd)

  for (
    let mappingSlot = bigStart;
    mappingSlot.lt(bigEnd);
    mappingSlot = mappingSlot.add(1)
  ) {
    const nestedMappingSlot = getMappingSlot(mappingSlot.toString(), key)
    const nestedMappingValueSlot = getMappingSlot(nestedMappingSlot, key2)

    const nestedMappingValueStorage = await web3.eth.getStorageAt(
      address,
      nestedMappingValueSlot
    )

    if (nestedMappingValueStorage != '0x00') {
      return {
        nestedMappingValueStorage,
        mappingSlot,
        nestedMappingSlot,
        nestedMappingValueSlot
      }
    }
  }

  return null
}

// must be small enough to fit string length value in same slot as string
const shortHexStorageToAscii = hex =>
  web3.toAscii(hex.slice(0, parseInt('0x' + hex[hex.length - 1], 16) + 2))

module.exports = {
  getAllSimpleStorage,
  findMappingStorage,
  getMappingSlot,
  getMappingStorage,
  getNestedMappingStorage,
  findNestedMappingStorage,
  shortHexStorageToAscii
}
