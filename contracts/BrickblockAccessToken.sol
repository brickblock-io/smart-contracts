pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/MintableToken.sol";
import "./BrickblockUmbrella.sol";


contract BrickblockAccessToken is MintableToken {
  string public constant name = "BrickblockAccessToken";
  string public constant symbol = "ACT";
  uint8 public constant decimals = 18;
  address public fountainAddress;
  address public umbrellaAddress;

  event Burn(address indexed burner, uint256 value);

  function BrickblockAccessToken()
    public
  {
    totalSupply = 0;
  }

  modifier onlyAllowed {
    require(msg.sender == owner || msg.sender == fountainAddress);
    _;
  }

  modifier onlyBurnAuthorized {
    require(umbrellaAddress != address(0));
    BrickblockUmbrella bbu = BrickblockUmbrella(umbrellaAddress);
    require(msg.sender == umbrellaAddress || bbu.tokenStatus(msg.sender));
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

  // fountain contract might change over time... need to be able to change it
  function changeUmbrellaAddress(address _newAddress)
    public
    onlyOwner
    isContract(_newAddress)
    returns (bool)
  {
    require(_newAddress != address(0));
    require(_newAddress != umbrellaAddress);
    require(_newAddress != address(this));
    require(_newAddress != owner);
    umbrellaAddress = _newAddress;
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
    onlyBurnAuthorized
    public
    returns (bool)
  {
    require(_value > 0);

    balances[_from] = balances[_from].sub(_value);
    allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
    totalSupply = totalSupply.sub(_value);
    Burn(_from, _value);
    return true;
  }
}
