pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract BrickblockContractRegistry is Ownable {

  uint8 public constant version = 1;
  address public owner;
  mapping (bytes32 => address) contractAddresses;

  event UpdateContractEvent(string name, address indexed contractAddress);

  function updateContractAddress(string _name, address _address)
    public
    onlyOwner
    returns (address)
  {
    contractAddresses[stringToBytes32(_name)] = _address;
    emit UpdateContractEvent(_name, _address);
  }

  function getContractAddress(string _name)
    public
    view
    returns (address)
  {
    require(contractAddresses[stringToBytes32(_name)] != address(0));
    return contractAddresses[stringToBytes32(_name)];
  }

  function getContractAddress32(bytes32 _name32)
    public
    view
    returns (address)
  {
    require(contractAddresses[_name32] != address(0));
    return contractAddresses[_name32];
  }

  function stringToBytes32(string _string)
    public
    pure
    returns (bytes32 _bytes32)
  {
    assembly {
      _bytes32 := mload(add(_string, 0x20))
    }
  }
}
