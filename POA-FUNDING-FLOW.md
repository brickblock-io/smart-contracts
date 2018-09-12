# POA Token sale steps
## 1- [Brickblock] Add broker address to `PoaManager`
  - Check if broker exist by calling:
    ```
    poaManager.isBrokerExist(address broker)
    ```
  - If the result is false, add broker to the `PoaManager`
    ```
    poaManager.addBroker(address broker)
    ```

## 2- [Broker] Deploy Poa Token:
  - Deploy POA token by calling:
    ```
    poaManager.addToken(
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
  - List PoaToken on Poa Manager
  ```
  poaManager.listToken(address _tokenAddress)
  ```


Depending on the sale, broker should start `Fiat funding` or `Eth Funding` period

## 3- [Broker] Fiat Funding Period
  - To start `Fiat Funding`, -only- broker should call:
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
  - If broker makes a mistake it can be reverted by calling:
  ```
  function removeFiat
  (
    address _contributor,
    uint256 _amountInCents
  )
  ```
  - If funding goal is met at this stage, contract automatically switches to `FundingSuccessful` stage.
  - In `Fiat Funding` stage, broker can always cancel the contract in case something goes wrong.
  ```
  poatoken.cancelFunding()
  ```

## 4- [Broker] Eth Funding Period
  - To start `Eth Funding`, anyone -including broker- can call:
  ```
  poatoken.startEthSale()
  ```
  Please remember, it only starts if the block time is greater than `_startTimeForEthFundingPeriod` mentioned above. Otherwise transaction fails.
  - If funding goal is met at this stage, contract automatically switches to `FundingSuccessful` stage.

## 5- Funding Succesful Stage
  - Broker should check the fee amount required to activate the contract:
  ```
  poatoken.calculateTotalFee()
  ```
  1. Execute required functions before activation:
  -  `poatoken.payActivationFee()` should be called by any of `Broker`, `Custodian` or `Brickblock`. If you are wondering why we made this function public to everyone, please see the explanation for this function in `PoaCrowdsale.sol` file.
  - Custodian should update proof of custody (Hash of legal papers uploaded to IPFS) by calling:

  ```
  poatoken.updateProofOfCustody(bytes32[2] _ipfsHash)
  ```
  - Note: The order for `payActivationFee` and `updateProofOfCustody` does not matter.
  2. Custodian must activate contract after activation fee paid and proof of custody updated before activation period ends, by calling:
  ```
  poatoken.activate()
  ```
## 6- Active Stage
  - Broker can claim Eth, which was funded during `Eth Funding` period, by calling:
  ```
  poatoken.claim()
  ```