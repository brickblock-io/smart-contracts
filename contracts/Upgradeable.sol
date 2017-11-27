pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";


contract Upgradeable is Pausable {
  address public predecessor;
  address public successor;
  bool public dead;

  event Upgrade(address _successor);

  modifier only(address caller) {
    require(msg.sender == caller);
    _;
  }

  function unpause()
    public
    onlyOwner
    whenPaused
  {
    require(dead == false);
    super.unpause();
  }

  function Upgradeable(address _predecessor)
    public
  {
    // set initial state here...
  }

  // this method will be called by the successor, it can be used to query the token balance,
  // but the main goal is to remove the data in the now dead contract,
  // to disable anyone to get rescued more that once
  // approvals are not included due to data structure
  // example implementation:
  /*
  function evacuate(address _user) only(successor) public returns (uint256) {
    require(dead);
    uint256 balance = balances[_user];
    balances[_user] = 0;
    totalSupply = totalSupply.sub(balance);
    Evacuated(_user);
    return balance;
  }
  */
  function evacuate(address _user)
    public
    only(successor)
    returns (uint256)
  {}

  // to upgrade our contract
  // we set the successor, who is allowed to empty out the data
  // it then will be dead
  // it will be paused to dissallow transfer of tokens
  // example implementation:
  /*
  function upgrade(address _successor) onlyOwner public returns (bool) {
    require(_successor != address(0));
    successor = _successor;
    dead = true;
    paused = true;
    Upgrade(_successor);
    return true;
  }
  */
  function upgrade(address _successor)
    public
    onlyOwner
    returns (bool)
  {}

  // each user should call rescue once after an upgrade to evacuate his balance from the predecessor
  // the allowed mapping will be lost
  // if this is called multiple times it won't throw, but the balance will not change
  // this enables us to call it before each method changing the balances
  // (this might be a bad idea due to gas-cost and overhead)
  // example implementation:
  /*
  function rescue() public returns (bool) {
    require(predecessor != address(0));
    address _user = msg.sender;
    BrickblockToken predecessor = BrickblockToken(predecessor);
    uint256 _oldBalance = predecessor.evacuate(_user);
    if (_oldBalance > 0) {
      balances[_user] = balances[_user].add(_oldBalance);
      totalSupply = totalSupply.add(_oldBalance);
      Rescued(_user, _oldBalance, balances[_user]);
      return true;
    }
    return false;
  }
  */
  function rescue()
    public
    returns (bool)
  {}
}
