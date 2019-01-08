# e2e-tooling info

We are using ganache to easily deploy a blockchain for every `portal` review app, and staging deployment.

When deploying the smart contract ecosystem, we are using the determinstic flag so that the mnemonic is stable over all deployments. This is useful so that you can open MetaMask to a known account set. Specifically:

```js
const accounts = {
  fiatInvestor: web3.eth.accounts[0],
  ethInvestor: web3.eth.accounts[1],
  owner: web3.eth.accounts[2],
  bonus: web3.eth.accounts[3],
  issuer: web3.eth.accounts[4],
  custodian: web3.eth.accounts[5],
  anyone: web3.eth.accounts[9],
}
```

and the mnemonic is `myth like bonus scare over problem client lizard pioneer submit female`
