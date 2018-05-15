pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract Registry {
  function getContractAddress(string _name)
    public
    view
    returns (address)
  {}
}


contract BrickblockToken {
  function transfer(
    address _to,
    uint256 _value
  )
    public
    returns (bool)
  {}

  function transferFrom(
    address from,
    address to,
    uint256 value
  )
    public
    returns (bool)
  {}

  function balanceOf(
    address _address
  )
    public
    view
    returns (uint256)
  {}

  function approve(
    address _spender,
    uint256 _value
  )
    public
    returns (bool)
  {}
}


contract FeeManager {
  function claimFee(
    uint256 _value
  )
    public
    returns (bool)
  {}
}


contract AccessToken {
  function lockBBK(
    uint256 _value
  )
    external
    returns (bool)
  {}

  function unlockBBK(
    uint256 _value
  )
    external
    returns (bool)
  {}

  function transfer(
    address _to,
    uint256 _value
  )
    public
    returns (bool)
  {}
}


contract BrickblockAccount is Ownable {

  uint8 public constant version = 1;
  uint256 public fundsReleaseBlock;
  Registry private registry;

  constructor
  (
    address _registryAddress,
    uint256 _fundsReleaseBlock
  )
    public
  {
    registry = Registry(_registryAddress);
    fundsReleaseBlock = _fundsReleaseBlock;
  }

  function pullFunds()
    external
    onlyOwner
    returns (bool)
  {
    BrickblockToken bbk = BrickblockToken(
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
    AccessToken act = AccessToken(
      registry.getContractAddress("AccessToken")
    );
    BrickblockToken bbk = BrickblockToken(
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
    AccessToken act = AccessToken(
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
    FeeManager fmr = FeeManager(
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
    AccessToken act = AccessToken(
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
    BrickblockToken bbk = BrickblockToken(
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
