pragma solidity 0.4.24;

interface IPoaCrowdsale {
  function initializeCrowdsale
  (
    bytes32 _fiatCurrency32, // bytes32 of fiat currency string
    uint256 _startTimeForEthFunding, // unix timestamp
    uint256 _endTimeForEthFunding, // seconds after startTimeForEthFunding
    uint256 _activationTimeout, // seconds after startTimeForEthFunding + endTimeForEthFunding
    uint256 _fundingGoalInCents // fiat cents
  )
    external
    returns (bool);
}
