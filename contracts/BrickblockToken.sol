pragma solidity ^0.4.18;

import 'zeppelin-solidity/contracts/token/PausableToken.sol';


contract BrickblockToken is PausableToken {

  string public constant name = "BrickblockToken";
  string public constant symbol = "BBT";
  uint256 public constant initialSupply = 50 * (10 ** 6) * (10 ** uint256(decimals));
  uint8 public constant contributorsShare = 51;
  uint8 public constant companyShare = 35;
  uint8 public constant bonusShare = 14;
  uint8 public constant decimals = 18;
  address public bonusDistributionAddress;
  address public fountainContractAddress;
  address public successor = 0x0;
  bool public tokenSaleActive;
  bool public dead;
  address public predecessorAddress;

  event TokensDistributed(address _contributor, uint256 _amount);
  event CompanyTokensReleased(address _owner, uint256 _amount);
  event TokenSaleFinished(uint256 _totalSupply, uint256 _distributedTokens,  uint256 _bonusTokens, uint256 _companyTokens);
  event Upgrade(address _successor);
  event Evacuated(address user);
  event Rescued(address user, uint256 rescuedBalance, uint256 newBalance);

  modifier only(address caller) {
    require(msg.sender == caller);
    _;
  }

  function BrickblockToken(address _predecessorAddress) {
    totalSupply = initialSupply;
    balances[this] = initialSupply;
    // need to start paused to make sure that there can be no transfers until dictated by company
    paused = true;
    tokenSaleActive = true;
    // if there is a predecessor take the initialization variables from its current state
    if (_predecessorAddress != address(0)) {
      predecessorAddress = _predecessorAddress;
      BrickblockToken predecessor = BrickblockToken(_predecessorAddress);
      balances[this] = predecessor.balanceOf(_predecessorAddress);
      // the total supply starts with the balance of the contract itself and rescued funds will be added to this
      totalSupply = predecessor.balanceOf(_predecessorAddress);
      tokenSaleActive = predecessor.tokenSaleActive();
      bonusDistributionAddress = predecessor.bonusDistributionAddress();
      fountainContractAddress = predecessor.fountainContractAddress();
    }
  }

  function unpause() onlyOwner whenPaused public {
    require(dead == false);
    super.unpause();
  }

  function isContract(address addr) private returns (bool) {
    uint _size;
    assembly { _size := extcodesize(addr) }
    return _size > 0;
  }

  // decide which wallet to use to distribute bonuses at a later date
  function changeBonusDistributionAddress(address _newAddress) public onlyOwner returns (bool) {
    // can perhaps put in an ecrecover function in order to verify that someone controls the address
    require(_newAddress != address(this));
    bonusDistributionAddress = _newAddress;
    return true;
  }

  // fountain contract might change over time... need to be able to change it
  function changeFountainContractAddress(address _newAddress) public onlyOwner returns (bool) {
    require(isContract(_newAddress));
    require(_newAddress != address(this));
    require(_newAddress != owner);
    fountainContractAddress = _newAddress;
    return true;
  }

  // custom transfer function that can be used while paused. Cannot be used after end of token sale
  function distributeTokens(address _contributor, uint256 _value) public onlyOwner returns (bool) {
    require(tokenSaleActive == true);
    require(_contributor != address(0)); // todo verify this is required
    require(_contributor != owner);
    balances[this] = balances[this].sub(_value);
    balances[_contributor] = balances[_contributor].add(_value);
    TokensDistributed(_contributor, _value);
    return true;
  }

  // Calculate the shares for company, bonus & contibutors based on the intiial 50mm number - not what is left over after burning
  function finalizeTokenSale() public onlyOwner returns (bool) {
    // ensure that sale is active. is set to false at the end. can only be performed once.
    require(tokenSaleActive == true);
    // ensure that bonus address has been set
    require(bonusDistributionAddress != address(0));
    uint256 _distributedTokens = initialSupply.sub(balances[this]);
    // owner should own 49% of total tokens
    uint256 _companyTokens = initialSupply.mul(companyShare).div(100);
    // token amount for internal bonuses based on totalSupply (14%)
    uint256 _bonusTokens = initialSupply.mul(bonusShare).div(100);
    // need to do this in order to have accurate totalSupply due to integer division
    uint256 _newTotalSupply = _distributedTokens.add(_bonusTokens.add(_companyTokens));
    // unpurchased amount of tokens which will be burned
    uint256 _burnAmount = totalSupply.sub(_newTotalSupply);
    // distribute bonusTokens to distribution address
    balances[this] = balances[this].sub(_bonusTokens);
    balances[bonusDistributionAddress] = balances[bonusDistributionAddress].add(_bonusTokens);
    // leave remaining balance for company to be claimed at later date .
    balances[this] = balances[this].sub(_burnAmount);
    // immediately set the remaining contract balance to be allowed by fountain addresse
    uint256 companyTokens = balances[this];
    allowed[this][fountainContractAddress] = uint256(0);
    allowed[this][fountainContractAddress] = allowed[this][fountainContractAddress].add(companyTokens);
    //set new totalSupply
    totalSupply = _newTotalSupply;
    // lock out this function from running ever again
    tokenSaleActive = false;
    // event showing sale is finished
    TokenSaleFinished(
      totalSupply,
      _distributedTokens,
      _bonusTokens,
      _companyTokens
    );
    // everything went well return true
    return true;
  }

  // this method will be called by the successor, it can be used to query the token balance,
  // but the main goal is to remove the data in the now dead contract,
  // to disable anyone to get rescued more that once
  // [TODO] if we want to evacuate the allowed mapping, we would need to change it's data layout,
  // so it includes a list of approvals per token holder,
  // but approvals should not live longer than a couple of blocks anyway
  function evacuate(address _user) only(successor) public returns (uint256) {
    require(dead);
    uint256 balance = balances[_user];
    balances[_user] = 0;
    totalSupply = totalSupply.sub(balance);
    Evacuated(_user);
    return balance;
  }

  // to upgrade our contract
  // we set the successor, who is allowed to empty out the data
  // it then will be dead
  // it will be paused to dissallow transfer of tokens
  function upgrade(address _successor) onlyOwner public returns (bool) {
    require(_successor != 0x0);
    successor = _successor;
    dead = true;
    paused = true;
    Upgrade(_successor);
    return true;
  }

  // each user should call rescue once after an upgrade to evacuate his balance from the predecessor
  // the allowed mapping will be lost
  // if this is called multiple times it won't throw, but the balance will not change
  // this enables us to call it befor each method changeing the balances
  // (this might be a bad idea due to gas-cost and overhead)
  function rescue() public returns (bool) {
    require(predecessorAddress != address(0));
    address _user = msg.sender;
    BrickblockToken predecessor = BrickblockToken(predecessorAddress);
    uint256 _oldBalance = predecessor.evacuate(_user);
    if(_oldBalance > 0 ) {
      balances[_user] = balances[_user].add(_oldBalance);
      totalSupply = totalSupply.add(_oldBalance);
      Rescued(_user, _oldBalance, balances[_user]);
      return true;
    }
    return false;
  }

  // fallback function - do not allow any eth transfers to this contract
  function() payable {
    throw;
  }

}
