pragma solidity ^0.4.18;

import "./BrickblockToken.sol";
import "./BrickblockAccessToken.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";


contract BrickblockFountain is Ownable {
  using SafeMath for uint256;

  event BBTLocked(address user, uint256 ammount);
  event BBTFreed(address user, uint256 ammount);

  struct Account {
    uint256 tokens;
    uint256 lastCheck;
    uint256 tokenHours;
  }

  mapping (address => Account) balances;

  BrickblockToken public bbt;
  BrickblockAccessToken public act;
  uint256 public tokenHoursTotal;

  function BrickblockFountain()
    public
  {
    // TODO: what does this time value represent?
    tokenHoursTotal = 1;
  }

  function changeBrickblockTokenLocation(address _newAddress)
    public
    onlyOwner
  {
    bbt = BrickblockToken(_newAddress);
  }

  function changeAccessTokenLocation(address _newAddress)
    public
    onlyOwner
  {
    act = BrickblockAccessToken(_newAddress);
  }

  function balanceOf(address _user)
    public
    view
    returns(uint256 balance)
  {
    return balances[_user].tokens;
  }

  function tokenHours(address _user)
    public
    view
    returns(uint256)
  {

    return balances[_user].tokenHours;
  }

  function updateAccount
  (
    address user,
    uint256 tokens
  )
    internal
    returns (Account account)
  {
    account = balances[user];

    if (account.lastCheck > 0) {
      uint256 thYield = account.tokens.mul(block.number.sub(account.lastCheck));
      /* [TODO] this should be normalized to represent something meaningful */
      account.tokenHours = account.tokenHours.add(thYield);
      tokenHoursTotal = tokenHoursTotal.add(thYield);
    }
    account.lastCheck = block.number;

    if (tokens > 0) {
      account.tokens = tokens;
      balances[user] = account;
    }

  }

  function updateTokenHours(address user)
    internal
    returns (uint256)
  {
    Account storage account = balances[user];

    if (account.lastCheck > 0) {
      uint256 thYield = account.tokens.mul (block.number.sub(account.lastCheck));
      /* [TODO] this should be normalized to represent something meaningful */
      account.tokenHours = account.tokenHours.add(thYield);
      tokenHoursTotal = tokenHoursTotal.add(thYield);
    }
    account.lastCheck = block.number;
    balances[user] = account;
    return account.tokenHours;
  }

  function lockBBT()
    public
    returns (uint256 _value)
  {
    address user = msg.sender;
    _value = bbt.allowance(user, this);
    require(_value > 0);
    bbt.transferFrom(user, this, _value);
    updateAccount(user, balances[user].tokens.add(_value)); // [TODO] maybe we should increaseTokenBalance like functions
    BBTLocked(user, _value);
  }

  function freeBBT()
    public
  {
    address user = msg.sender;
    uint256 _value = balanceOf(user);
    bbt.transfer(user, _value);
    updateAccount(user, 0);
    BBTFreed(user, _value);
  }

  function claimACT()
    public
  {
    address user = msg.sender;
    uint256 _tokenHours = updateTokenHours(user);
    uint256 _requiredAmount = 1000 ether; // [TODO] where do I get this from
    uint256 _usersAct = _tokenHours.mul(_requiredAmount).div(tokenHoursTotal);

    balances[user].tokenHours = 0;
    tokenHoursTotal = tokenHoursTotal.sub(_tokenHours);
    act.mint(user, _usersAct);
  }

}
