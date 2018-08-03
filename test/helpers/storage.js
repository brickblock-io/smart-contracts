const BigNumber = require('bignumber.js')
const leftPad = require('left-pad')

const getAllSequentialStorage = async addr => {
  let slot = 0
  let zeroCounter = 0
  const sequentialStorage = []
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await web3.eth.getStorageAt(addr, slot)
    if (new BigNumber(data).equals(0)) {
      zeroCounter++
    }

    sequentialStorage.push({
      slot,
      data
    })
    slot++

    if (zeroCounter > 20) {
      break
    }
  }

  return sequentialStorage
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

const standardizeInput = input =>
  leftPad(web3.toHex(input).replace('0x', ''), 64, '0')

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
const shortHexStringStorageToAscii = hex =>
  web3.toAscii(hex.slice(0, parseInt('0x' + hex[hex.length - 1], 16) + 2))

const hasZeroBytesAfter = (bytesBuffer, offset) => {
  let hasZeroBytes = true

  if (offset === bytesBuffer.length) return false

  let index = 0
  for (const byte of bytesBuffer.values()) {
    if (index > offset) {
      hasZeroBytes = hasZeroBytes && byte === 0
    }

    index++
  }

  return hasZeroBytes
}

const trimRightBytes = hex => {
  const bytesBuffer = Buffer.from(hex.replace('0x', ''), 'hex')
  const bytesArray = []
  let counter = 0

  for (const byte of bytesBuffer.values()) {
    if (
      byte !== 0 ||
      (byte === 0 && !hasZeroBytesAfter(bytesBuffer, counter))
    ) {
      bytesArray.push(byte)
    }

    counter++
  }

  return '0x' + Buffer.from(bytesArray, 'hex').toString('hex')
}

const bytes32StorageToAscii = hex => {
  const trimmedBytes = trimRightBytes(hex)
  // because solidity also uses ascii NOT utf8
  return Buffer.from(trimmedBytes.replace('0x', ''), 'hex').toString('ascii')
}

module.exports = {
  getAllSequentialStorage,
  findMappingStorage,
  getMappingSlot,
  getMappingStorage,
  getNestedMappingStorage,
  findNestedMappingStorage,
  shortHexStringStorageToAscii,
  bytes32StorageToAscii,
  trimRightBytes
}
