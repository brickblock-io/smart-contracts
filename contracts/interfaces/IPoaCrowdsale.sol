pragma solidity 0.4.24;

interface IPoaCrowdsale {
  function initializeCrowdsale
  (
    bytes32 _fiatCurrency32, // bytes32 of fiat currency string
    uint256 _startTimeForEthFundingPeriod, // unix timestamp
    uint256 _durationForEthFundingPeriod, // seconds for eth funding period to last
    uint256 _durationForActivationPeriod, // seconds for custodian to activate token
    uint256 _fundingGoalInCents // fiat cents
  )
    external
    returns (bool);
}
