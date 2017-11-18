const BrickblockToken = artifacts.require('./BrickblockToken.sol')
const BrickblockTokenUpgraded = artifacts.require('./BrickblockTokenUpgraded.sol')
const BrickblockFountain = artifacts.require('./BrickblockFountain.sol')
const BrickblockAccessToken = artifacts.require('./BrickblockAccessToken.sol')
const Brickblock = artifacts.require('./Brickblock.sol')

module.exports = async (deployer, network) => {
  deployer.then(async () => {
    await deployer.deploy(Brickblock)
    await deployer.deploy(BrickblockToken)
    await deployer.deploy(BrickblockFountain)
    await deployer.deploy(BrickblockAccessToken)
    const bbf = await BrickblockFountain.deployed()
    const act = await BrickblockAccessToken.deployed()
    const bbt = await BrickblockToken.deployed()
    await act.changeFountainLocation(bbf.address)
    await bbf.changeAccessTokenLocation(act.address)
    await bbf.changeBrickblockTokenLocation(bbt.address)
  })
};
