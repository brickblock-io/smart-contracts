# POA Token sale steps

## 1. [Brickblock] Add issuer address to `PoaManager`

- Check if issuer exist by calling:
  ```
  poaManager.isRegisteredIssuer(address issuer)
  ```
- If the result is false, add issuer to the `PoaManager`
  ```
  poaManager.addIssuer(address issuer)
  ```

## 2. [Issuer] Deploy Poa Token:

### 2.1 Issuer:

    - Deploy POA token by calling:
      ```
      poaManager.addNewToken(
        bytes32 _name32, // Token name
        bytes32 _symbol32, // Token symbol
        bytes32 _fiatCurrency32, // Fiat currency
        address _custodian, // custodian address
        uint256 _totalSupply,
        uint256 _startTimeForEthFundingPeriod,
        uint256 _durationForEthFundingPeriod,
        uint256 _durationForActivationPeriod,
        uint256 _fundingGoalInCents
      )
      ```

### 2.2 Brickblock:

    - List PoaToken on Poa Manager
    ```
    poaManager.listToken(address _tokenAddress)
    ```

Depending on the sale, issuer should start `Fiat funding` or `Eth Funding` period

## 3. [Issuer] Fiat Funding Period

- To start `Fiat Funding`, -only- issuer must call:

```
poatoken.startFiatSale()
```

- He/she is responsible for adding correct investors with investment amounts by calling:

```
poatoken.buyFiat
(
  address _contributor, // Investor address
  uint256 _amountInCents // Investment amount in cents. Ex. for 1000 Eur the amount should be 100000
)
```

- If issuer makes a mistake it can be reverted by calling:

```
function removeFiat
(
  address _contributor,
  uint256 _amountInCents
)
```

- If funding goal is met at this stage, contract automatically switches to `FundingSuccessful` stage.
- In `Fiat Funding` stage, issuer can always cancel the contract in case something goes wrong.

```
poatoken.cancelFunding()
```

## 4. [Issuer] Eth Funding Period

- To start `Eth Funding`, anyone -including issuer- can call:

```
poatoken.startEthSale()
```

Please remember, it only starts if the block time is greater than `_startTimeForEthFundingPeriod` mentioned above. Otherwise transaction fails.

- If funding goal is met at this stage, contract automatically switches to `FundingSuccessful` stage.

## 5. Funding Succesful Stage

- Issuer should check the fee amount required to activate the contract:

```
poatoken.calculateTotalFee()
```

### 5.1 Execute required functions before activation:

- `poatoken.payActivationFee()` should be called by any of `Issuer`, `Custodian` or `Brickblock`. If you are wondering why we made this function public to everyone, please see the explanation for this function in `PoaCrowdsale.sol` contract.
- Custodian should update proof of custody (Hash of legal papers uploaded to IPFS) by calling:

```
poatoken.updateProofOfCustody(bytes32[2] _ipfsHash)
```

- Note: The order for `payActivationFee` and `updateProofOfCustody` does not matter.

### 5.2 Activation

- Custodian must activate contract after activation fee paid and proof of custody updated before activation period ends, by calling:

```
poatoken.activate()
```

## 6. Active Stage

- Issuer can claim Eth, which was funded during `Eth Funding` period, by calling:

```
poatoken.claim()
```
