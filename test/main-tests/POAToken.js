const PoaToken = artifacts.require('PoaToken')
const BigNumber = require('bignumber.js')
const { getEtherBalance } = require('../helpers/general')
const { stages, setupContracts } = require('../helpers/poa')
const { lockAllBbk, testWillThrow } = require('../helpers/general')

describe('when in Funding stage', () => {
  contract('PoaToken', accounts => {
    const ownerAddress = accounts[0]
    const bonusAddress = accounts[1]
    const brokerAddress = accounts[2]
    const custodianAddress = accounts[3]
    const whitelistedBuyerAddress1 = accounts[4]
    const whitelistedBuyerAddress2 = accounts[5]
    const icoContributors = accounts.slice(6)
    const initialSupply = new BigNumber(2e18)
    const buyAmount = new BigNumber(1e18)
    const actRate = new BigNumber(1000)
    const bbkDistAmount = new BigNumber(1e18)
    let poa

    before('setup contracts state', async () => {
      const { reg } = await setupContracts(
        ownerAddress,
        bonusAddress,
        icoContributors,
        bbkDistAmount,
        actRate,
        [whitelistedBuyerAddress1, whitelistedBuyerAddress2]
      )

      poa = await PoaToken.new(
        'TestToken',
        'TST',
        brokerAddress,
        custodianAddress,
        reg.address,
        100,
        initialSupply
      )
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
      assert.equal(
        broker,
        brokerAddress,
        'the broker should be that which was set'
      )
      assert.equal(
        custodian,
        custodianAddress,
        'the custodian should be that which was set'
      )
      assert.equal(
        timeoutBlock.toString(),
        new BigNumber(100).toString(),
        'the timeout should be that which was set'
      )
      assert.equal(
        totalSupply.toString(),
        new BigNumber('2e18').toString(),
        'the totalSupply should be that which was set'
      )
      assert.equal(
        feePercentage.toString(),
        new BigNumber(5).toString(),
        'the owner should be that which was set'
      )
      assert.equal(
        decimals.toString(),
        new BigNumber(18).toString(),
        'the owner should be that which was set'
      )
    })

    it('should start in Funding stage', async () => {
      const stage = await poa.stage()
      assert.equal(
        stage.toNumber(),
        stages.funding,
        'the contract stage should be Active'
      )
    })

    it('should buy when whitelisted', async () => {
      const preBuyerTokenBalance = await poa.balanceOf(whitelistedBuyerAddress1)
      const preOwnerTokenBalance = await poa.balanceOf(ownerAddress)
      await poa.buy({
        from: whitelistedBuyerAddress1,
        value: buyAmount
      })
      const postBuyerTokenBalance = await poa.balanceOf(
        whitelistedBuyerAddress1
      )
      const postOwnerTokenBalance = await poa.balanceOf(ownerAddress)
      assert.equal(
        postBuyerTokenBalance.minus(preBuyerTokenBalance).toString(),
        buyAmount.toString(),
        'the buyer balance should be incremented by the buy buyAmount'
      )
      assert.equal(
        preOwnerTokenBalance.minus(postOwnerTokenBalance).toString(),
        buyAmount.toString(),
        'the owner balance should be decremented by the buy buyAmount'
      )
    })

    it('should NOT buy when NOT whitelisted', async () => {
      await testWillThrow(poa.buy, [
        {
          from: custodianAddress,
          value: buyAmount
        }
      ])
    })

    it('should NOT buy if more than is available', async () => {
      await testWillThrow(poa.buy, [
        {
          from: whitelistedBuyerAddress1,
          value: initialSupply.mul(2)
        }
      ])
    })

    it('should NOT be able to be activated by custodian', async () => {
      await testWillThrow(poa.activate, [{ from: custodianAddress }])
    })

    it('should NOT be able to be terminated', async () => {
      await testWillThrow(poa.terminate, [{ from: brokerAddress }])
    })

    it('should NOT allow reclaiming', async () => {
      await testWillThrow(poa.reclaim, [{ from: whitelistedBuyerAddress1 }])
    })

    it('should NOT allow payouts', async () => {
      await testWillThrow(poa.payout, [{ from: brokerAddress, value: 1e18 }])
    })

    it('should NOT allow claiming', async () => {
      await testWillThrow(poa.claim, [{ from: whitelistedBuyerAddress1 }])
    })

    it('should NOT be able to be terminated', async () => {
      await testWillThrow(poa.terminate, [{ from: brokerAddress }])
    })

    it('should NOT allow reclaiming', async () => {
      await testWillThrow(poa.reclaim, [{ from: whitelistedBuyerAddress1 }])
    })

    it('should NOT allow payouts', async () => {
      await testWillThrow(poa.payout, [{ from: brokerAddress }])
    })

    it('should NOT allow claiming', async () => {
      await testWillThrow(poa.claim, [{ from: whitelistedBuyerAddress1 }])
    })

    it('should enter Pending stage once all tokens have been bought', async () => {
      const preBuyerTokenBalance = await poa.balanceOf(whitelistedBuyerAddress1)
      const preOwnerTokenBalance = await poa.balanceOf(ownerAddress)
      await poa.buy({
        from: whitelistedBuyerAddress1,
        value: buyAmount
      })
      const postBuyerTokenBalance = await poa.balanceOf(
        whitelistedBuyerAddress1
      )
      const postOwnerTokenBalance = await poa.balanceOf(ownerAddress)
      assert.equal(
        postBuyerTokenBalance.minus(preBuyerTokenBalance).toString(),
        buyAmount.toString(),
        'the buyer balance should be incremented by the buy buyAmount'
      )
      assert.equal(
        preOwnerTokenBalance.minus(postOwnerTokenBalance).toString(),
        buyAmount.toString(),
        'the owner balance should be decremented by the buy buyAmount'
      )
      const stage = await poa.stage()
      assert.equal(
        stage,
        stages.pending,
        'the contract should be in Pending stage'
      )
    })
  })
})

describe('when in Pending stage', () => {
  contract('PoaToken', accounts => {
    const ownerAddress = accounts[0]
    const bonusAddress = accounts[1]
    const brokerAddress = accounts[2]
    const custodianAddress = accounts[3]
    const whitelistedBuyerAddress = accounts[4]
    const icoContributors = accounts.slice(5)
    const initialSupply = new BigNumber(1e18)
    const actRate = new BigNumber(1000)
    const bbkDistAmount = new BigNumber(1e18)
    let poa

    before('setup contract pending state', async () => {
      const { reg } = await setupContracts(
        ownerAddress,
        bonusAddress,
        icoContributors,
        bbkDistAmount,
        actRate,
        [whitelistedBuyerAddress]
      )
      poa = await PoaToken.new(
        'TestToken',
        'TST',
        brokerAddress,
        custodianAddress,
        reg.address,
        100,
        initialSupply
      )

      await poa.buy({
        from: whitelistedBuyerAddress,
        value: initialSupply
      })
    })

    it('should be in Pending stage', async () => {
      const stage = await poa.stage()
      assert.equal(
        stage.toNumber(),
        stages.pending,
        'the contract stage should be Pending'
      )
    })

    it('should NOT allow buying', async () => {
      await testWillThrow(poa.buy, [{ from: whitelistedBuyerAddress }])
    })

    it('should NOT enter Active stage if not custodian', async () => {
      await testWillThrow(poa.activate, [{ from: whitelistedBuyerAddress }])
    })

    it('should NOT allow reclaiming', async () => {
      await testWillThrow(poa.reclaim, [{ from: whitelistedBuyerAddress }])
    })

    it('should NOT allow payouts', async () => {
      await testWillThrow(poa.payout, [{ from: brokerAddress }])
    })

    it('should NOT allow claiming', async () => {
      await testWillThrow(poa.claim, [{ from: whitelistedBuyerAddress }])
    })

    it('should NOT enter Active stage if not custodian', async () => {
      await testWillThrow(poa.activate, [{ from: whitelistedBuyerAddress }])
    })

    it('should NOT allow reclaiming', async () => {
      await testWillThrow(poa.reclaim, [{ from: whitelistedBuyerAddress }])
    })

    it('should NOT allow payouts', async () => {
      await testWillThrow(poa.payout, [{ from: brokerAddress }])
    })

    it('should NOT allow claiming', async () => {
      await testWillThrow(poa.claim, [{ from: whitelistedBuyerAddress }])
    })

    it('should enter Active stage if custodian', async () => {
      await poa.activate({
        from: custodianAddress
      })
      const stage = await poa.stage()
      assert.equal(
        stage.toNumber(),
        stages.active,
        'the contract stage should be Active'
      )
    })
  })
})

describe('when in Active stage', () => {
  contract('PoaToken', accounts => {
    const ownerAddress = accounts[0]
    const bonusAddress = accounts[1]
    const brokerAddress = accounts[2]
    const custodianAddress = accounts[3]
    const whitelistedBuyerAddress1 = accounts[4]
    const whitelistedBuyerAddress2 = accounts[5]
    const icoContributors = accounts.slice(6)
    const totalSupply = new BigNumber(1e18)
    const payoutAmount = new BigNumber(5e17)
    const actRate = new BigNumber(1000)
    const bbkDistAmount = new BigNumber(1e18)
    let poa

    before('setup contracts state', async () => {
      const { reg } = await setupContracts(
        ownerAddress,
        bonusAddress,
        icoContributors,
        bbkDistAmount,
        actRate,
        [whitelistedBuyerAddress1, whitelistedBuyerAddress2]
      )
      poa = await PoaToken.new(
        'TestToken',
        'TST',
        brokerAddress,
        custodianAddress,
        reg.address,
        100,
        totalSupply
      )
      await poa.buy({
        from: whitelistedBuyerAddress1,
        value: totalSupply.div(2)
      })

      await poa.buy({
        from: whitelistedBuyerAddress2,
        value: totalSupply.div(2)
      })
      await poa.activate({
        from: custodianAddress
      })
      await lockAllBbk(reg)
    })

    it('should be in Active stage', async () => {
      const stage = await poa.stage()
      assert.equal(
        stage.toNumber(),
        stages.active,
        'the contract stage should be Active'
      )
    })

    it('should calculate fees', async () => {
      const feePercentage = await poa.feePercentage()
      const expectedFee = totalSupply.mul(feePercentage).div(100)
      const calculatedFee = await poa.calculateFee(totalSupply)
      assert(
        calculatedFee.toNumber(),
        expectedFee.toNumber(),
        'the fees should match'
      )
    })

    it('should run payout when broker', async () => {
      const preTotalPayout = await poa.totalPayout()
      const preBrokerEtherBalance = await getEtherBalance(brokerAddress)
      const fee = await poa.calculateFee(payoutAmount)
      await poa.payout({
        from: brokerAddress,
        value: payoutAmount
      })
      const postTotalPayout = await poa.totalPayout()
      const postBrokerEtherBalance = await getEtherBalance(brokerAddress)
      assert(
        postTotalPayout.minus(preTotalPayout).toString(),
        payoutAmount.toString(),
        'totalPayout should be incremented by the ether value of the transaction'
      )
      assert(
        preBrokerEtherBalance.minus(postBrokerEtherBalance).toString(),
        fee.toString(),
        'the broker ether balance should be decremented by the fee value'
      )
    })

    it('should NOT run payout when NOT broker', async () => {
      await testWillThrow(poa.payout, [
        { from: custodianAddress, value: payoutAmount }
      ])
    })

    it('should allow claiming dividends', async () => {
      const preEtherBalance = await getEtherBalance(whitelistedBuyerAddress1)
      const currentPayout = await poa.currentPayout(whitelistedBuyerAddress1)
      await poa.claim({
        from: whitelistedBuyerAddress1
      })
      const postEtherBalance = await getEtherBalance(whitelistedBuyerAddress1)
      assert(
        postEtherBalance.minus(preEtherBalance).toString(),
        currentPayout.toString()
      )
    })

    it('should NOT allow claiming the same payout again', async () => {
      await testWillThrow(poa.claim, [{ from: whitelistedBuyerAddress1 }])
    })

    it('should NOT allow claiming from a non-investor', async () => {
      await testWillThrow(poa.claim, [{ from: brokerAddress }])
    })
  })
})
