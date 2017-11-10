//temp function
function createSignedMessage(signer, claimer, amount) {
  const hash = web3.sha3(
    web3._extend.utils.padLeft(
      web3.toHex(amount).slice(2).toString(16), 64, 0
    ) + claimer.slice(2).toString(16), { encoding: 'hex' }
  )
  
  return new Promise((resolve, reject) => {
    web3.eth.sign(signer, hash, (err, res) => {
      if(err) {
        reject(err)
      } else {
        resolve(res)
      }
    })
  })
}