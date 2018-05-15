pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract BrickblockContractRegistry is Ownable {

  uint8 public constant version = 1;
  address public owner;
  mapping (bytes => address) contractAddresses;

  event UpdateContractEvent(string name, address indexed contractAddress);

  function updateContractAddress(string _name, address _address)
    public
    onlyOwner
    returns (address)
  {
    contractAddresses[bytes(_name)] = _address;
    emit UpdateContractEvent(_name, _address);
  }

  function getContractAddress(string _name)
    public
    view
    returns (address)
  {
    require(contractAddresses[bytes(_name)] != address(0));
    return contractAddresses[bytes(_name)];
  }
}
