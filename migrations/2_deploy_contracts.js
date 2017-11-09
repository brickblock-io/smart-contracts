const BrickBlockToken = artifacts.require("../contracts/BrickBlockToken.sol")
const BrickBlock = artifacts.require("../contracts/BrickBlock.sol")
// const BrickBlockFountain = artifacts.require("./BrickBlockFountain.sol");

module.exports = deployer => {
  deployer.deploy(BrickBlockToken);
  // deployer.deploy(BrickBlockFountain);
};
