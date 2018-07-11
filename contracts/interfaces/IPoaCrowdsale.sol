pragma solidity 0.4.23;

interface IPoaCrowdsale {
  function initializeCrowdsale
  (
    bytes32 _fiatCurrency32, // bytes32 of fiat currency string
    address _broker,
    uint256 _startTime, // unix timestamp
    uint256 _fundingTimeout, // seconds after startTime
    uint256 _activationTimeout, // seconds after startTime + fundingTimeout
    uint256 _fundingGoalInCents // fiat cents
  )
    external
    returns (bool);
}