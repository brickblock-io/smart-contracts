const {
  owner,
  custodian,
  bbkContributors,
  whitelistedPoaBuyers,
  defaultIpfsHashArray32,
  setupPoaProxyAndEcosystem,
  testStartSale,
  testStartPreSale,
  testBuyTokens,
  testBuyTokensWithFiat,
  testIncrementOfBalanceWhenBuyTokensWithFiat,
  determineNeededTimeTravel,
  testActivate,
  testPayout,
  testClaim,
  testReclaim,
  testSetFailed,
  testPaused,
  testUnpause,
  testUpdateProofOfCustody,
  testTransfer,
  testApprove,
  testTransferFrom,
  testTerminate,
  testPercent,
  getRemainingAmountInCents,
  stages
} = require('../../helpers/poa')
const {
  testWillThrow,
  timeTravel,
  gasPrice
} = require('../../helpers/general.js')

describe('when in FIAT Funding (stage 1)', () => {
  contract('PoaToken', accounts => {
    let poa
    let fmr
    const fiatInvestor = accounts[3]

    before('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa
      fmr = contracts.fmr
      const neededTime = await determineNeededTimeTravel(poa)
      await timeTravel(neededTime)
      await testStartPreSale(poa)
    })

    it('should start paused', async () => {
      await testPaused(poa, true)
    })

    it('should NOT unpause, even if owner', async () => {
      await testWillThrow(testUnpause, [poa, { from: owner }])
    })

    it('should NOT startPreSale, even if owner', async () => {
      await testWillThrow(testStartPreSale, [poa, { from: owner }])
    })

    it('should NOT setFailed', async () => {
      await testWillThrow(testSetFailed, [poa, { from: owner }])
    })

    it('should NOT activate, even if custodian', async () => {
      await testWillThrow(testActivate, [
        poa,
        fmr,
        defaultIpfsHashArray32,
        { from: custodian }
      ])
    })

    it('should NOT terminate, even if custodian', async () => {
      await testWillThrow(testTerminate, [poa, { from: custodian }])
    })

    it('should NOT reclaim, even if owning tokens', async () => {
      await testWillThrow(testReclaim, [poa, { from: whitelistedPoaBuyers[0] }])
    })

    it('should NOT payout, even if custodian', async () => {
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { from: custodian, value: 1e18, gasPrice }
      ])
    })

    it('should NOT claim since there are no payouts', async () => {
      await testWillThrow(testClaim, [poa, { from: whitelistedPoaBuyers[0] }])
    })

    it('should NOT updateProofOfCustody, even if valid and from custodian', async () => {
      await testWillThrow(testUpdateProofOfCustody, [
        poa,
        defaultIpfsHashArray32,
        { from: custodian }
      ])
    })

    it('should NOT transfer', async () => {
      await testWillThrow(testTransfer, [
        poa,
        whitelistedPoaBuyers[1],
        1e17,
        {
          from: whitelistedPoaBuyers[0]
        }
      ])
    })

    it('should NOT approve', async () => {
      await testWillThrow(testApprove, [
        poa,
        whitelistedPoaBuyers[1],
        1e17,
        {
          from: whitelistedPoaBuyers[0]
        }
      ])
    })

    it('should NOT transferFrom', async () => {
      // in theory would need approval put here for the sake of demonstrating
      // that approval was attempted as well.
      await testWillThrow(testApprove, [
        poa,
        whitelistedPoaBuyers[1],
        1e17,
        {
          from: whitelistedPoaBuyers[0]
        }
      ])
      await testWillThrow(testTransferFrom, [
        poa,
        whitelistedPoaBuyers[0],
        bbkContributors[0],
        1e17,
        {
          from: whitelistedPoaBuyers[1]
        }
      ])
    })

    it('should give correct percentage result', async () => {
      await testPercent({ poa })
    })

    // start core stage functionality

    it('should allow FIAT buying', async () => {
      await testBuyTokensWithFiat(poa, fiatInvestor, 100, {
        from: custodian,
        gasPrice
      })
    })

    it('should NOT allow FIAT buying less than 100 cents', async () => {
      await testWillThrow(testBuyTokensWithFiat, [
        poa,
        fiatInvestor,
        99,
        {
          from: custodian,
          gasPrice
        }
      ])
    })

    it('should increment the token amount if the same investor buys again', async () => {
      const remainingAmountInCents = await getRemainingAmountInCents(poa)
      const investmentAmountInCents = remainingAmountInCents
        .div(2)
        .floor()
        .toNumber()

      await testIncrementOfBalanceWhenBuyTokensWithFiat(
        poa,
        fiatInvestor,
        investmentAmountInCents
      )
    })

    it('should NOT allow buying more than funding goal in cents', async () => {
      const fundingGoal = await poa.fundingGoalInCents()
      const investmentAmountInCents = fundingGoal.add(1)

      await testWillThrow(testBuyTokensWithFiat, [
        poa,
        fiatInvestor,
        investmentAmountInCents,
        {
          from: custodian,
          gasPrice
        }
      ])
    })

    it('should NOT allow FIAT investors to buy tokens during the ETH sale with the same address they used during the FIAT sale', async () => {
      await testWillThrow(testBuyTokens, [
        poa,
        {
          from: fiatInvestor,
          value: 5e17,
          gasPrice
        }
      ])
    })

    it('should NOT allow FIAT investment during the ETH sale', async () => {
      await testStartSale(poa)

      await testWillThrow(testBuyTokensWithFiat, [
        poa,
        fiatInvestor,
        100000,
        {
          from: custodian,
          gasPrice
        }
      ])
    })
  })
})

describe('when in FIAT Funding (stage 1) and funding goal is met during the fiat funding', () => {
  contract('PoaToken', accounts => {
    let poa
    const fiatInvestor = accounts[3]

    beforeEach('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa
      const neededTime = await determineNeededTimeTravel(poa)
      await timeTravel(neededTime)
      await testStartPreSale(poa)
    })

    it('Should set correct amount of tokens for investor if invested amount equals funding goal', async () => {
      const totalSupply = await poa.totalSupply()
      const investmentAmountInCents = await getRemainingAmountInCents(poa)

      await testBuyTokensWithFiat(poa, fiatInvestor, investmentAmountInCents, {
        from: custodian,
        gasPrice
      })

      const postStage = await poa.stage()
      const postInvestorBalance = await poa.fiatInvestmentPerUserInTokens(
        fiatInvestor
      )

      assert.equal(
        postInvestorBalance.toString(),
        totalSupply.toString(),
        'Investor balance should be equal to totalSupply.'
      )

      assert.equal(
        postStage.toString(),
        stages.Pending,
        'Contract should be in Pending stage after funding goal meets'
      )
    })

    it('Should set correct amount of tokens after many investment rounds for investor if invested amount equals funding goal', async () => {
      const totalSupply = await poa.totalSupply()
      const fundingGoalInCents = await poa.fundingGoalInCents()
      const investmentAmountInCentsPerBuy = fundingGoalInCents.div(5)

      for (let index = 0; index < 5; index++) {
        await testIncrementOfBalanceWhenBuyTokensWithFiat(
          poa,
          fiatInvestor,
          investmentAmountInCentsPerBuy
        )
      }

      const postInvestorBalance = await poa.fiatInvestmentPerUserInTokens(
        fiatInvestor
      )
      const postStage = await poa.stage()

      assert.equal(
        postInvestorBalance.toString(),
        totalSupply.toString(),
        'Investor balance should be equal to totalSupply.'
      )

      assert.equal(
        postStage.toString(),
        stages.Pending,
        'The contract should be in Pending stage after funding goal meets'
      )
    })
  })
})
