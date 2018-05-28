pragma solidity ^0.4.23;

interface PoaManagerInterface {
  function registry()
    external
    view
    returns (address);
  
  function getTokenStatus(
    address _tokenAddress
  )
    external
    view
    returns (bool);
}
