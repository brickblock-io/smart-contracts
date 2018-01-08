const BrickblockToken = artifacts.require('./BrickblockToken.sol')
const BrickblockTokenUpgraded = artifacts.require(
  './BrickblockTokenUpgraded.sol'
)
const BrickblockFountain = artifacts.require('./BrickblockFountain.sol')
const BrickblockAccessToken = artifacts.require('./BrickblockAccessToken.sol')
const BrickblockUmbrella = artifacts.require('./BrickblockUmbrella.sol')
const BrickblockWhitelist = artifacts.require('./BrickblockWhitelist.sol')

module.exports = async (deployer, network) => {
  if(network === 'dev' || network === 'test') {
    deployer.then(async () => {
      await deployer.deploy(BrickblockUmbrella)
      await deployer.deploy(BrickblockToken, '0x627306090abab3a6e1400e9345bc60c78a8bef57')
      await deployer.deploy(BrickblockFountain)
      await deployer.deploy(BrickblockAccessToken)
      await deployer.deploy(BrickblockWhitelist)
      const bbf = await BrickblockFountain.deployed()
      const act = await BrickblockAccessToken.deployed()
      const bbk = await BrickblockToken.deployed()
      await act.changeFountainAddress(bbf.address)
      await bbf.changeAccessTokenLocation(act.address)
      await bbf.changeBrickblockTokenLocation(bbk.address)
    })
  } else {
    deployer.then(async () => {
      await deployer.deploy(BrickblockToken, '0x627306090abab3a6e1400e9345bc60c78a8bef57')
    })
  }

}
