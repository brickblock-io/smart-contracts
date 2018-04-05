const BrickblockToken = artifacts.require('./BrickblockToken.sol')

module.exports = deployer => {
  deployer.deploy(BrickblockToken, '0x627306090abab3a6e1400e9345bc60c78a8bef57')
}
