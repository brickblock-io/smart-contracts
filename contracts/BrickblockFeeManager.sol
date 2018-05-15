pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";


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


// limited ExchangeRates definition
contract ExR {
  function getRate(bytes8 _queryTypeBytes)
    public
    view
    returns (uint256)
  {}
}


contract BrickblockFeeManager {

  using SafeMath for uint256;
  uint8 public constant version = 1;

  Registry private registry;

  constructor(
    address _registryAddress
  )
    public
  {
    require(_registryAddress != address(0));
    registry = Registry(_registryAddress);
  }

  function weiToAct(uint256 _wei)
    view
    public
    returns (uint256)
  {
    ExR exr = ExR(
      registry.getContractAddress("ExchangeRates")
    );
    uint256 _rate = exr.getRate("ACT");
    return _wei.mul(_rate);
  }

  function actToWei(uint256 _act)
    view
    public
    returns (uint256)
  {
    ExR exr = ExR(
      registry.getContractAddress("ExchangeRates")
    );
    uint256 _rate = exr.getRate("ACT");
    return _act.div(_rate);
  }

  function payFee()
    public
    payable
    returns (bool)
  {
    AccessToken act = AccessToken(
      registry.getContractAddress("AccessToken")
    );
    require(act.distribute(weiToAct(msg.value)));
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
    msg.sender.transfer(actToWei(_value));
    return true;
  }

  function()
    public
    payable
  {
    revert();
  }

}
