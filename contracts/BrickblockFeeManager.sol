pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./interfaces/BrickblockAccessTokenInterface.sol";
import "./interfaces/BrickblockContractRegistryInterface.sol";
import "./interfaces/ExchangeRatesInterface.sol";


contract BrickblockFeeManager {

  using SafeMath for uint256;
  uint8 public constant version = 1;

  RegistryInterface private registry;

  constructor(
    address _registryAddress
  )
    public
  {
    require(_registryAddress != address(0));
    registry = RegistryInterface(_registryAddress);
  }

  function weiToAct(uint256 _wei)
    view
    public
    returns (uint256)
  {
    ExchangeRatesInterface exr = ExchangeRatesInterface(
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
    ExchangeRatesInterface exr = ExchangeRatesInterface(
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
    AccessTokenInterface act = AccessTokenInterface(
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
    AccessTokenInterface act = AccessTokenInterface(
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
