pragma solidity 0.4.24;

interface IPoaManager {
  function getTokenStatus(
    address _tokenAddress
  )
    external
    view
    returns (bool);
}
