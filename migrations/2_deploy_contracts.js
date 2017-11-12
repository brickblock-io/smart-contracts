const BrickblockToken = artifacts.require('./BrickblockToken.sol')
const BrickblockFountain = artifacts.require('./BrickblockFountain.sol');
const BrickblockAccessToken = artifacts.require('./BrickblockAccessToken.sol');
const Brickblock = artifacts.require('./Brickblock.sol')

module.exports = deployer => {
  return deployer.deploy(BrickblockToken)
    .then( () => deployer.deploy(BrickblockAccessToken) )
    .then( () => deployer.deploy(BrickblockFountain, BrickblockToken.address, BrickblockAccessToken.address) )
    .then( () => deployer.deploy(Brickblock) )

};
