pragma solidity 0.4.18;


// shortened version of actual contract in order to save on costs
contract BrickblockContractRegistryInterface {

  address public owner;
  mapping (bytes => address) contractAddresses;

  modifier onlyOwner()
  {
    require(msg.sender == owner);
    _;
  }

  function updateContract(string _name, address _address)
    public
    onlyOwner
    returns (address)
  {}

  function getContractAddress(string _name)
    public
    view
    returns (address)
  {}
}


// shortened version of actual contract in order to save on costs
contract GenericRemoteContractInterface {

  function testNumber()
    public
    view
    returns (uint256)
  {}

  function add(uint256 _num1, uint256 _num2)
    public
    pure
    returns (uint256)
  {}

  function setTestNumber(uint256 _number)
    public
    returns (bool)
  {}

}


contract GenericRemoteContractUser {

  BrickblockContractRegistryInterface private registry;
  address private registryAddress;

  modifier registryInitialized()
  {
    require(registryAddress != address(0));
    _;
  }

  function GenericRemoteContractUser(address _registryAddress)
    public
  {
    require(_registryAddress != address(0));
    setContractRegistry(_registryAddress);
  }

  function getGenericRemoteContract()
    private
    view
    returns (GenericRemoteContractInterface)
  {
    return GenericRemoteContractInterface(
      registry.getContractAddress("testName")
    );
  }

  function remoteAdd(uint256 _num1, uint256 _num2)
    public
    view
    registryInitialized
    returns (uint256)
  {
    GenericRemoteContractInterface genericRemoteContract = getGenericRemoteContract();
    return genericRemoteContract.add(_num1, _num2);
  }

  function remoteTestNumber()
    public
    view
    registryInitialized
    returns (uint256)
  {
    GenericRemoteContractInterface genericRemoteContract = getGenericRemoteContract();
    return genericRemoteContract.testNumber();
  }

  function remoteSetNumber(uint256 _newNumber)
    public
    registryInitialized
    returns (bool)
  {
    GenericRemoteContractInterface genericRemoteContract = getGenericRemoteContract();
    require(genericRemoteContract.setTestNumber(_newNumber));
    return true;
  }

  function setContractRegistry(address _registryAddress)
    public
  {
    registry = BrickblockContractRegistryInterface(_registryAddress);
    registryAddress = _registryAddress;
  }
}
