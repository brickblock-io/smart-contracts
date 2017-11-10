const Brickblock = artifacts.require('Brickblock')
require('chai').should()

// const defaults = {
//   brokers: ['0xb000751ad5a01af93267b52910e24793cd0c7b55']
// }

async function brickblock() {
  return await Brickblock.new()
}

// async function brickblock_with_broker(cb) {
//   const bb = Brickblock.new()
//   await bb.addBroker.sendTransaction(defaults.brokers[0])
//   return bb
// }

contract('Brickblock', accounts => {
  it('should deploy the contract', async () => {
    const bb = await brickblock()
    bb.contract.owner().should.eql(accounts[0])
  })

  it('should list brokers', async () => {
    const bb = await brickblock()
    await bb.addBroker.sendTransaction(accounts[1])
    const list = await bb.listBrokers.call()
    list.should.eql([accounts[1]])
  })

  it('should register broker', async () => {
    const bb = await brickblock()
    await bb.addBroker.sendTransaction(accounts[1], { from: accounts[0] })
    const list = await bb.listBrokers.call()
    list.should.eql([accounts[1]])
  })

  it('should only allow broker registration from owner address', async () => {
    const bb = await brickblock()
    return bb.addBroker
      .sendTransaction(accounts[1], { from: accounts[1] })
      .then(() => assert(false, 'Expected to throw'))
      .catch(e => e.should.match(/invalid opcode/))
  })
})
