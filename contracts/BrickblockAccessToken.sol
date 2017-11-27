pragma solidity ^0.4.18;

import 'zeppelin-solidity/contracts/token/BurnableToken.sol';
import 'zeppelin-solidity/contracts/token/MintableToken.sol';


// this will definitely change... but for now it is a good placeholder to see how to work with the fountain contract
contract BrickblockAccessToken is MintableToken, BurnableToken {

  string public constant name = "BrickblockAccessToken";
  string public constant symbol = "ACT";
  uint8 public constant decimals = 18;
  address public fountainAddress;

  function BrickblockAccessToken()
    public
  {
    totalSupply = 0;
  }

  modifier onlyAllowed {
    require(msg.sender == owner || msg.sender == fountainAddress);
    _;
  }

  modifier onlyFountain {
    require(msg.sender == fountainAddress);
    _;
  }

  modifier isContract(address addr) {
    uint _size;
    assembly { _size := extcodesize(addr) }
    require(_size > 0);
    _;
  }

  // fountain contract might change over time... need to be able to change it
  function changeFountainAddress(address _newAddress)
    public
    onlyOwner
    isContract(_newAddress)
    returns (bool)
  {
    require(_newAddress != address(0));
    require(_newAddress != fountainAddress);
    require(_newAddress != address(this));
    require(_newAddress != owner);
    fountainAddress = _newAddress;
    return true;
  }

  // TODO: I think this should be fine and will overwrite the old function??? NEED TO CHECK
  function mint
  (
    address _to,
    uint256 _amount
  )
    public
    onlyAllowed
    returns (bool)
  {
    totalSupply = totalSupply.add(_amount);
    balances[_to] = balances[_to].add(_amount);
    Mint(_to, _amount);
    Transfer(0x0, _to, _amount);
    return true;
  }

  function burnFrom(uint256 _value, address _from)
    public
    onlyFountain
    returns (bool)
  {
    require(_value > 0);

    balances[_from] = balances[_from].sub(_value);
    allowed[_from][fountainAddress] = allowed[_from][fountainAddress].sub(_value);
    totalSupply = totalSupply.sub(_value);
    Burn(_from, _value);
  }
}
