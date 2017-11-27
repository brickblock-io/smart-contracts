pragma solidity ^0.4.18;

import './BrickblockAccessToken.sol';


contract BrickblockFountainStub is Ownable {
  using SafeMath for uint256;

  BrickblockAccessToken public brickblockAccessToken;

  function changeAccessTokenAddress(address _newAddress)
    public
  {
    brickblockAccessToken = BrickblockAccessToken(_newAddress);
  }

  function simulateFountainMint(address _to, uint256 _amount)
    public
  {
    brickblockAccessToken.mint(_to, _amount);
  }

}
