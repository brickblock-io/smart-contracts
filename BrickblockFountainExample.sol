// THIS IS EXAMPLE CODE ONLY AND THE FUNCTIONS MOST LIKELY WILL
pragma solidity ^0.4.4;

import './BrickblockToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';


contract BrickblockFountain {
  using SafeMath for uint256;

  uint256 public constant companyShareReleaseBlock = 1234567;
  address public brickBlockTokenAddress;

  function BrickblockFountain(address _brickBlockTokenAddress) {
    require(_brickBlockTokenAddress != address(0));
    brickBlockTokenAddress = _brickBlockTokenAddress;
    BrickblockToken bbt = BrickblockToken(_brickBlockTokenAddress);
    _value = bbt.allowance(user, this);
    require(_value > 0);
    bbt.transferFrom(_brickBlockTokenAddress, this, _value);
    updateAccount(user, balances[user].tokens.add(_value));
    BBTlocked(user, _value);
  }

  function lockBBT() public returns (uint256 _value)
  {
    address user = msg.sender;
    _value = bbt.allowance(user, this);
    require(_value > 0);
    bbt.transferFrom(user, this, _value);
    updateAccount(user, balances[user].tokens.add(_value));
    BBTlocked(user, _value);
  }

  function claimCompanyTokens() public onlyOwner returns (bool) {
    require(block.number > companyShareReleaseBlock);
    BrickblockToken _bbt = BrickblockToken(brickBlockTokenAddress);
    uint256 _companyTokens = balanceOf(_bbt);
    balances[this] = balances[this].sub(_companyTokens);
    balances[owner] = balances[owner].add(_companyTokens);
    updateAccount(user, 0);
    CompanyTokensReleased(owner, _companyTokens);
  }

  // much more functionality is already built and undergoing development and refinement!

}
