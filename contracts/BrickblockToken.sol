pragma solidity 0.4.18;

import "zeppelin-solidity/contracts/token/PausableToken.sol";


contract BrickblockToken is PausableToken {

  string public constant name = "BrickblockToken";
  string public constant symbol = "BBK";
  uint256 public constant initialSupply = 500 * (10 ** 6) * (10 ** uint256(decimals));
  uint256 public companyTokens;
  uint256 public bonusTokens;
  uint8 public constant contributorsShare = 51;
  uint8 public constant companyShare = 35;
  uint8 public constant bonusShare = 14;
  uint8 public constant decimals = 18;
  address public bonusDistributionAddress;
  address public fountainContractAddress;
  bool public tokenSaleActive;
  bool public dead = false;

  event TokenSaleFinished
  (
    uint256 totalSupply,
    uint256 distributedTokens,
    uint256 bonusTokens,
    uint256 companyTokens
  );
  event Burn(address indexed burner, uint256 value);

  // need to make sure that no more than 51% of total supply is bought
  modifier supplyAvailable(uint256 _value) {
    uint256 _distributedTokens = initialSupply.sub(balances[this].add(bonusTokens));
    uint256 _maxDistributedAmount = initialSupply.mul(contributorsShare).div(100);
    require(_distributedTokens.add(_value) <= _maxDistributedAmount);
    _;
  }

  function BrickblockToken(address _bonusDistributionAddress)
    public
  {
    require(_bonusDistributionAddress != address(0));
    bonusTokens = initialSupply.mul(bonusShare).div(100);
    companyTokens = initialSupply.mul(companyShare).div(100);
    bonusDistributionAddress = _bonusDistributionAddress;
    totalSupply = initialSupply;
    balances[this] = initialSupply;
    Transfer(address(0), this, initialSupply);
    // distribute bonusTokens to distribution address
    balances[this] = balances[this].sub(bonusTokens);
    balances[bonusDistributionAddress] = balances[bonusDistributionAddress].add(bonusTokens);
    Transfer(this, bonusDistributionAddress, bonusTokens);
    // need to start paused to make sure that there can be no transfers until dictated by company
    paused = true;
    tokenSaleActive = true;
  }

  function toggleDead()
    external
    onlyOwner
    returns (bool)
  {
    dead = !dead;
  }

  function isContract(address addr)
    private
    view
    returns (bool)
  {
    uint _size;
    assembly { _size := extcodesize(addr) }
    return _size > 0;
  }

  // fountain contract might change over time... need to be able to change it
  function changeFountainContractAddress(address _newAddress)
    external
    onlyOwner
    returns (bool)
  {
    require(isContract(_newAddress));
    require(_newAddress != address(this));
    require(_newAddress != owner);
    fountainContractAddress = _newAddress;
    return true;
  }

  // custom transfer function that can be used while paused. Cannot be used after end of token sale
  function distributeTokens(address _contributor, uint256 _value)
    external
    onlyOwner
    supplyAvailable(_value)
    returns (bool)
  {
    require(tokenSaleActive == true);
    require(_contributor != address(0));
    require(_contributor != owner);
    balances[this] = balances[this].sub(_value);
    balances[_contributor] = balances[_contributor].add(_value);
    Transfer(this, _contributor, _value);
    return true;
  }

  function distributeBonusTokens(address _recipient, uint256 _value)
    external
    onlyOwner
    returns (bool)
  {
    require(_recipient != address(0));
    require(_recipient != owner);
    balances[bonusDistributionAddress] = balances[bonusDistributionAddress].sub(_value);
    balances[_recipient] = balances[_recipient].add(_value);
    Transfer(bonusDistributionAddress, _recipient, _value);
    return true;
  }

  // Calculate the shares for company, bonus & contibutors based on the intiial 50mm number - not what is left over after burning
  function finalizeTokenSale()
    external
    onlyOwner
    returns (bool)
  {
    // ensure that sale is active. is set to false at the end. can only be performed once.
    require(tokenSaleActive == true);
    // ensure that fountainContractAddress has been set
    require(fountainContractAddress != address(0));
    uint256 _distributedTokens = initialSupply.sub(balances[this].add(bonusTokens));
    // need to do this in order to have accurate totalSupply due to integer division
    uint256 _newTotalSupply = _distributedTokens.add(bonusTokens.add(companyTokens));
    // unpurchased amount of tokens which will be burned
    uint256 _burnAmount = totalSupply.sub(_newTotalSupply);
    // leave remaining balance for company to be claimed at later date
    balances[this] = balances[this].sub(_burnAmount);
    Burn(this, _burnAmount);
    // set the company tokens to be allowed by fountain addresse
    allowed[this][fountainContractAddress] = companyTokens;
    Approval(this, fountainContractAddress, companyTokens);
    // set new totalSupply
    totalSupply = _newTotalSupply;
    // lock out this function from running ever again
    tokenSaleActive = false;
    // event showing sale is finished
    TokenSaleFinished(
      totalSupply,
      _distributedTokens,
      bonusTokens,
      companyTokens
    );
    // everything went well return true
    return true;
  }

  // fallback function - do not allow any eth transfers to this contract
  function()
    external
  {
    revert();
  }

}
