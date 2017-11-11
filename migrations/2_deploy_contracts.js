const BrickblockToken = artifacts.require("./BrickblockToken.sol")
const Brickblock = artifacts.require("./Brickblock.sol")
const BrickblockFountain = artifacts.require("./BrickblockFountain.sol");

module.exports = deployer => {
  return deployer.deploy(BrickblockToken)
    .then( () => deployer.deploy(BrickblockFountain, BrickblockToken.address) )
    .then( () => deployer.deploy(Brickblock) )

};
