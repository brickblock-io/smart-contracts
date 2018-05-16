pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/BrickblockContractRegistryInterface.sol";
import "./interfaces/BrickblockTokenInterface.sol";
import "./interfaces/BrickblockFeeManagerInterface.sol";
import "./interfaces/BrickblockAccessTokenInterface.sol";


contract BrickblockAccount is Ownable {

  uint8 public constant version = 1;
  uint256 public fundsReleaseBlock;
  RegistryInterface private registry;

  constructor
  (
    address _registryAddress,
    uint256 _fundsReleaseBlock
  )
    public
  {
    registry = RegistryInterface(_registryAddress);
    fundsReleaseBlock = _fundsReleaseBlock;
  }

  function pullFunds()
    external
    onlyOwner
    returns (bool)
  {
    BrickblockTokenInterface bbk = BrickblockTokenInterface(
      registry.getContractAddress("BrickblockToken")
    );
    uint256 _companyFunds = bbk.balanceOf(address(bbk));
    return bbk.transferFrom(address(bbk), this, _companyFunds);
  }

  function lockBBK
  (
    uint256 _value
  )
    external
    onlyOwner
    returns (bool)
  {
    AccessTokenInterface act = AccessTokenInterface(
      registry.getContractAddress("AccessToken")
    );
    BrickblockTokenInterface bbk = BrickblockTokenInterface(
      registry.getContractAddress("BrickblockToken")
    );

    require(bbk.approve(address(act), _value));

    return act.lockBBK(_value);
  }

  function unlockBBK(
    uint256 _value
  )
    external
    onlyOwner
    returns (bool)
  {
    AccessTokenInterface act = AccessTokenInterface(
      registry.getContractAddress("AccessToken")
    );
    return act.unlockBBK(_value);
  }

  function claimFee(
    uint256 _value
  )
    external
    onlyOwner
    returns (bool)
  {
    FeeManagerInterface fmr = FeeManagerInterface(
      registry.getContractAddress("FeeManager")
    );
    return fmr.claimFee(_value);
  }

  function withdrawEthFunds(
    address _address,
    uint256 _value
  )
    external
    onlyOwner
    returns (bool)
  {
    require(address(this).balance > 0);
    _address.transfer(_value);
    return true;
  }

  function withdrawActFunds(
    address _address,
    uint256 _value
  )
    external
    onlyOwner
    returns (bool)
  {
    AccessTokenInterface act = AccessTokenInterface(
      registry.getContractAddress("AccessToken")
    );
    return act.transfer(_address, _value);
  }

  function withdrawBbkFunds(
    address _address,
    uint256 _value
  )
    external
    onlyOwner
    returns (bool)
  {
    require(fundsReleaseBlock < block.number);
    BrickblockTokenInterface bbk = BrickblockTokenInterface(
      registry.getContractAddress("BrickblockToken")
    );
    return bbk.transfer(_address, _value);
  }

  // ensure that we can be paid ether
  function()
    public
    payable
  {}
}
