pragma solidity ^0.4.4;

import 'zeppelin-solidity/contracts/token/PausableToken.sol';


contract BrickblockToken is PausableToken {

  string public constant name = "BrickblockToken";
  string public constant symbol = "BBT";
  uint256 public constant initalSupply = 50 * (10 ** 6) * (10 ** uint256(decimals));
  // block approximating Nov 30, 2020
  uint256 public companyShareReleaseBlock;
  uint8 public constant contributorsShare = 51;
  uint8 public constant companyShare = 35;
  uint8 public constant bonusShare = 14;
  uint8 public constant decimals = 18;
  address public bonusDistributionAddress;
  address public fountainContractAddress;
  bool public tokenSaleActive;

  event TokensDistributed(address _contributor, uint256 _amount);
  event CompanyTokensReleased(address _owner, uint256 _amount);
  event TokenSaleFinished(uint256 _totalSupply, uint256 _distributedTokens,  uint256 _bonusTokens, uint256 _companyTokens);
  event Debug(uint _current, uint _release);

  function BrickblockToken(uint _companyShareReleaseBlock) {
    companyShareReleaseBlock = _companyShareReleaseBlock;
    totalSupply = initalSupply;
    balances[this] = initalSupply;
    // need to start paused to make sure that there can be no transfers until dictated by company
    paused = true;
    tokenSaleActive = true;
  }

  function isContract(address addr) private returns (bool) {
    uint size;
    assembly { size := extcodesize(addr) }
    return size > 0;
  }

  // decide which wallet to use to distribute bonuses at a later date
  function changeBonusDistributionAddress(address _newAddress) public onlyOwner returns (bool) {
    require(_newAddress != address(this));
    bonusDistributionAddress = _newAddress;
  }

  // fountain contract might change over time... need to be able to change it
  function changeFountainContractAddress(address _newAddress) public onlyOwner returns (bool) {
    require(isContract(_newAddress));
    require(_newAddress != address(this));
    require(_newAddress != owner);
    fountainContractAddress = _newAddress;
  }

  // custom transfer function that can be used while paused. Cannot be used after end of token sale
  function distributeTokens(address _contributor, uint256 _value) public onlyOwner returns (bool) {
    require(tokenSaleActive == true);
    require(_contributor != address(0));
    require(_contributor != owner);
    balances[this] = balances[this].sub(_value);
    balances[_contributor] = balances[_contributor].add(_value);
    TokensDistributed(_contributor, _value);
    return true;
  }

  // need to put brickblock funds into owner address
  function finalizeTokenSale() public onlyOwner returns (bool) {
    // ensure that sale is active. is set to false at the end. can only be performed once.
    require(tokenSaleActive == true);
    // ensure that bonus address has been set
    require(bonusDistributionAddress != address(0));
    // owner should own 51% of tokens
    uint256 _distributedTokens = initalSupply.sub(balances[this]);
    // new total supply based off of amount of token sale investment
    uint256 _tempTotalSupply = _distributedTokens.mul(100).div(contributorsShare);
    // new token amount for internal bonuses based on new totalSupply
    uint256 _bonusTokens = _tempTotalSupply.mul(bonusShare).div(100);
    // new token amount for company based on new totalSupply
    uint256 _companyTokens = _tempTotalSupply.mul(companyShare).div(100);
    // need to do this in order to have accurate totalSupply due to integer division
    uint256 _newTotalSupply = _distributedTokens.add(_bonusTokens.add(_companyTokens));
    // unused amount of tokens which were not purchased
    uint256 _burnAmount = totalSupply.sub(_newTotalSupply);
    // distribute bonusTokens to distribution address
    balances[this] = balances[this].sub(_bonusTokens);
    balances[bonusDistributionAddress] = balances[bonusDistributionAddress].add(_bonusTokens);
    // leave remaining balance for company to be claimed at later date .
    balances[this] = balances[this].sub(_burnAmount);
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

  // set allowed for this contract token balance for fountain.
  function approveCompanyTokensForFountain() public onlyOwner returns (bool) {
    require(fountainContractAddress != address(0));
    require(tokenSaleActive == false);
    uint256 companyTokens = balances[this];
    allowed[this][fountainContractAddress] = allowed[this][fountainContractAddress].add(companyTokens);
  }

  function claimCompanyTokens() public onlyOwner returns (bool) {
    require(block.number > companyShareReleaseBlock);
    require(tokenSaleActive == false);
    uint256 _companyTokens = balances[this];
    balances[this] = balances[this].sub(_companyTokens);
    balances[owner] = balances[owner].add(_companyTokens);
    CompanyTokensReleased(owner, _companyTokens);
  }
}
