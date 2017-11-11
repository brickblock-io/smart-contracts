pragma solidity ^0.4.4;

import 'zeppelin-solidity/contracts/token/TokenTimelock.sol';
import './BrickblockToken.sol';

contract BrickblockFountain {
  event Debug(address sender, address fountain, uint256 value);
  mapping (address => uint256) balances;
  
  BrickblockToken public bbt;
  function BrickblockFountain(BrickblockToken _token) {
    bbt = _token;
  }

  function balanceOf(address _user) view  returns( uint256 balance ) {
    return balances[_user];
  }
  
  function lockTokens() public {
    uint256 value;
    value = bbt.allowance(msg.sender, this);
    bbt.transferFrom(msg.sender, this, value);
    balances[msg.sender] += value;
  }

  function claimTokens() public {
    uint256 value = balanceOf(msg.sender);
    Debug(msg.sender, this, value);
    bbt.transfer(msg.sender, value);
    balances[msg.sender] = 0;
  }
}
