// THIS IS EXAMPLE CODE ONLY AND THE FUNCTIONS MOST LIKELY WILL
pragma solidity ^0.4.18;

import './BrickblockToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';


contract BrickblockFountainExample is Ownable {
  using SafeMath for uint256;

  struct Account {
    uint256 tokens;
    uint256 lastCheck;
    uint256 tokenHours;
  }

  mapping (address => Account) balances;

  uint256 public constant companyShareReleaseBlock = 1234567;
  address public brickBlockTokenAddress;

  event BBTLocked(address _locker, uint256 _value);
  event CompanyTokensReleased(address _owner, uint256 _tokenAmount);
  event Placeholder(address _address, uint256 _value);

  function BrickblockFountainExample(address _brickBlockTokenAddress) {
    require(_brickBlockTokenAddress != address(0));
    brickBlockTokenAddress = _brickBlockTokenAddress;
  }

  function balanceOf(address _user) public view returns( uint256 balance ) {
    return balances[_user].tokens;
  }

  function updateAccount(address _locker, uint256 _value) private returns (uint256) {
    Placeholder(_locker, _value);
  }

  function lockCompanyFunds() public onlyOwner returns (bool) {
    BrickblockToken _bbt = BrickblockToken(brickBlockTokenAddress);
    uint256 _value = _bbt.allowance(brickBlockTokenAddress, this);
    require(_value > 0);
    _bbt.transferFrom(brickBlockTokenAddress, this, _value);
    updateAccount(brickBlockTokenAddress, balances[brickBlockTokenAddress].tokens.add(_value));
    BBTLocked(brickBlockTokenAddress, _value);
  }

  function lockBBT() public returns (uint256 _value)
  {
    address user = msg.sender;
    BrickblockToken _bbt = BrickblockToken(brickBlockTokenAddress);
    _value = _bbt.allowance(user, this);
    require(_value > 0);
    _bbt.transferFrom(user, this, _value);
    updateAccount(user, balances[user].tokens.add(_value));
    BBTLocked(user, _value);
  }

  function claimCompanyTokens() public onlyOwner returns (bool) {
    require(block.number > companyShareReleaseBlock);
    BrickblockToken _bbt = BrickblockToken(brickBlockTokenAddress);
    uint256 _companyTokens = balanceOf(_bbt);
    balances[this].tokens = balances[this].tokens.sub(_companyTokens);
    balances[owner].tokens = balances[owner].tokens.add(_companyTokens);
    updateAccount(brickBlockTokenAddress, 0);
    CompanyTokensReleased(owner, _companyTokens);
  }

  // much more functionality is already built and undergoing development and refinement!

}
