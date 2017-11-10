const BrickblockToken = artifacts.require("./BrickblockToken.sol")
const Brickblock = artifacts.require("./Brickblock.sol")
// const BrickblockFountain = artifacts.require("./BrickblockFountain.sol");

module.exports = deployer => {
  deployer.deploy(BrickblockToken)
  deployer.deploy(Brickblock)
  // deployer.deploy(BrickblockFountain);
};
