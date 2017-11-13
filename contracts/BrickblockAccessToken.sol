pragma solidity ^0.4.4;

import 'zeppelin-solidity/contracts/token/BurnableToken.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';

// this will definitely change... but for now it is a good placeholder to see how to work with the fountain contract
contract BrickblockAccessToken is BurnableToken, Ownable {
  event Mint(address indexed to, uint256 amount);
  string public constant name = "BrickblockAccessToken";
  string public constant symbol = "ACT";
  uint8 public constant decimals = 18;
  // set to 1e6 for now... need to find out what the correct amount is...
  uint256 public constant initialSupply = 1 * (10 ** 6) * (10 ** uint256(decimals));
  address public fountainAddress;

  function BrickblockAccessToken() {
    totalSupply = initialSupply;
    balances[msg.sender] = initialSupply;
  }

  modifier onlyAllowed {
    require(msg.sender == owner || msg.sender == fountainAddress);
    _;
  }

  function changeFountainLocation(address _address)
    onlyAllowed
    public
  {
    fountainAddress = _address;
  }

  function mint
  (
    address _to,
    uint256 _amount
  )
    onlyAllowed
    public
    returns (bool)
  {
    totalSupply = totalSupply.add(_amount);
    balances[_to] = balances[_to].add(_amount);
    Mint(_to, _amount);
    Transfer(0x0, _to, _amount);
    return true;
  }
}
