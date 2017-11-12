pragma solidity ^0.4.4;

import 'zeppelin-solidity/contracts/token/StandardToken.sol';

contract BrickblockAccessToken is StandardToken {
  event Mint(address indexed to, uint256 amount);

  function BrickblockAccessToken() {
    
  }

  function mint(address _to, uint256 _amount)  public returns (bool) {
    totalSupply = totalSupply.add(_amount);
    balances[_to] = balances[_to].add(_amount);
    Mint(_to, _amount);
    Transfer(0x0, _to, _amount);
    return true;
  }

}
