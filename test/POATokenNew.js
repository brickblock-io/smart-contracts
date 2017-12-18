const POAToken = artifacts.require('POAToken')
const BrickblockAccessToken = artifacts.require('BrickblockAccessToken')
const BrickblockUmbrellaStub = artifacts.require('BrickblockUmbrellaStub')
const BrickblockWhitelist = artifacts.require('BrickblockWhitelist')
const WarpTool = artifacts.require('WarpTool')
const BigNumber = require('bignumber.js')

const stages = {
  funding: 0,
  pending: 1,
  failed: 2,
  active: 3,
  terminated: 4
}

function getEtherBalance(address) {
  return new Promise((resolve, reject) => {
    web3.eth.getBalance(address, (err, res) => {
      if(err)
        reject(err)
      resolve(res)
    })
  });
}

function warpBlocks(blocks) {
  return new Promise((resolve, reject) => {
    contract('WarpTool', async accounts => {
      const warpTool = await WarpTool.new()
      for(let i = 0; i < blocks - 1; i++) {
        await warpTool.warp()
      }
      resolve(true)
    })
  })
}

describe('when in Funding stage', () => {
  contract('POAToken', accounts => {
    const ownerAddress = accounts[0]
    // for now this is the same... need to talk about this
    const brokerAddress = accounts[0]
    const custodianAddress = accounts[1]
    const whitelistedBuyerAddress = accounts[2]
    const nonWhitelistedBuyerAddress = accounts[3]
    const amount = new BigNumber(1e18)
    let poa
    let wht
    let act
    let umb

    // TODO: do we really want to differentiate owner and broker? cody does not think so...
    before('setup contracts state', async () => {
      poa = await POAToken.new(
        'TestToken',
        'TST',
        ownerAddress,
        custodianAddress,
        100,
        2e18
      )
      wht = await BrickblockWhitelist.new()
      act = await BrickblockAccessToken.new()
      umb = await BrickblockUmbrellaStub.new()
      await poa.changeWhitelist(wht.address)
      await act.changeUmbrellaAddress(umb.address)
      await umb.changeAccessTokenAddress(act.address)
      await umb.addBroker(brokerAddress)
      await act.mint(brokerAddress, 50e18)
      await act.approve.sendTransaction(poa.address, 50e18, {
        from: brokerAddress
      })
      await wht.addAddress(whitelistedBuyerAddress)
    })

    it('should initalize with the right values', async () => {
      const owner = await poa.owner()
      const name = await poa.name()
      const symbol = await poa.symbol()
      const broker = await poa.broker()
      const custodian = await poa.custodian()
      const timeoutBlock = await poa.timeoutBlock()
      const totalSupply = await poa.totalSupply()
      const feePercentage = await poa.feePercentage()
      const decimals = await poa.decimals()
      assert(owner === ownerAddress, 'the owner should be that which was set')
      assert(name === 'TestToken', 'the name should be that which was set')
      assert(symbol === 'TST', 'the symbol should be that which was set')
      assert(broker === brokerAddress, 'the broker should be that which was set')
      assert(custodian === custodianAddress, 'the custodian should be that which was set')
      assert(timeoutBlock.toNumber() === 100, 'the timeout should be that which was set')
      assert(totalSupply.toNumber() === 2e18, 'the totalSupply should be that which was set')
      assert(feePercentage.toNumber() === 5, 'the owner should be that which was set')
      assert(decimals.toNumber() === 18, 'the owner should be that which was set')
    })

    it('should start in Funding stage', async () => {
      const stage = await poa.stage()
      assert.equal(stage.toNumber(), stages.funding, 'the contract stage should be Active')
    })

    it('should buy when whitelisted', async () => {
      const preBuyerTokenBalance = await poa.balanceOf(whitelistedBuyerAddress)
      const preOwnerTokenBalance = await poa.balanceOf(ownerAddress)
      await poa.buy.sendTransaction({
        from: whitelistedBuyerAddress, value: amount
      })
      const postBuyerTokenBalance = await poa.balanceOf(whitelistedBuyerAddress)
      const postOwnerTokenBalance = await poa.balanceOf(ownerAddress)
      assert.equal(postBuyerTokenBalance.minus(preBuyerTokenBalance).toString(), amount.toString(), 'the buyer balance should be incremented by the buy amount')
      assert.equal(preOwnerTokenBalance.minus(postOwnerTokenBalance).toString(), amount.toString(), 'the owner balance should be decremented by the buy amount')
    })

    it('should NOT buy when NOT whitelisted', async () => {
      try {
        await poa.buy.sendTransaction({
          from: nonWhitelistedBuyerAddress, value: amount
        })
        assert(false, 'the contract should throw here')
      } catch(error) {
        assert(/invalid opcode/.test(error), 'the message should contain invalid opcode')
      }
    })

    it('should NOT buy if more than is available', async () => {
      try {
        await poa.buy.sendTransaction({
          from: whitelistedBuyerAddress,
          value: amount.mul(2)
        })
        assert(false, 'the contract should throw here')
      } catch(error) {
        assert(/invalid opcode/.test(error), 'the error message should contain invalid opcode')
      }
    })

    it('should NOT be able to be activated by custodian', async () => {
      try {
        await poa.activate.sendTransaction({
          from: custodianAddress
        })
        assert(false, 'the contract should throw')
      } catch(error) {
        assert(/invalid opcode/.test(error), 'the error message should contain invalid opcode')
      }
    })

    it('should NOT be able to be terminated', async () => {
      try {
        await poa.terminate.sendTransaction({
          from: brokerAddress
        })
        assert(false, 'the contract should throw')
      } catch(error) {
        assert(/invalid opcode/.test(error), 'the error message should contain invalid opcode')
      }
    })


    it('should NOT allow reclaiming', async () => {
      try {
        await poa.reclaim.sendTransaction({
          from: whitelistedBuyerAddress
        })
        assert(false, 'the contract should throw')
      } catch(error) {
        assert(/invalid opcode/.test(error), 'the error message should contain invalid opcode')
      }
    })

    it('should NOT allow payouts', async () => {
      try {
        await poa.payout.sendTransaction({
          from: brokerAddress
        })
        assert(false, 'the contract should throw')
      } catch(error) {
        assert(/invalid opcode/.test(error), 'the error message should contain invalid opcode')
      }
    })

    it('should NOT allow claiming', async () => {
      try {
        await poa.claim.sendTransaction({
          from: whitelistedBuyerAddress
        })
        assert(false, 'the contract should throw')
      } catch(error) {
        assert(/invalid opcode/.test(error), 'the error message should contain invalid opcode')
      }
    })

    it('should enter Pending stage once all tokens have been bought', async () => {
      const preBuyerTokenBalance = await poa.balanceOf(whitelistedBuyerAddress)
      const preOwnerTokenBalance = await poa.balanceOf(ownerAddress)
      await poa.buy.sendTransaction({
        from: whitelistedBuyerAddress, value: amount
      })
      const postBuyerTokenBalance = await poa.balanceOf(whitelistedBuyerAddress)
      const postOwnerTokenBalance = await poa.balanceOf(ownerAddress)
      assert.equal(postBuyerTokenBalance.minus(preBuyerTokenBalance).toString(), amount.toString(), 'the buyer balance should be incremented by the buy amount')
      assert.equal(preOwnerTokenBalance.minus(postOwnerTokenBalance).toString(), amount.toString(), 'the owner balance should be decremented by the buy amount')
      const stage = await poa.stage()
      assert.equal(stage, stages.pending, 'the contract should be in Pending stage')
    })
  })
})

describe('when in Pending stage', () => {
  contract('POAToken', accounts => {
    const ownerAddress = accounts[0]
    const brokerAddress = accounts[0]
    const custodianAddress = accounts[1]
    const whitelistedBuyerAddress = accounts[2]
    const nonWhitelistedBuyerAddress = accounts[3]
    const amount = new BigNumber(1e18)
    let poa
    let wht
    let umb

    before('setup contract pending state', async () => {
      poa = await POAToken.new(
        'TestToken',
        'TST',
        ownerAddress,
        custodianAddress,
        100,
        amount
      )
      wht = await BrickblockWhitelist.new()
      act = await BrickblockAccessToken.new()
      umb = await BrickblockUmbrellaStub.new()
      await poa.changeWhitelist(wht.address)
      await act.changeUmbrellaAddress(umb.address)
      await umb.changeAccessTokenAddress(act.address)
      await umb.addBroker(brokerAddress)
      await act.mint(brokerAddress, 50e18)
      await act.approve.sendTransaction(poa.address, 50e18, {
        from: brokerAddress
      })
      await wht.addAddress(whitelistedBuyerAddress)
      await poa.buy.sendTransaction({
        from: whitelistedBuyerAddress,
        value: amount
      })
    })

    it('should be in Pending stage', async () => {
      const stage = await poa.stage()
      assert.equal(stage.toNumber(), stages.pending, 'the contract stage should be Pending')
    })

    it('should NOT allow buying', async () => {
      try {
        await poa.buy.sendTransaction({
          from: whitelistedBuyerAddress
        })
        assert(false, 'the contract should throw')
      } catch(error) {
        assert(/invalid opcode/.test(error), 'the error message should contain invalid opcode')
      }
    })

    it('should NOT enter Active stage if not custodian', async () => {
      try {
        await poa.activate.sendTransaction({
          from: whitelistedBuyerAddress
        })
        assert(false, 'the contract should throw')
      } catch(error) {
        assert(/invalid opcode/.test(error), 'the error message should contain invalid opcode')
      }
    })

    it('should NOT allow reclaiming', async () => {
      try {
        await poa.reclaim.sendTransaction({
          from: whitelistedBuyerAddress
        })
        assert(false, 'the contract should throw')
      } catch(error) {
        assert(/invalid opcode/.test(error), 'the error message should contain invalid opcode')
      }
    })

    it('should NOT allow payouts', async () => {
      try {
        await poa.payout.sendTransaction({
          from: brokerAddress
        })
        assert(false, 'the contract should throw')
      } catch(error) {
        assert(/invalid opcode/.test(error), 'the error message should contain invalid opcode')
      }
    })

    it('should NOT allow claiming', async () => {
      try {
        await poa.claim.sendTransaction({
          from: whitelistedBuyerAddress
        })
        assert(false, 'the contract should throw')
      } catch(error) {
        assert(/invalid opcode/.test(error), 'the error message should contain invalid opcode')
      }
    })

    it('should enter Active stage if custodian', async () => {
      await poa.activate.sendTransaction({
        from: custodianAddress
      })
      const stage = await poa.stage()
      assert.equal(stage.toNumber(), stages.active, 'the contract stage should be Active')
    })
  })
})

describe('when in Active stage', () => {
  contract('POAToken', accounts => {
    const ownerAddress = accounts[0]
    const brokerAddress = accounts[0]
    const custodianAddress = accounts[1]
    const whitelistedBuyerAddress1 = accounts[2]
    const whitelistedBuyerAddress2 = accounts[3]
    const nonWhitelistedBuyerAddress = accounts[4]
    const amount = new BigNumber(1e18)
    let poa
    let wht
    let umb

    before('setup contracts state', async () => {
      poa = await POAToken.new(
        'TestToken',
        'TST',
        ownerAddress,
        custodianAddress,
        100,
        2e18
      )
      wht = await BrickblockWhitelist.new()
      act = await BrickblockAccessToken.new()
      umb = await BrickblockUmbrellaStub.new()
      await poa.changeWhitelist(wht.address)
      await poa.changeAccessToken(act.address)
      await act.changeUmbrellaAddress(umb.address)
      await umb.changeAccessTokenAddress(act.address)
      await umb.addFakeToken(poa.address)
      await act.mint(brokerAddress, 50e18)
      await act.approve.sendTransaction(poa.address, 50e18, {
        from: brokerAddress
      })
      await wht.addAddress(whitelistedBuyerAddress1)
      await wht.addAddress(whitelistedBuyerAddress2)
      await poa.buy.sendTransaction({
        from: whitelistedBuyerAddress1,
        value: amount
      })
      await poa.buy.sendTransaction({
        from: whitelistedBuyerAddress2,
        value: amount
      })
      await poa.activate.sendTransaction({
        from: custodianAddress
      })
    })
    /*
    should do the following:
    terminate
    transfer
    */

    it('should be in Active stage', async () => {
      const stage = await poa.stage()
      assert.equal(stage.toNumber(), stages.active, 'the contract stage should be Active')
    })

    it('should calculate fees', async () => {
      const feePercentage = await poa.feePercentage()
      const expectedFee = amount.mul(feePercentage).div(100)
      const calculatedFee = await poa.calculateFee(amount)
      assert(calculatedFee.toNumber(), expectedFee.toNumber(), 'the fees should match')
    })

    it('should run payout when broker', async () => {
      const preTotalPayout = await poa.totalPayout()
      const preBrokerTokenBalance = await act.balanceOf(brokerAddress)
      const fee = await poa.calculateFee(amount)
      await poa.payout.sendTransaction({
        from: brokerAddress,
        value: amount
      })
      const postTotalPayout = await poa.totalPayout()
      const postBrokerTokenBalance = await act.balanceOf(brokerAddress)
      assert(postTotalPayout.minus(preTotalPayout).toString(), amount.toString(), 'totalPayout should be incremented by the ether value of the transaction')
      assert(preBrokerTokenBalance.minus(postBrokerTokenBalance).toString(), fee.toString(), 'the broker token balance should be decremented by the fee value')
    })

    it('should NOT run payout when NOT broker', async () => {
      try {
        await poa.payout.sendTransaction({
          from: custodianAddress,
          value: amount
        })
        assert(false, 'the contract should throw here')
      } catch(error) {
        assert(/invalid opcode/.test(error), 'the error message should contain invalid opcode')
      }
    })

    it('should allow claiming dividends', async () => {
      const preEtherBalance = await getEtherBalance(whitelistedBuyerAddress1)
      const currentPayout = await poa.currentPayout(whitelistedBuyerAddress1)
      await poa.claim.sendTransaction({
        from: whitelistedBuyerAddress1
      })
      const postEtherBalance = await getEtherBalance(whitelistedBuyerAddress1)
      assert(postEtherBalance.minus(preEtherBalance).toString(), currentPayout.toString())
    })

    it('should NOT allow claiming the same payout again', async () => {
      try {
        await poa.claim.sendTransaction({
          from: whitelistedBuyerAddress1
        })
        assert(false, 'the contract should throw')
      } catch(error) {
        assert(/invalid opcode/.test(error), 'the error message should contain invalid opcode')
      }
    })

    it('should NOT allow claiming from a non-investor', async () => {
      try {
        await poa.claim.sendTransaction({
          from: brokerAddress
        })
        assert(false, 'the contract should throw')
      } catch(error) {
        assert(/invalid opcode/.test(error), 'the error message should contain invalid opcode')
      }
    })
  })
})

describe('when a contract does NOT meet its funding goal', () => {
  contract('POAToken', accounts => {
    const ownerAddress = accounts[0]
    let poa

    before('setup contract state', async () => {
      poa = POAToken.new()
    })

    it('should derp', async () => {
      assert(true)
    })
  })
})

// TODO: this may not be needed
describe('when a contract has problems after becoming Active (acts of god etc?)', () => {
  contract('POAToken', accounts => {
    const ownerAddress = accounts[0]
    let poa

    before('setup contract state', async () => {
      poa = await POAToken.new()
    })

    it('should derp', async () => {
      assert(true)
    })
  })
})
