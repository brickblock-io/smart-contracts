pragma solidity 0.4.18;

import "zeppelin-solidity/contracts/token/PausableToken.sol";


contract CustomPOAToken is PausableToken {

  string public name;
  string public symbol;

  uint8 public constant decimals = 18;

  address public owner;
  address public broker;
  address public custodian;

  uint256 public creationBlock;
  uint256 public timeoutBlock;
  uint256 public totalTokenPayout;
  // rate is .05 percent
  uint256 public constant feeRate = 5;

  mapping (address => bool) public whitelisted;
  mapping(address => uint256) public claimedPayouts;
  // fallback for when a transfer happens with payouts remaining
  mapping(address => uint256) public unclaimedPayouts;

  enum Stages {
    Funding,
    Pending,
    Failed,
    Active,
    Terminated
  }

  Stages public stage = Stages.Funding;

  event Stage(Stages stage);
  event Buy(address buyer, uint256 amount);
  event Payout(uint256 amount);

  modifier isWhitelisted() {
    require(whitelisted[msg.sender]);
    _;
  }

  modifier onlyCustodian() {
    require(msg.sender == custodian);
    _;
  }

  // start stage related modifiers
  modifier atStage(Stages _stage) {
    require(stage == _stage);
    _;
  }

  modifier atEitherStage(Stages _stage, Stages _orStage) {
    require(stage == _stage || stage == _orStage);
    _;
  }

  modifier checkTimeout() {
    if (stage == Stages.Funding && block.number >= creationBlock.add(timeoutBlock)) {
      uint256 _unsoldBalance = balances[this];
      balances[this] = 0;
      totalSupply = totalSupply.sub(_unsoldBalance);
      enterStage(Stages.Failed);
    }
    _;
  }
  // end stage related modifiers

  function CustomPOAToken
  (
    string _name,
    string _symbol,
    address _broker,
    address _custodian,
    uint _timeoutBlock,
    uint256 _totalSupply
  )
    public
  {
    owner = msg.sender;
    name = _name;
    symbol = _symbol;
    broker = _broker;
    custodian = _custodian;
    timeoutBlock = _timeoutBlock;
    creationBlock = block.number;
    totalSupply = _totalSupply;
    balances[this] = _totalSupply;
    paused = true;
  }

  // pause override
  function unpause()
    public
    onlyOwner
    whenPaused
  {
    require(stage == Stages.Active);
    return super.unpause();
  }

  // stage related functions
  function enterStage(Stages _stage)
    private
  {
    stage = _stage;
    Stage(_stage);
  }

  // start whitelist related functions
  function whitelistAddress(address _address)
    public
    onlyOwner
    atStage(Stages.Funding)
  {
    require(whitelisted[_address] != true);
    whitelisted[_address] = true;
  }

  function blacklistAddress(address _address)
    public
    onlyOwner
    atStage(Stages.Funding)
  {
    require(whitelisted[_address] != false);
    whitelisted[_address] = false;
  }

  // end whitelist related functions

  // start fee handling functions
  function calculateFee(uint256 _value)
    public
    view
    returns (uint256)
  {
    return feeRate.mul(_value).div(1000);
  }

  // end fee handling functions

  // start lifecycle functions
  function buy()
    public
    payable
    checkTimeout
    atStage(Stages.Funding)
    isWhitelisted
    returns (bool)
  {
    balances[this] = balances[this].sub(msg.value);
    balances[msg.sender] = balances[msg.sender].add(msg.value);
    Buy(msg.sender, msg.value);

    if (balances[this] == 0) {
      enterStage(Stages.Pending);
    }
    return true;
  }

  function activate()
    public
    checkTimeout
    onlyCustodian
    payable
    atStage(Stages.Pending)
    returns (bool)
  {
    uint256 _fee = calculateFee(totalSupply);
    require(msg.value == _fee);
    // TODO: do we need to do checks on these transfers to make sure they go through?
    owner.transfer(_fee);
    // TODO: should this be custodian or broker getting the ether?
    custodian.transfer(totalSupply);
    paused = false;
    Unpause();
    enterStage(Stages.Active);
    return true;
  }

  // TODO: who should be able to terminate? custodian? owner? both?
  function terminate()
    public
    onlyCustodian
    atStage(Stages.Active)
    returns (bool)
  {
    enterStage(Stages.Terminated);
    paused = true;
    Pause();
  }

  // end lifecycle functions

  // start payout related functions
  function currentPayout(address _address, bool _includeUnclaimed)
    public
    view
    returns (uint256)
  {
    if (totalTokenPayout == 0) {
      return 0;
    }
    uint256 _balance = balances[_address];
    uint256 _claimedPayouts = claimedPayouts[_address];
    uint256 _totalUnclaimed = totalTokenPayout
      .sub(_claimedPayouts);

    return _includeUnclaimed
      ? _balance
      .mul(_totalUnclaimed)
      .div(1e18)
      .add(unclaimedPayouts[_address])
      : _balance
      .mul(_totalUnclaimed)
      .div(1e18);

  }

  function settleUnclaimedPayouts(address _from, address _to)
    private
    returns (bool)
  {
    unclaimedPayouts[_from] = unclaimedPayouts[_from].add(currentPayout(_from, false));
    claimedPayouts[_from] = totalTokenPayout;
    unclaimedPayouts[_to] = unclaimedPayouts[_to].add(currentPayout(_to, false));
    claimedPayouts[_to] = totalTokenPayout;
    return true;
  }

  function reclaim()
    public
    checkTimeout
    atStage(Stages.Failed)
    returns (bool)
  {
    uint256 _balance = balances[msg.sender];
    require(_balance > 0);
    balances[msg.sender] = 0;
    totalSupply = totalSupply.sub(_balance);
    msg.sender.transfer(_balance);
    return true;
  }

  function payout()
    public
    payable
    atEitherStage(Stages.Active, Stages.Terminated)
    onlyCustodian
    returns (bool)
  {
    require(msg.value > 0);
    uint256 _fee = calculateFee(msg.value);
    uint256 _payoutAmount = msg.value.sub(_fee);
    totalTokenPayout = totalTokenPayout.add(_payoutAmount.mul(1e18).div(totalSupply));
    owner.transfer(_fee);
    Payout(_payoutAmount);
    return true;
  }

  function claim()
    public
    atEitherStage(Stages.Active, Stages.Terminated)
    returns (uint256)
  {
    uint256 _payoutAmount = currentPayout(msg.sender, true);
    require(_payoutAmount > 0);
    claimedPayouts[msg.sender] = totalTokenPayout;
    unclaimedPayouts[msg.sender] = 0;
    msg.sender.transfer(_payoutAmount);
    return _payoutAmount;
  }

  // end payout related functions

  // start ERC20 overrides
  function transfer
  (
    address _to,
    uint256 _value
  )
    public
    whenNotPaused
    returns (bool)
  {
    require(settleUnclaimedPayouts(msg.sender, _to));
    return super.transfer(_to, _value);
  }

  function transferFrom
  (
    address _from,
    address _to,
    uint256 _value
  )
    public
    whenNotPaused
    returns (bool)
  {
    require(settleUnclaimedPayouts(_from, _to));
    return super.transferFrom(_from, _to, _value);
  }

  // end ERC20 overrides

  // fallback function defaulting to buy
  function()
    public
    payable
  {
    buy();
  }
}
