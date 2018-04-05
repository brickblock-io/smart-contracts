pragma solidity 0.4.18;


// limited BrickblockContractRegistry definition
contract Registry {
  function getContractAddress(string _name)
    public
    view
    returns (address)
  {}
}


// limited BrickblockAccessToken definition
contract AccessToken {
  function distribute(
    uint256 _amount
  )
    public
    returns (bool)
  {}

  function burn(
    address _address,
    uint256 _value
  )
    public
    returns (bool)
  {}
}


contract BrickblockFeeManager {

  Registry private registry;

  function BrickblockFeeManager(
    address _registryAddress
  )
    public
  {
    require(_registryAddress != address(0));
    registry = Registry(_registryAddress);
  }

  function payFee()
    public
    payable
    returns (bool)
  {
    AccessToken act = AccessToken(
      registry.getContractAddress("AccessToken")
    );
    require(act.distribute(msg.value));
    return true;
  }

  function claimFee(
    uint256 _value
  )
    public
    returns (bool)
  {
    AccessToken act = AccessToken(
      registry.getContractAddress("AccessToken")
    );
    require(act.burn(msg.sender, _value));
    msg.sender.transfer(_value);
    return true;
  }

  function()
    public
    payable
  {
    revert();
  }

}
