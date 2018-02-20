pragma solidity 0.4.18;

import "zeppelin-solidity/contracts/token/PausableToken.sol";


// limited BrickblockContractRegistry definintion
contract Registry {
  address public owner;
  mapping (bytes => address) contractAddresses;

  function updateContract(string _name, address _address)
    public
    returns (address)
  {}

  function getContractAddress(string _name)
    public
    view
    returns (address)
  {}
}


// limited BrickblockToken definition
contract BrickblockToken {
  function transfer(
    address _to,
    uint256 _value
  )
    public
    returns (bool)
  {}

  function transferFrom(
    address from,
    address to,
    uint256 value
  )
    public
    returns (bool)
  {}

  function balanceOf(
    address _address
  )
    public
    view
    returns (uint256)
  {}
}


contract BrickblockAccessToken2 is PausableToken {

  /*
    glossary:
      dividendParadigm: the way of handling dividends, and the per token data structures
        * totalLockedBBK * (totalMintedPerToken - distributedPerBBK) / 1e18
        * this is they typical way of handling dividends.
        * per token data structures are stored * 1e18 (for more accuracy)
        * this works fine until BBK is locked or unlocked.
          * need to still know the amount they HAD locked before a change.
          * securedFundsParadigm solves this (read below)
        * when BBK is locked or unlocked, current funds for the relevant
          account are bumped to a new paradigm for balance tracking.
        * when bumped to new paradigm, dividendParadigm is essentially zeroed out
          by setting distributedPerBBK to totalMintedPerToken
            * (100 * (100 - 100) === 0)
        * all minting activity related balance increments are tracked through this

      securedFundsParadigm: the funds that are bumped dividends out during lock / unlock
        * securedTokenDistributions (mapping)
        * needed in order to track ACT balance after lock/unlockBBK
        * tracks funds that have been bumped from dividendParadigm
        * works as a regular balance (not per token)

      doubleEntryParadigm: taking care of transfer and transferFroms
        * receivedBalances[adr] - spentBalances[adr]
        * needed in order to track correct balance after transfer/transferFrom
        * receivedBalances used to increment any transfers to an account
          * increments balanceOf
          * needed to accurately track balanceOf after transfers and transferFroms
        * spentBalances
          * decrements balanceOf
          * needed to accurately track balanceOf after transfers and transferFroms

      dividendParadigm, securedFundsParadigm, doubleEntryParadigm combined
        * when all combined, should correctly:
          * show balance using balanceOf
            * balances is set to private (cannot guarantee accuracy of this)
            * balances not updated to correct values unless a
              transfer/transferFrom happens
          *
        * dividendParadigm + securedFundsParadigm + doubleEntryParadigm
          * totalLockedBBK * (totalMintedPerToken - distributedPerBBK[adr]) / 1e18
            + securedTokenDistributions[adr]
            + receivedBalances[adr] - spentBalances[adr]
  */

  // instance of registry contract to get contract addresses
  Registry private registry;

  string public constant name = "BrickblockAccessToken";
  string public constant symbol = "ACT";
  uint8 public constant decimals = 18;

  // total amount of minted ACT that a single BBK token is entitled to
  uint256 private totalMintedPerToken;
  // total amount of BBK that is currently locked into ACT contract
  // used to calculate how much to increment totalMintedPerToken during minting
  uint256 public totalLockedBBK;

  // used to save information on who has how much BBK locked in
  // used in dividendParadigm (see glossary)
  mapping(address => uint256) private lockedBBK;
  // used to decrement totalMintedPerToken by amounts that have already been moved to securedTokenDistributions
  // used in dividendParadigm (see glossary)
  mapping(address => uint256) private distributedPerBBK;
  // used to store ACT balances that have been moved off of:
  // dividendParadigm (see glossary) to securedFundsParadigm
  mapping(address => uint256) private securedTokenDistributions;
  // ERC20 override... keep private and only use balanceOf instead
  mapping(address => uint256) private balances;
  // mapping tracking incoming balances in order to have correct balanceOf
  // used in doubleEntryParadigm (see glossary)
  mapping(address => uint256) private receivedBalances;
  // mapping tracking outgoing balances in order to have correct balanceOf
  // used in doubleEntryParadigm (see glossary)
  mapping(address => uint256) private spentBalances;


  event Mint(uint256 amount);
  event Burn(address indexed burner, uint256 value);

  modifier onlyContract(string _contractName)
  {
    require(
      msg.sender == registry.getContractAddress(_contractName)
    );
    _;
  }

  // constructor
  function BrickblockAccessToken2(
    address _registryAddress
  )
    public
  {
    registry = Registry(_registryAddress);
  }

  // check an address for amount of currently locked BBK
  // works similar to basic ERC20 balanceOf
  function lockedBbkOf(
    address _address
  )
    external
    view
    returns (uint256)
  {
    return lockedBBK[_address];
  }

  // transfers BBK from an account to this contract
  // uses settlePerTokenToSecured to move funds in dividendParadigm to securedFundsParadigm
  // keeps a record of transfers in lockedBBK (securedFundsParadigm)
  function lockBBK(
    uint256 _amount
  )
    external
    returns (bool)
  {
    BrickblockToken _bbk = BrickblockToken(
      registry.getContractAddress("BrickblockToken")
    );

    require(settlePerTokenToSecured(msg.sender));
    lockedBBK[msg.sender] = lockedBBK[msg.sender].add(_amount);
    totalLockedBBK = totalLockedBBK.add(_amount);
    require(_bbk.transferFrom(msg.sender, this, _amount));
    return true;
  }

  // transfers BBK from this contract to an account
  // uses settlePerTokenToSecured to move funds in dividendParadigm to securedFundsParadigm
  // keeps a record of transfers in lockedBBK (securedFundsParadigm)
  function unlockBBK(
    uint256 _amount
  )
    external
    returns (bool)
  {
    BrickblockToken _bbk = BrickblockToken(
      registry.getContractAddress("BrickblockToken")
    );
    require(_amount <= lockedBBK[msg.sender]);
    require(settlePerTokenToSecured(msg.sender));
    lockedBBK[msg.sender] = lockedBBK[msg.sender].sub(_amount);
    totalLockedBBK = totalLockedBBK.sub(_amount);
    require(_bbk.transfer(msg.sender, _amount));
    return true;
  }

  // distribute tokens to all BBK token holders
  // uses dividendParadigm to distribute ACT to lockedBBK holders
  // adds delta (integer division remainders) to owner securedFundsParadigm balance
  function distribute(
    uint256 _amount
  )
    external
    onlyContract("FeeManager")
    returns (bool)
  {
    totalMintedPerToken = totalMintedPerToken
      .add(
        _amount
          .mul(1e18)
          .div(totalLockedBBK)
      );

    uint256 _delta = (_amount.mul(1e18) % totalLockedBBK).div(1e18);
    securedTokenDistributions[owner] = securedTokenDistributions[owner].add(_delta);
    totalSupply = totalSupply.add(_amount);
    Mint(_amount);
    return true;
  }

  // bumps dividendParadigm balance to securedFundsParadigm
  // ensures that BBK transfers will not affect ACT balance accrued
  function settlePerTokenToSecured(
    address _address
  )
    private
    returns (bool)
  {

    securedTokenDistributions[_address] = securedTokenDistributions[_address]
      .add(
        lockedBBK[_address]
        .mul(totalMintedPerToken.sub(distributedPerBBK[_address]))
        .div(1e18)
      );
    distributedPerBBK[_address] = totalMintedPerToken;

    return true;
  }

  // start ERC20 overrides

  // combines dividendParadigm, securedFundsParadigm, and doubleEntryParadigm
  // in order to give a correct balance
  function balanceOf(
    address _address
  )
    public
    view
    returns (uint256)
  {

    return totalMintedPerToken == 0
      ? 0
      : lockedBBK[_address]
      .mul(totalMintedPerToken.sub(distributedPerBBK[_address]))
      .div(1e18)
      .add(securedTokenDistributions[_address])
      .add(receivedBalances[_address])
      .sub(spentBalances[_address]);
  }

  // used to set balances[adr] to correct value
  // balances is not really used anywhere... might be best to just let them be
  // inaccurate?
  // this at least keeps them accurate when a transfer happens. Is not accurate
  // after a distribution or transfer... this is why balanceOf is used and
  // balances[adr] is private
  function injectCustomBalances(
    address _address,
    address  _address2
  )
    private
  {
    balances[_address] = balanceOf(_address);
    balances[_address2] = balanceOf(_address2);
  }

  // does the same thing as ERC20 transfer but...
  // uses balanceOf rather than balances[adr] (balances is inaccurate see above)
  // sets correct values for doubleEntryParadigm (see glossary)
  function transfer(
    address _to,
    uint256 _value
  )
    public
    whenNotPaused
    returns (bool)
  {
    require(_to != address(0));
    require(_value <= balanceOf(msg.sender));
    spentBalances[msg.sender] = spentBalances[msg.sender].add(_value);
    receivedBalances[_to] = receivedBalances[_to].add(_value);
    injectCustomBalances(msg.sender, _to);
    Transfer(msg.sender, _to, _value);
    return true;
  }

  // does the same thing as ERC20 transferFrom but...
  // uses balanceOf rather than balances[adr] (balances is inaccurate see above)
  // sets correct values for doubleEntryParadigm (see glossary)
  function transferFrom(
    address _from,
    address _to,
    uint256 _value
  )
    public
    whenNotPaused
    returns (bool)
  {
    require(_to != address(0));
    require(_value <= balanceOf(_from));
    require(_value <= allowed[_from][msg.sender]);
    spentBalances[_from] = spentBalances[_from].add(_value);
    receivedBalances[_to] = receivedBalances[_to].add(_value);
    allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
    injectCustomBalances(_from, _to);
    Transfer(_from, _to, _value);
    return true;
  }

  // end ERC20 overrides

  // callable only by FeeManager contract
  // burns tokens through incrementing spentBalances[adr] and decrements totalSupply
  // works with doubleEntryParadigm (see glossary)
  function burn(
    address _address,
    uint256 _value
  )
    external
    onlyContract("FeeManager")
    returns (bool)
  {
    require(_value <= balanceOf(_address));
    spentBalances[_address] = spentBalances[_address].add(_value);
    totalSupply = totalSupply.sub(_value);
    Burn(_address, _value);
    return true;
  }

}
