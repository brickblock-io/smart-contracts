pragma solidity ^0.4.23;

interface ExchangeRatesInterface {
  function queryTypes(
    bytes32
  ) 
    external 
    returns (bytes8);

  function ratesActive()
    external
    returns (bool);

  function getRate(
    bytes8 _queryTypeBytes
  )
    external
    view
    returns (uint256);

  function setRate(
    bytes32 _queryId,
    uint256 _rate
  )
    external
    returns (bool);

  function setQueryId(
    bytes32 _queryId,
    bytes8 _queryType
  )
    external
    returns (bool);

  function getCurrencySettings(
    bytes8 _queryType
  )
    view
    external
    returns (uint256, uint256, bytes32[5]);
}