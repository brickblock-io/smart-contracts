pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/IRegistry.sol";
import "./interfaces/IBrickblockToken.sol";
import "./interfaces/IFeeManager.sol";
import "./interfaces/IAccessToken.sol";

/* solium-disable security/no-block-members */


contract BrickblockAccount is Ownable {
  uint8 public constant version = 1;
  uint256 public releaseTimeOfCompanyBBKs;
  IRegistry private registry;

  constructor
  (
    address _registryAddress,
    uint256 _releaseTimeOfCompanyBBKs
  )
    public
  {
    require(_releaseTimeOfCompanyBBKs > block.timestamp);
    releaseTimeOfCompanyBBKs = _releaseTimeOfCompanyBBKs;
    registry = IRegistry(_registryAddress);
  }

  function pullFunds()
    external
    onlyOwner
    returns (bool)
  {
    IBrickblockToken bbk = IBrickblockToken(
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
    IAccessToken act = IAccessToken(
      registry.getContractAddress("AccessToken")
    );
    IBrickblockToken bbk = IBrickblockToken(
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
    IAccessToken act = IAccessToken(
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
    IFeeManager fmr = IFeeManager(
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
    IAccessToken act = IAccessToken(
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
    require(block.timestamp >= releaseTimeOfCompanyBBKs);
    IBrickblockToken bbk = IBrickblockToken(
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
