const {
  bbkContributors,
  issuer,
  custodian,
  defaultIpfsHashArray32,
  getRemainingAmountInCentsDuringFiatFunding,
  owner,
  setupPoaProxyAndEcosystem,
  stages,
  testActivate,
  testApprove,
  testBuyTokens,
  testBuyTokensWithFiat,
  testClaim,
  testIncrementOfBalanceWhenBuyTokensWithFiat,
  testPaused,
  testPayout,
  testPercent,
  testReclaim,
  testRemoveTokensWithFiat,
  testManualCheckForTimeout,
  testStartPreFunding,
  testStartEthSale,
  testStartFiatSale,
  testTerminate,
  testTransfer,
  testTransferFrom,
  testUnpause,
  testUpdateProofOfCustody,
  timeTravelToFundingPeriod,
  timeTravelToEthFundingPeriod,
  whitelistedEthInvestors,
  whitelistedFiatInvestor,
} = require('../../helpers/poa')
const { testWillThrow, gasPrice } = require('../../helpers/general.js')

describe("when in 'FiatFunding' stage", () => {
  contract('PoaToken', () => {
    let poa
    let fmr
    let pmr

    before('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa
      fmr = contracts.fmr
      pmr = contracts.pmr

      // move from `Pending` to `PreFunding` stage
      await testStartPreFunding(poa, { from: issuer, gasPrice })

      await timeTravelToFundingPeriod(poa)

      // move from `PreFunding` to `FiatFunding` stage
      await testStartFiatSale(poa, { from: issuer, gasPrice })
    })

    it('should start paused', async () => {
      await testPaused(poa, true)
    })

    it('should NOT unpause, even if owner', async () => {
      await testWillThrow(testUnpause, [
        poa,
        pmr,
        { from: owner },
        { callPoaDirectly: false },
      ])
    })

    it('should NOT manualCheckForTimeout', async () => {
      await testWillThrow(testManualCheckForTimeout, [poa, { from: owner }])
    })

    it('should NOT activate, even if custodian', async () => {
      await testWillThrow(testActivate, [poa, fmr, { from: custodian }])
    })

    it('should NOT terminate, even if custodian', async () => {
      await testWillThrow(testTerminate, [
        poa,
        pmr,
        { from: custodian },
        { callPoaDirectly: true },
      ])
    })

    it('should NOT reclaim, even if owning tokens', async () => {
      await testWillThrow(testReclaim, [
        poa,
        { from: whitelistedEthInvestors[0] },
      ])
    })

    it('should NOT payout, even if issuer', async () => {
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { from: issuer, value: 1e18, gasPrice },
      ])
    })

    it('should NOT claim since there are no payouts', async () => {
      await testWillThrow(testClaim, [
        poa,
        { from: whitelistedEthInvestors[0] },
      ])
    })

    it('should NOT updateProofOfCustody, even if valid and from custodian', async () => {
      await testWillThrow(testUpdateProofOfCustody, [
        poa,
        defaultIpfsHashArray32,
        { from: custodian },
      ])
    })

    it('should NOT transfer', async () => {
      await testWillThrow(testTransfer, [
        poa,
        whitelistedEthInvestors[1],
        1e17,
        {
          from: whitelistedEthInvestors[0],
        },
      ])
    })

    it('should NOT approve', async () => {
      await testWillThrow(testApprove, [
        poa,
        whitelistedEthInvestors[1],
        1e17,
        {
          from: whitelistedEthInvestors[0],
        },
      ])
    })

    it('should NOT transferFrom', async () => {
      // in theory would need approval put here for the sake of demonstrating
      // that approval was attempted as well.
      await testWillThrow(testApprove, [
        poa,
        whitelistedEthInvestors[1],
        1e17,
        {
          from: whitelistedEthInvestors[0],
        },
      ])
      await testWillThrow(testTransferFrom, [
        poa,
        whitelistedEthInvestors[0],
        bbkContributors[0],
        1e17,
        {
          from: whitelistedEthInvestors[1],
        },
      ])
    })

    it('should give correct percentage result', async () => {
      await testPercent({ poa })
    })

    // start core stage functionality

    it('should allow FIAT buying', async () => {
      await testBuyTokensWithFiat(poa, whitelistedFiatInvestor, 100, {
        from: custodian,
        gasPrice,
      })
    })

    it('should NOT allow FIAT buying less than 1 cents', async () => {
      await testWillThrow(testBuyTokensWithFiat, [
        poa,
        whitelistedFiatInvestor,
        0,
        {
          from: custodian,
          gasPrice,
        },
      ])
    })

    it('should increment the token amount if the same investor buys again', async () => {
      const remainingAmountInCents = await getRemainingAmountInCentsDuringFiatFunding(
        poa
      )
      const investmentAmountInCents = remainingAmountInCents
        .div(2)
        .floor()
        .toNumber()

      await testIncrementOfBalanceWhenBuyTokensWithFiat(
        poa,
        whitelistedFiatInvestor,
        investmentAmountInCents
      )
    })

    it('should NOT allow buying more than funding goal in cents', async () => {
      const fundingGoal = await poa.fundingGoalInCents()
      const investmentAmountInCents = fundingGoal.add(1)

      await testWillThrow(testBuyTokensWithFiat, [
        poa,
        whitelistedFiatInvestor,
        investmentAmountInCents,
        {
          from: custodian,
          gasPrice,
        },
      ])
    })

    it('should NOT allow FIAT investors to buy tokens during the ETH sale with the same address they used during the FIAT sale', async () => {
      await testWillThrow(testBuyTokens, [
        poa,
        {
          from: whitelistedFiatInvestor,
          value: 5e17,
          gasPrice,
        },
      ])
    })

    // If this behaviour is changed in the future, this test should fail
    it("should allow FIAT investment during ETH funding period when 'startEthSale' is not called", async () => {
      await timeTravelToEthFundingPeriod(poa)

      await testBuyTokensWithFiat(poa, whitelistedFiatInvestor, 100000, {
        from: custodian,
        gasPrice,
      })
    })

    it("should NOT allow FIAT investment during 'EthFunding' stage", async () => {
      // move from `FiatFunding` to `EthFunding` stage
      await testStartEthSale(poa)

      await testWillThrow(testBuyTokensWithFiat, [
        poa,
        whitelistedFiatInvestor,
        100000,
        {
          from: custodian,
          gasPrice,
        },
      ])
    })
  })
})

describe('when in FIAT Funding (stage 2) and funding goal is met during the fiat funding', () => {
  contract('PoaToken', () => {
    let poa

    beforeEach('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa

      // move from `Pending` to `PreFunding` stage
      await testStartPreFunding(poa, { from: issuer, gasPrice })

      await timeTravelToFundingPeriod(poa)

      // move from `PreFunding` to `FiatFunding` stage
      await testStartFiatSale(poa, { from: issuer, gasPrice })
    })

    it('Should set correct amount of tokens for investor if invested amount equals funding goal', async () => {
      const totalSupply = await poa.totalSupply()
      const investmentAmountInCents = await getRemainingAmountInCentsDuringFiatFunding(
        poa
      )

      await testBuyTokensWithFiat(
        poa,
        whitelistedFiatInvestor,
        investmentAmountInCents,
        {
          from: custodian,
          gasPrice,
        }
      )

      const postStage = await poa.stage()
      const postInvestorBalance = await poa.fundedFiatAmountPerUserInTokens(
        whitelistedFiatInvestor
      )

      assert.equal(
        postInvestorBalance.toString(),
        totalSupply.toString(),
        'Investor balance should be equal to totalSupply.'
      )

      assert.equal(
        postStage.toString(),
        stages.FundingSuccessful,
        "Contract should be in 'FundingSuccessful' stage after funding goal meets"
      )
    })

    it('Should set correct amount of tokens after many investment rounds for investor if invested amount equals funding goal', async () => {
      const totalSupply = await poa.totalSupply()
      const fundingGoalInCents = await poa.fundingGoalInCents()
      const investmentAmountInCentsPerBuy = fundingGoalInCents.div(5)

      for (let index = 0; index < 5; index++) {
        await testIncrementOfBalanceWhenBuyTokensWithFiat(
          poa,
          whitelistedFiatInvestor,
          investmentAmountInCentsPerBuy
        )
      }

      const postInvestorBalance = await poa.fundedFiatAmountPerUserInTokens(
        whitelistedFiatInvestor
      )
      const postStage = await poa.stage()

      assert.equal(
        postInvestorBalance.toString(),
        totalSupply.toString(),
        'Investor balance should be equal to totalSupply.'
      )

      assert.equal(
        postStage.toString(),
        stages.FundingSuccessful,
        "The contract should be in 'FundingSuccessful' stage after funding goal meets"
      )
    })

    it('should remove fiat after adding incorrect amount', async () => {
      const investmentAmountInCents = (await getRemainingAmountInCentsDuringFiatFunding(
        poa
      )).div(2)

      await testBuyTokensWithFiat(
        poa,
        whitelistedFiatInvestor,
        investmentAmountInCents,
        {
          from: custodian,
          gasPrice,
        }
      )

      await testRemoveTokensWithFiat(
        poa,
        whitelistedFiatInvestor,
        investmentAmountInCents,
        {
          from: custodian,
          gasPrice,
        }
      )
    })

    it('should NOT remove fiat more than invested', async () => {
      const investmentAmountInCents = (await getRemainingAmountInCentsDuringFiatFunding(
        poa
      )).div(2)

      await testWillThrow(testRemoveTokensWithFiat, [
        poa,
        whitelistedFiatInvestor,
        investmentAmountInCents,
        {
          from: custodian,
          gasPrice,
        },
      ])
    })

    it('buyWithFiat should be callable by only custodian', async () => {
      const investmentAmountInCents = (await getRemainingAmountInCentsDuringFiatFunding(
        poa
      )).div(5)

      await testBuyTokensWithFiat(
        poa,
        whitelistedFiatInvestor,
        investmentAmountInCents,
        {
          from: custodian,
          gasPrice,
        }
      )

      await testWillThrow(testBuyTokensWithFiat, [
        poa,
        whitelistedFiatInvestor,
        investmentAmountInCents,
        {
          from: whitelistedFiatInvestor,
          gasPrice,
        },
      ])
    })

    it('removeFiat should be callable by only custodian', async () => {
      const investmentAmountInCents = (await getRemainingAmountInCentsDuringFiatFunding(
        poa
      )).div(5)

      await testBuyTokensWithFiat(
        poa,
        whitelistedFiatInvestor,
        investmentAmountInCents,
        {
          from: custodian,
          gasPrice,
        }
      )

      await testRemoveTokensWithFiat(
        poa,
        whitelistedFiatInvestor,
        investmentAmountInCents,
        {
          from: custodian,
          gasPrice,
        }
      )

      await testBuyTokensWithFiat(
        poa,
        whitelistedFiatInvestor,
        investmentAmountInCents,
        {
          from: custodian,
          gasPrice,
        }
      )

      await testWillThrow(testRemoveTokensWithFiat, [
        poa,
        whitelistedFiatInvestor,
        investmentAmountInCents,
        {
          from: whitelistedFiatInvestor,
          gasPrice,
        },
      ])
    })
  })
})
