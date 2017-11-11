var BBT = artifacts.require("./BrickblockToken.sol")
var BBF = artifacts.require("./BrickblockFountain.sol")
var BigNumber = require('bignumber.js')
var padLeft = web3._extend.utils.padLeft

async function createSignedMessage(signer, claimer, amount) {
  const hash =
        web3.sha3(
          padLeft( amount.toString(16), 64, 0)
            + claimer.replace(/^0x/, ''),
          {encoding: 'hex'})
  const signature = await web3.eth.sign(signer, hash)
  return signature
}

function mint(accounts, ammount) {
  const owner = web3.eth.accounts[0]

  return Promise.all(accounts.map( async (account) => {
    const signature = await createSignedMessage(owner, account, ammount)
    return bbt.claimTokens.sendTransaction(signature, ammount, {
        from: account
    })
  }))
}

contract('BrickblockFountain', accounts => {
  const owner = accounts[0]
        
  before(async () => {
    bbt = await BBT.deployed()
    bbf = await BBF.deployed()
    await mint(accounts.slice(1,5), 1000e18)
    await bbt.finalizeTokenSale()
    await bbt.unpause()
    return
  })

  describe('setup', () => {

    it('should mint some users with BBT', async () => {
      for(let i = 1; i < 5; i+=1) {
        const balance = await bbt.balanceOf(accounts[i])
        assert(balance == 1000e18, `${accounts[i]} did not get tokens`)
      }
    })
    
    it('should activate BBT', async () => {
      assert(!await bbt.tokenSaleActive(), 'BBT is not finalized')
      assert(!await bbt.paused(), 'BBT is paused')
    })

  })

  describe('token flow', () => {
    it('BBTs can be locked into the fountain', async () => {
      const user = accounts[1]
      const fountain = bbf.address

      const startBalance = await bbt.balanceOf(user)

      await bbt.approve(fountain, 10e18, {from: user})

      assert(await bbt.allowance(user, fountain) == 10e18,
             "fountain's allowance not set right" )
      await bbf.lockTokens({from: user})
      assert(startBalance-10e18 == await bbt.balanceOf(user),
             'BBT did not transfer the tokens')
      assert(await bbf.balanceOf(user) == 10e18,
             'BBF did not save the balance')
    })

    it('BBTs can be freed from the fountain', async () => {
      const user = accounts[1]
      const fountain = bbf.address

      const startBalance = await bbt.balanceOf(user)
      await bbf.claimTokens({from: user})

      assert(startBalance.add(10e18).cmp(await bbt.balanceOf(user)) == 0, 'BBTs are not freed')
    })
  })
  
})
