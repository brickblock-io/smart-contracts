pragma solidity ^0.4.4;

import './BrickblockToken.sol';
import './BrickblockAccessToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';

contract BrickblockFountain {
  using SafeMath for uint256 ;

  event Debug(address user, uint256 tokens, uint256 tokenHours, uint256 lastCheck);
  event BBTlocked(address user, uint256 ammount);
  event BBTfreed(address user, uint256 ammount);
  
  struct Account {
    uint256 tokens;
    uint256 lastCheck;
    uint256 tokenHours;
  }
  
  mapping (address => Account) balances;
  
  BrickblockToken public bbt;
  BrickblockAccessToken public act;
  uint256 tokenHoursTotal = 1;
  
  function BrickblockFountain(BrickblockToken _bbt, BrickblockAccessToken _act) {
    bbt = _bbt;
    act = _act;
  }

  function balanceOf(address _user)
    public view   returns( uint256 balance ) {
    return balances[_user].tokens;
  }

  function tokenHours(address _user)
    public view returns( uint256 ) {
    
    return balances[_user].tokenHours;
  }

  function updateAccount(address user,
                         uint256 tokens)
    internal returns( Account account){
    account = balances[user];
    Debug(user, account.tokens, account.tokenHours, account.lastCheck);
    if(account.lastCheck > 0) {
      uint256 thYield = account.tokens.mul (now.sub(account.lastCheck) );
      /* [TODO] this should be normalized to represent something meaningful */
      account.tokenHours = account.tokenHours.add( thYield );
      tokenHoursTotal    = tokenHoursTotal   .add( thYield );
    }
    account.lastCheck = now;
    if(tokens > 0) 
      account.tokens = tokens;
    balances[user] = account;
    Debug(user, account.tokens, account.tokenHours, account.lastCheck);
  }

  function updateTokenHours(address user)
    internal returns ( uint256 ){
    Account storage account = balances[user];
    Debug(user, account.tokens, account.tokenHours, account.lastCheck);

    if(account.lastCheck > 0) {
      uint256 thYield = account.tokens.mul (now.sub(account.lastCheck) );
      /* [TODO] this should be normalized to represent something meaningful */
      account.tokenHours = account.tokenHours.add( thYield );
      tokenHoursTotal    = tokenHoursTotal   .add( thYield );

    }
    account.lastCheck = now;
    balances[user] = account;
    Debug(user, account.tokens, account.tokenHours, account.lastCheck);
    return account.tokenHours;
    /* balances[user] = account; */
  }
  
  function lockBBT()
    public returns (uint256 _value) {
    address user = msg.sender;
    _value = bbt.allowance(user, this);
    require(_value > 0);    
    bbt.transferFrom(user, this, _value);
    updateAccount(user, balances[user].tokens.add(_value)); // [TODO] maybe we should increaseTokenBalance like functions
    BBTlocked(user, _value);
  }

  function freeBBT()
    public {
    address user = msg.sender;
    uint256 _value = balanceOf(user);
    bbt.transfer(user, _value);
    updateAccount(user, 0);
    BBTfreed(user, _value);
  }
    
  function claimACT()
    public {
    address user = msg.sender;
    uint256 _tokenHours = updateTokenHours(user);
    uint256 _requiredAmount = 1000 ether; // [TODO] where do I get this from
    uint256 _usersAct = _tokenHours       .mul( _requiredAmount )
                          .div
                   ( tokenHoursTotal );
    Debug(user, balances[user].tokens, _tokenHours, _usersAct);

    balances[user].tokenHours = 0;
    tokenHoursTotal = tokenHoursTotal.sub(_tokenHours);
    act.mint(user, _usersAct);
  }
}
