const WarpTool = artifacts.require('WarpTool')

function warpBlocks(blocks) {
  return new Promise((resolve, reject) => {
    contract('WarpTool', async accounts => {
      const warpTool = await WarpTool.new()
      for (let i = 0; i < blocks - 1; i++) {
        await warpTool.warp()
      }
      resolve(true)
    })
  })
}

describe('when warping', () => {
  contract('WarpTool', accounts => {
    it('should warp to set block', async () => {
      const preBlock = web3.eth.blockNumber
      const warpAmount = 10
      await warpBlocks(warpAmount)
      const postBlock = web3.eth.blockNumber
      console.log(preBlock, postBlock)
      assert.equal(postBlock - preBlock, 10, 'should warp the right amount')
    })
  })
})
