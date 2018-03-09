pragma solidity 0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";


contract BrickblockContractRegistry is Ownable {

  address public owner;
  mapping (bytes => address) contractAddresses;

  event UpdateContractEvent(string name, address indexed contractAddress);

  function updateContract(string _name, address _address)
    public
    onlyOwner
    returns (address)
  {
    contractAddresses[bytes(_name)] = _address;
    UpdateContractEvent(_name, _address);
  }

  function getContractAddress(string _name)
    public
    view
    returns (address)
  {
    return contractAddresses[bytes(_name)];
  }
}
