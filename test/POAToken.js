const POAToken = artifacts.require('POAToken')
require('chai').should()

const toDecimalFromWei = bn => {
  return web3.toDecimal(web3.fromWei(bn, 'ether'))
}

const sleep = async time =>
  await new Promise(resolve => {
    setTimeout(resolve, time)
  })

const defaults = {
  name: 'Test Token',
  symbol: 'TST',
  owner: 0,
  broker: 1,
  user: 2,
  user2: 3,
  custodian: 4, // account index of the custodian
  timeout: 10,
  totalSupply: 10
}

const stages = {
  funding: 0,
  pending: 1,
  failed: 2,
  active: 3
}

function createSignature(symbol, amount, custodian) {
  amount = web3.toAscii(web3.toHex(web3.toWei(amount)))
  while (amount.length < 32) amount = '\x00' + amount
  const hash = web3.sha3(web3.toHex(symbol + amount), { encoding: 'hex' })
  const signature = web3.eth.sign(custodian, hash)
  const r = signature.slice(0, 66)
  const s = '0x' + signature.slice(66, 130)
  let v = '0x' + signature.slice(130, 132)
  v = web3.toDecimal(v) + 27
  return [r, s, v]
}

async function newToken() {
  return await POAToken.new(
    defaults.name,
    defaults.symbol,
    web3.eth.accounts[defaults.broker],
    web3.eth.accounts[defaults.custodian],
    defaults.timeout,
    web3.toWei(defaults.totalSupply)
  )
}

async function pendingToken() {
  const token = await newToken()
  await token.buy.sendTransaction({
    from: web3.eth.accounts[defaults.user],
    value: web3.toWei(defaults.totalSupply)
  })
  return token
}

async function activeToken() {
  const token = await pendingToken()
  const [r, s, v] = createSignature(
    defaults.symbol,
    defaults.totalSupply,
    web3.eth.accounts[defaults.custodian]
  )
  await token.activate(v, r, s)
  return token
}

contract('POAToken', accounts => {
  it('should create token', async () => {
    const token = await newToken()
    token.contract.name().should.eql(defaults.name)
    token.contract.symbol().should.eql(defaults.symbol)
    token.contract.broker().should.eql(accounts[defaults.broker])
    token.contract.custodian().should.eql(accounts[defaults.custodian])
    toDecimalFromWei(token.contract.totalSupply()).should.eql(
      defaults.totalSupply
    )
    const stage = await token.stage()
    web3.toDecimal(stage).should.eql(stages.funding)
  })

  it('should time out', async () => {
    const token = await POAToken.new(
      defaults.name,
      defaults.symbol,
      accounts[defaults.broker],
      accounts[defaults.custodian],
      0,
      web3.toWei(defaults.totalSupply)
    )
    token.buy
      .sendTransaction({ from: accounts[defaults.user], value: web3.toWei(5) })
      .then(() => assert(false, 'Expected error'))
      .catch(e => e.should.match(/invalid opcode/))
  })

  it('should buy tokens', async () => {
    const token = await newToken()
    await token.buy.sendTransaction({
      from: accounts[defaults.user],
      value: web3.toWei(5)
    })
    const balance = await token.balanceOf(accounts[defaults.user])
    toDecimalFromWei(balance).should.eql(5)
  })

  it('should not buy if owner balance is insufficient', async () => {
    const token = await newToken()
    await token.buy.sendTransaction({
      from: accounts[defaults.user],
      value: web3.toWei(5)
    })
    token.buy
      .sendTransaction({ from: accounts[defaults.user], value: web3.toWei(6) })
      .then(() => assert(false, 'Expected to throw'))
      .catch(e => e.should.match(/invalid opcode/))
  })

  it('should change to funding stage when all tokens are sold', async () => {
    const token = await newToken()
    await token.buy.sendTransaction({
      from: accounts[defaults.user],
      value: web3.toWei(10)
    })
    const stage = await token.stage()
    web3.toDecimal(stage).should.eql(stages.pending)
  })

  it('should activate contract with valid signature', async () => {
    const token = await pendingToken(accounts)
    const [r, s, v] = createSignature(
      defaults.symbol,
      defaults.totalSupply,
      accounts[defaults.custodian]
    )
    const res = await token.activate(v, r, s)
    web3.toDecimal(res.logs[0].args.stage).should.eql(stages.active)
    const balance = await web3.eth.getBalance(token.address)
    toDecimalFromWei(balance).should.eql(0)
  })

  it('should reclaim funds', async () => {
    const token = await POAToken.new(
      defaults.name,
      defaults.symbol,
      accounts[defaults.broker],
      accounts[defaults.custodian],
      1,
      web3.toWei(defaults.totalSupply)
    )
    await token.buy.sendTransaction({
      from: accounts[defaults.user],
      value: web3.toWei(5)
    })

    await sleep(1500)

    const balance = await web3.eth.getBalance(accounts[defaults.user])
    await token.reclaim.sendTransaction({ from: accounts[defaults.user] })
    web3.toDecimal(token.contract.stage()).should.eql(stages.failed)
    const balance2 = await web3.eth.getBalance(accounts[defaults.user])
    const diff = toDecimalFromWei(balance2 - balance)
    assert(diff > 4.9 && diff < 5)
    const balance3 = await token.balanceOf(accounts[defaults.user])
    toDecimalFromWei(balance3).should.eql(0)
  })

  it('should sell tokens', async () => {
    const token = await activeToken()
    await token.sell.sendTransaction(web3.toWei(5), {
      from: accounts[defaults.user]
    })
    const tokens = await token.balanceOf(accounts[defaults.user])
    toDecimalFromWei(tokens).should.eql(5)
    const balance = await web3.eth.getBalance(accounts[defaults.user])
    await token.liquidated.sendTransaction(accounts[defaults.user], {
      from: accounts[defaults.broker],
      value: web3.toWei(5)
    })
    const balance2 = await web3.eth.getBalance(accounts[defaults.user])
    const diff = toDecimalFromWei(balance2 - balance)
    assert(diff === 5)
  })

  it('should claim dividend payout', async () => {
    // get active token with total supply: 10, user balance: 5
    const token = await activeToken()
    await token.sell.sendTransaction(web3.toWei(5), {
      from: accounts[defaults.user]
    })
    const balance = web3.eth.getBalance(accounts[defaults.user])

    // broker sends 1 ETH payout
    await token.payout.sendTransaction({
      from: accounts[defaults.broker],
      value: web3.toWei(1)
    })

    // user claims payout
    await token.claim.sendTransaction({ from: accounts[defaults.user] })

    // user received 0.5 ETH
    const balance2 = await web3.eth.getBalance(accounts[defaults.user])
    const diff = toDecimalFromWei(balance2 - balance)
    assert(diff > 0.4 && diff < 0.5)

    // user transfers 5 tokens
    await token.transfer.sendTransaction(
      accounts[defaults.user2],
      web3.toWei(5),
      { from: accounts[defaults.user] }
    )

    // other user cannot claim payout again
    const balance3 = await web3.eth.getBalance(accounts[defaults.user2])
    token.claim
      .sendTransaction({ from: accounts[defaults.custodian] })
      .then(() => assert(false, 'Expected error'))
      .catch(e => e.should.match(/invalid opcode/))
    const balance4 = await web3.eth.getBalance(accounts[defaults.user2])
    const diff2 = toDecimalFromWei(balance4 - balance3)
    diff2.should.eql(0)
  })

  it('should transfer claimed payouts', async () => {
    const token = await activeToken()

    // user1 sends 5 tokens to user2
    await token.transfer.sendTransaction(
      accounts[defaults.user2],
      web3.toWei(5),
      { from: accounts[defaults.user] }
    )

    // broker sends 1 ETH payout
    await token.payout.sendTransaction({
      from: accounts[defaults.broker],
      value: web3.toWei(1)
    })

    // user1 can claim 0.5 ETH
    const balance = await web3.eth.getBalance(accounts[defaults.user])
    await token.claim.sendTransaction({ from: accounts[defaults.user] })
    const balance2 = web3.eth.getBalance(accounts[defaults.user])
    const diff = toDecimalFromWei(balance2 - balance)
    assert(diff > 0.4 && diff < 0.5)

    // user2 can claim 0.5 ETH
    const balance3 = await web3.eth.getBalance(accounts[defaults.user2])
    await token.claim.sendTransaction({ from: accounts[defaults.user2] })
    const balance4 = await web3.eth.getBalance(accounts[defaults.user2])
    const diff2 = toDecimalFromWei(balance4 - balance3)
    assert(diff2 > 0.4 && diff2 < 0.5)
  })

  it('should claim multiple payouts one by one', async () => {
    const token = await activeToken()
    const balance = await web3.eth.getBalance(accounts[defaults.user])

    // broker sends 1 ETH payout
    await token.payout.sendTransaction({
      from: accounts[defaults.broker],
      value: web3.toWei(1)
    })

    // user can claim 1 ETH
    await token.claim.sendTransaction({ from: accounts[defaults.user] })
    const balance2 = await web3.eth.getBalance(accounts[defaults.user])
    const diff = toDecimalFromWei(balance2 - balance)
    assert(diff > 0.9 && diff < 1.0)
    const balance3 = await web3.eth.getBalance(accounts[defaults.user])

    // broker sends 2 ETH payout
    await token.payout.sendTransaction({
      from: accounts[defaults.broker],
      value: web3.toWei(2)
    })

    // user can claim 2 ETH
    await token.claim.sendTransaction({ from: accounts[defaults.user] })

    const balance4 = await web3.eth.getBalance(accounts[defaults.user])
    const diff2 = toDecimalFromWei(balance4 - balance3)
    assert(diff2 > 1.9 && diff2 < 2.0)
  })

  it('should claim multiple payouts at once', async () => {
    // get active token with total supply: 10: user balance: 10
    const token = await activeToken()
    const balance = await web3.eth.getBalance(accounts[defaults.user])

    // broker sends 1 ETH payout
    await token.payout.sendTransaction({
      from: accounts[defaults.broker],
      value: web3.toWei(1)
    })

    // broker sends 2 ETH payout
    await token.payout.sendTransaction({
      from: accounts[defaults.broker],
      value: web3.toWei(2)
    })

    // user can claim 3 ETH
    await token.claim.sendTransaction({ from: accounts[defaults.user] })

    const balance2 = await web3.eth.getBalance(accounts[defaults.user])
    const diff = toDecimalFromWei(balance2 - balance)
    assert(diff > 2.9 && diff < 3.0)
  })

  it('should claim payouts before and after transfer', async () => {
    // get active token with total supply: 10: user balance: 10
    const token = await activeToken()
    const balance = await web3.eth.getBalance(accounts[defaults.user])

    // broker sends 1 ETH payout
    await token.payout.sendTransaction({
      from: accounts[defaults.broker],
      value: web3.toWei(1)
    })

    // user1 can claim 1 ETH
    await token.claim.sendTransaction({ from: accounts[defaults.user] })

    const balance2 = await web3.eth.getBalance(accounts[defaults.user])
    const diff = toDecimalFromWei(balance2 - balance)
    assert(diff > 0.9 && diff < 1.0)

    // user1 transfers tokens to user2
    await token.transfer.sendTransaction(
      accounts[defaults.user2],
      web3.toWei(10),
      { from: accounts[defaults.user] }
    )

    const balance3 = await web3.eth.getBalance(accounts[defaults.user2])

    // broker sends 2 ETH payout
    await token.payout.sendTransaction({
      from: accounts[defaults.broker],
      value: web3.toWei(2)
    })

    // user2 can claim 2 ETH
    await token.claim.sendTransaction({ from: accounts[defaults.user2] })

    const balance4 = await web3.eth.getBalance(accounts[defaults.user2])
    const diff2 = toDecimalFromWei(balance4 - balance3)
    assert(diff2 > 1.9 && diff2 < 2.0)

    // TODO check user1 can't claim again
  })

  it('should handle changing totalSupply', async () => {
    // get active token with total supply: 10: user balance: 10
    const token = await activeToken()
    const balance = await web3.eth.getBalance(accounts[defaults.user])

    // broker sends 1 ETH payout (1 ETH for user)
    await token.payout.sendTransaction({
      from: accounts[defaults.broker],
      value: web3.toWei(1)
    })

    // totalSupply changes to 20
    await token.debugSetSupply(web3.toWei(20))

    // broker sends 2 ETH payout (1 ETH for user)
    await token.payout.sendTransaction({
      from: accounts[defaults.broker],
      value: web3.toWei(2)
    })

    // user can claim 2 ETH
    await token.claim.sendTransaction({ from: accounts[defaults.user] })
    const balance2 = await web3.eth.getBalance(accounts[defaults.user])
    const diff = toDecimalFromWei(balance2 - balance)
    assert(diff > 1.9 && diff < 2.0)
  })

  it('should handle changing totalSupply with transfers', async () => {
    // get active token with total supply: 10: user balance: 10
    const token = await activeToken()
    // broker sends 1 ETH payout (1 ETH for user)
    await token.payout.sendTransaction({
      from: accounts[defaults.broker],
      value: web3.toWei(1)
    })

    // user1 should get paid out when transferring tokens
    const balance = await web3.eth.getBalance(accounts[defaults.user])
    await token.transfer.sendTransaction(
      accounts[defaults.user2],
      web3.toWei(10),
      { from: accounts[defaults.user] }
    )
    const balance2 = await web3.eth.getBalance(accounts[defaults.user])
    const diff = toDecimalFromWei(balance2 - balance)
    assert(diff > 0.9 && diff < 1.0)

    // totalSupply changes to 20
    await token.debugSetSupply(web3.toWei(20))

    // broker sends 2 ETH payout (1 ETH for user2)
    await token.payout.sendTransaction({
      from: accounts[defaults.broker],
      value: web3.toWei(2)
    })

    // user1 should not be able to claim anything
    const balance3 = await web3.eth.getBalance(accounts[defaults.user])
    token.claim
      .sendTransaction({ from: accounts[defaults.user] })
      .then(() => assert(false, 'Expected error'))
      .catch(e => e.should.match(/invalid opcode/))
    const balance4 = await web3.eth.getBalance(accounts[defaults.user])
    const diff2 = toDecimalFromWei(balance4 - balance3)
    assert(diff2 == 0)

    // user2 can claim 1 ETH
    const balance5 = await web3.eth.getBalance(accounts[defaults.user2])
    await token.claim.sendTransaction({ from: accounts[defaults.user2] })
    const balance6 = await web3.eth.getBalance(accounts[defaults.user2])
    const diff3 = toDecimalFromWei(balance6 - balance5)
    assert(diff3 > 0.9 && diff3 < 1.0)
  })
})
