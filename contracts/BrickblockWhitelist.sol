pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";


contract BrickblockWhitelist is Ownable {

  mapping (address => bool) public whitelisted;

  function BrickblockWhitelist()
    public
  {

  }

  function addAddress(address _address)
    public
    onlyOwner
  {
    require(whitelisted[_address] != true);
    whitelisted[_address] = true;
  }

  function removeAddress(address _address)
    public
    onlyOwner
  {
    require(whitelisted[_address] != false);
    whitelisted[_address] = false;
  }
}
