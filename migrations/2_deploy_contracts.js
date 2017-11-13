const BrickblockToken = artifacts.require('./BrickblockToken.sol')
const BrickblockFountain = artifacts.require('./BrickblockFountain.sol');
const BrickblockAccessToken = artifacts.require('./BrickblockAccessToken.sol');
const Brickblock = artifacts.require('./Brickblock.sol')

module.exports = deployer => {
  deployer.deploy(Brickblock)
  deployer.deploy(BrickblockToken)
  deployer.deploy(BrickblockFountain)
  deployer.deploy(BrickblockAccessToken)
  deployer.then(async () => {
    const bbf = await BrickblockFountain.deployed()
    const act = await BrickblockAccessToken.deployed()
    const bbt = await BrickblockToken.deployed()
    await act.changeFountainLocation(bbf.address)
    await bbf.changeAccessTokenLocation(act.address)
    await bbf.changeBrickblockTokenLocation(bbt.address)
  })
};
