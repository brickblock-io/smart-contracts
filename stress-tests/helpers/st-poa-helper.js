const { getExpectedTokenAmount } = require('../../test/helpers/poa')

class InvestmentRegistry {
  constructor() {
    this.investors = {}
  }

  async add(poaToken, address, amountInCents) {
    const investor = this.investors[address]
    const tokens = await getExpectedTokenAmount(poaToken, amountInCents)
    if (investor) {
      investor.amountInCents = investor.amountInCents.plus(amountInCents)
      investor.tokens = investor.tokens.plus(tokens)
    } else {
      this.investors[address] = {
        amountInCents,
        tokens
      }
    }
  }

  list() {
    return this.investors
  }

  get length() {
    return Object.keys(this.investors).length
  }

  getInvestorAddresses() {
    return Object.keys(this.investors)
  }
}

module.exports = {
  InvestmentRegistry
}
