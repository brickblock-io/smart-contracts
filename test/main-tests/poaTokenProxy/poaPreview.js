const {
  bbkContributors,
  broker,
  custodian,
  defaultIpfsHashArray32,
  owner,
  setupPoaProxyAndEcosystem,
  testActivate,
  testApprove,
  testBuyTokens,
  testClaim,
  testPaused,
  testPayout,
  testReclaim,
  testSetStageToTimedOut,
  testStartPreFunding,
  testStartEthSale,
  testStartFiatSale,
  testTerminate,
  testTransfer,
  testTransferFrom,
  testUnpause,
  testUpdateBrokerAddress,
  testUpdateDurationForActivationPeriod,
  testUpdateDurationForEthFundingPeriod,
  testUpdateFiatCurrency,
  testUpdateFundingGoalInCents,
  testUpdateName,
  testUpdateStartTimeForFundingPeriod,
  testUpdateSymbol,
  testUpdateTotalSupply,
  testUpdateProofOfCustody,
  whitelistedEthInvestors,
} = require('../../helpers/poa')
const { testWillThrow, gasPrice } = require('../../helpers/general.js')

describe("when in 'Preview' stage", async () => {
  contract('PoaTokenProxy', () => {
    let poa
    let fmr
    let pmr

    before('setup contracts', async () => {
      const contracts = await setupPoaProxyAndEcosystem()
      poa = contracts.poa
      fmr = contracts.fmr
      pmr = contracts.pmr
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

    it('should NOT buy, even if whitelisted', async () => {
      await testWillThrow(testBuyTokens, [
        poa,
        { from: whitelistedEthInvestors[0], value: 3e17, gasPrice },
      ])
    })

    it('should NOT setStageToTimedOut', async () => {
      await testWillThrow(testSetStageToTimedOut, [poa, { from: owner }])
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

    it('should NOT reclaim', async () => {
      await testWillThrow(testReclaim, [
        poa,
        { from: whitelistedEthInvestors[0] },
      ])
    })

    it('should NOT payout, even if broker', async () => {
      await testWillThrow(testPayout, [
        poa,
        fmr,
        { from: broker, value: 1e18, gasPrice },
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

    it('should NOT checkFundingSuccessful', async () => {
      await testWillThrow(poa.checkFundingSuccessful, [])
    })

    // test updating name
    it('should NOT update name32 by non-broker', async () => {
      await testWillThrow(testUpdateName, [
        poa,
        'NotAllowedTokenName',
        { from: owner },
      ])
      await testWillThrow(testUpdateName, [
        poa,
        'NotAllowedTokenName',
        { from: custodian },
      ])
      await testWillThrow(testUpdateName, [
        poa,
        'NotAllowedTokenName',
        { from: whitelistedEthInvestors[0] },
      ])
    })

    it('should update name32 by broker', async () => {
      await testUpdateName(poa, 'NewPoaName', { from: broker })
    })

    it('should NOT update symbol32 by non-broker', async () => {
      const newSymbol = 'N-SYM-POA'
      ;[owner, custodian, whitelistedEthInvestors[0]].forEach(
        async fromAddress => {
          await testWillThrow(testUpdateSymbol, [
            poa,
            newSymbol,
            { from: fromAddress },
          ])
        }
      )
    })

    it('should update symbol32 by broker', async () => {
      await testUpdateSymbol(poa, 'N-SYM-POA', { from: broker })
    })

    it('should NOT update broker address by non-broker', async () => {
      const newBroker = whitelistedEthInvestors[0]
      ;[owner, custodian, whitelistedEthInvestors[0]].forEach(
        async fromAddress => {
          await testWillThrow(testUpdateBrokerAddress, [
            poa,
            newBroker,
            { from: fromAddress },
          ])
        }
      )
    })

    it('should update broker address by broker', async () => {
      await testUpdateBrokerAddress(poa, whitelistedEthInvestors[0], {
        from: broker,
      })
      // change it back again so we can continue to use `broker` as broker address
      await testUpdateBrokerAddress(poa, broker, {
        from: whitelistedEthInvestors[0],
      })
    })

    it('should NOT update total supply by non-broker', async () => {
      const anyHighEnoughTotalSupply = 2e18
      ;[owner, custodian, whitelistedEthInvestors[0]].forEach(
        async fromAddress => {
          await testWillThrow(testUpdateTotalSupply, [
            poa,
            anyHighEnoughTotalSupply,
            { from: fromAddress },
          ])
        }
      )
    })

    it('should update total supply by broker', async () => {
      const anyHighEnoughTotalSupply = 2e18
      await testUpdateTotalSupply(poa, anyHighEnoughTotalSupply, {
        from: broker,
      })
    })

    it('should NOT update fiat currency by non-broker', async () => {
      const anyNewFiatCurrency = 'USD'
      ;[owner, custodian, whitelistedEthInvestors[0]].forEach(
        async fromAddress => {
          await testWillThrow(testUpdateFiatCurrency, [
            poa,
            anyNewFiatCurrency,
            { from: fromAddress },
          ])
        }
      )
    })

    it('should update fiat currency by broker', async () => {
      const anyNewFiatCurrency = 'USD'
      await testUpdateFiatCurrency(poa, anyNewFiatCurrency, { from: broker })
    })

    it('should NOT update fiat currency with uninitialized rate', async () => {
      const uninitializedFiatCurrency = 'XYZ'
      ;[owner, custodian, whitelistedEthInvestors[0]].forEach(
        async fromAddress => {
          await testWillThrow(testUpdateFiatCurrency, [
            poa,
            uninitializedFiatCurrency,
            { from: fromAddress },
          ])
        }
      )
    })

    it('should NOT update funding goal in cents by non-broker', async () => {
      const newFundingGoalInCents = 2e9
      ;[owner, custodian, whitelistedEthInvestors[0]].forEach(
        async fromAddress => {
          await testWillThrow(testUpdateFundingGoalInCents, [
            poa,
            newFundingGoalInCents,
            { from: fromAddress },
          ])
        }
      )
    })

    it('should update funding goal in cents by broker', async () => {
      const newFundingGoalInCents = 2e9
      await testUpdateFundingGoalInCents(poa, newFundingGoalInCents, {
        from: broker,
      })
    })

    it('should NOT update start time of funding period by non-broker', async () => {
      const timestampHundredYearsInFuture = (
        Math.round(new Date().getTime() / 1000) +
        3600 * 24 * 365 * 100
      ).toString()
      ;[owner, custodian, whitelistedEthInvestors[0]].forEach(
        async fromAddress => {
          await testWillThrow(testUpdateStartTimeForFundingPeriod, [
            poa,
            timestampHundredYearsInFuture,
            { from: fromAddress },
          ])
        }
      )
    })

    it('should update start time of funding period by broker', async () => {
      const timestampHundredYearsInFuture = (
        Math.round(new Date().getTime() / 1000) +
        3600 * 24 * 365 * 100
      ).toString()

      await testUpdateStartTimeForFundingPeriod(
        poa,
        timestampHundredYearsInFuture,
        { from: broker }
      )
    })

    it('should NOT update duration of ETH funding period by non-broker', async () => {
      const durationOfFiveDays = '432000'
      ;[owner, custodian, whitelistedEthInvestors[0]].forEach(
        async fromAddress => {
          await testWillThrow(testUpdateDurationForEthFundingPeriod, [
            poa,
            durationOfFiveDays,
            { from: fromAddress },
          ])
        }
      )
    })

    it('should update duration of ETH funding period by broker', async () => {
      const durationOfFiveDays = '432000'
      await testUpdateDurationForEthFundingPeriod(poa, durationOfFiveDays, {
        from: broker,
      })
    })

    it('should NOT update duration of activation period by non-broker', async () => {
      const durationOfFiveWeeks = '3024000'
      ;[owner, custodian, whitelistedEthInvestors[0]].forEach(
        async fromAddress => {
          await testWillThrow(testUpdateDurationForActivationPeriod, [
            poa,
            durationOfFiveWeeks,
            { from: fromAddress },
          ])
        }
      )
    })

    it('should update duration of activation period by broker', async () => {
      const durationOfFiveWeeks = '3024000'
      await testUpdateDurationForActivationPeriod(poa, durationOfFiveWeeks, {
        from: broker,
      })
    })

    it('should NOT startFiatSale, even if owner', async () => {
      await testWillThrow(testStartFiatSale, [poa, { from: owner, gasPrice }])
    })

    it('should NOT move to funding before startTimeForEthFundingPeriod, EVEN if owner', async () => {
      await testWillThrow(testStartEthSale, [poa, { from: owner }])
    })

    it('should NOT move to "PreFunding" stage if not broker', async () => {
      // eslint-disable-next-line prettier/prettier
      ;[owner, custodian, whitelistedEthInvestors[0]].forEach(
        async fromAddress => {
          await testWillThrow(testStartPreFunding, [
            poa,
            { from: fromAddress, gasPrice },
          ])
        }
      )
    })

    it('should move to "PreFunding" stage if broker', async () => {
      await testStartPreFunding(poa, { from: broker, gasPrice })
    })
  })
})
