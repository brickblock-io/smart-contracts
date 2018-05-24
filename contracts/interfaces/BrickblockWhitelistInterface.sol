pragma solidity ^0.4.23;

interface WhitelistInterface {
  function whitelisted(address _address)
    external
    returns (bool);
}