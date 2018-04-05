const { warpBlocks } = require('../helpers/general')

describe('when warping', () => {
  contract('WarpTool', () => {
    it('should warp to set block', async () => {
      const preBlock = web3.eth.blockNumber
      const warpAmount = 10
      await warpBlocks(warpAmount)
      const postBlock = web3.eth.blockNumber
      assert.equal(postBlock - preBlock, 10, 'should warp the right amount')
    })
  })
})
