pragma solidity ^0.4.18;


import "./BrickblockAccessToken.sol";
contract POATokenStub {

  BrickblockAccessToken public brickblockAccessToken;

  function changeAccessTokenAddress(address _newAddress)
    public
  {
    brickblockAccessToken = BrickblockAccessToken(_newAddress);
  }

  function simulateBurnFrom(uint256 _value, address _from)
    public
  {
    brickblockAccessToken.burnFrom(_value, _from);
  }
}
