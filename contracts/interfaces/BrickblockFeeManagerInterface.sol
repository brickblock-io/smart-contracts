pragma solidity ^0.4.23;

interface FeeManagerInterface {
  function claimFee(
    uint256 _value
  )
    external
    returns (bool);
}

