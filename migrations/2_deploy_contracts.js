const BrickblockToken = artifacts.require('./BrickblockToken.sol')
const BrickblockTokenUpgraded = artifacts.require('./BrickblockTokenUpgraded.sol')
const BrickblockFountain = artifacts.require('./BrickblockFountain.sol')
const BrickblockAccessToken = artifacts.require('./BrickblockAccessToken.sol')
const Brickblock = artifacts.require('./Brickblock.sol')

module.exports = async (deployer, network) => {
  if(network === 'test' || network === 'dev' || network === 'develop') {
    // https://github.com/trufflesuite/truffle/issues/501
    deployer.then(async () => {
      console.log(`migrating to ${network}`)
      let bbtAddress;
      await deployer.deploy(Brickblock)
      await deployer.deploy(BrickblockToken, 50, '0x0')
      await deployer.deploy(BrickblockFountain)
      await deployer.deploy(BrickblockAccessToken)
      const bbf = await BrickblockFountain.deployed()
      const act = await BrickblockAccessToken.deployed()
      const bbt = await BrickblockToken.deployed()
      await act.changeFountainLocation(bbf.address)
      await bbf.changeAccessTokenLocation(act.address)
      await bbf.changeBrickblockTokenLocation(bbt.address)
      await deployer.deploy(BrickblockTokenUpgraded, 70, bbt.address)
      const bbtU = await BrickblockTokenUpgraded.deployed()
      const predecessor = await bbtU.predecessor()
    })
  } else {
    // https://github.com/trufflesuite/truffle/issues/501
    deployer.then(async () => {
      console.log('deploying to NON test network!')
      await deployer.deploy(Brickblock)
      await deployer.deploy(BrickblockToken, 10953675)
      await deployer.deploy(BrickblockFountain)
      await deployer.deploy(BrickblockAccessToken)
      const bbf = await BrickblockFountain.deployed()
      const act = await BrickblockAccessToken.deployed()
      const bbt = await BrickblockToken.deployed()
      await act.changeFountainLocation(bbf.address)
      await bbf.changeAccessTokenLocation(act.address)
      await bbf.changeBrickblockTokenLocation(bbt.address)
    })
  }
};
