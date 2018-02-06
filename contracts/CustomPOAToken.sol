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
  // the total per token payout rate: accumulates as payouts are received
  uint256 public totalPerTokenPayout;
  uint256 public tokenSaleRate;
  uint256 public fundingGoal;
  uint256 public initialSupply;
  // ‰ permille NOT percent
  uint256 public constant feeRate = 5;

  // self contained whitelist on contract, must be whitelisted to buy
  mapping (address => bool) public whitelisted;
  mapping(address => uint256) public claimedPerTokenPayouts;
  // fallback for when a transfer happens with payouts remaining
  mapping(address => uint256) public unclaimedPayoutTotals;

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
  event Claim(uint256 payout);
  event Terminated();

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
    uint256 _timeoutBlock,
    uint256 _totalSupply,
    uint256 _fundingGoal
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
    // essentially sqm unit of building...
    totalSupply = _totalSupply;
    initialSupply = _totalSupply;
    fundingGoal = _fundingGoal;
    balances[this] = _totalSupply;
    paused = true;
  }

  // start token conversion functions

  /*******************
  * TKN      supply  *
  * ---  =  -------  *
  * ETH     funding  *
  *******************/

  function ethToTokens(uint256 _ethAmount)
    public
    view
    returns (uint256)
  {
    return _ethAmount.mul(1e18).mul(initialSupply).div(fundingGoal).div(1e18);
  }

  function tokensToEth(uint256 _tokenAmount)
    public
    view
    returns (uint256)
  {
    return _tokenAmount.mul(fundingGoal).mul(1e18).div(initialSupply).div(1e18);
  }

  // end token conversion functions

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
    external
    onlyOwner
    atStage(Stages.Funding)
  {
    require(whitelisted[_address] != true);
    whitelisted[_address] = true;
  }

  function blacklistAddress(address _address)
    external
    onlyOwner
    atStage(Stages.Funding)
  {
    require(whitelisted[_address] != false);
    whitelisted[_address] = false;
  }

  function whitelisted(address _address)
    public
    view
    returns (bool)
  {
    return whitelisted[_address];
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
    uint256 _buyAmount = ethToTokens(msg.value);
    balances[this] = balances[this].sub(_buyAmount);
    if (this.balance >= fundingGoal) {
      uint256 _unsoldBalance = balances[this];
      balances[this] = 0;
      _buyAmount = _buyAmount.add(_unsoldBalance);
      enterStage(Stages.Pending);
    }

    balances[msg.sender] = balances[msg.sender].add(_buyAmount);
    Buy(msg.sender, _buyAmount);

    return true;
  }

  function activate()
    external
    checkTimeout
    onlyCustodian
    payable
    atStage(Stages.Pending)
    returns (bool)
  {
    uint256 _fee = calculateFee(fundingGoal);
    require(msg.value == _fee);
    enterStage(Stages.Active);
    unclaimedPayoutTotals[owner] = unclaimedPayoutTotals[owner].add(_fee);
    unclaimedPayoutTotals[custodian] = unclaimedPayoutTotals[custodian].add(fundingGoal);
    paused = false;
    Unpause();
    return true;
  }

  function terminate()
    external
    onlyCustodian
    atStage(Stages.Active)
    returns (bool)
  {
    enterStage(Stages.Terminated);
    paused = true;
    Terminated();
  }

  function kill()
    external
    onlyOwner
  {
    paused = true;
    enterStage(Stages.Terminated);
    owner.transfer(this.balance);
    Terminated();
  }

  // end lifecycle functions

  // start payout related functions
  function currentPayout(address _address, bool _includeUnclaimed)
    public
    view
    returns (uint256)
  {
    /*
      need to check if there have been no payouts
      safe math will throw otherwise due to dividing 0

      The below variable represents the total payout from the per token rate pattern
      it uses this funky naming pattern in order to differentiate from the unclaimedPayoutTotals
      which means something very different.
    */
    uint256 _totalPerTokenUnclaimedConverted = totalPerTokenPayout == 0
      ? 0
      : balances[_address]
      .mul(totalPerTokenPayout.sub(claimedPerTokenPayouts[_address]))
      .div(1e18);

    /*
    balances may be bumped into unclaimedPayoutTotals in order to
    maintain balance tracking accross token transfers

    perToken payout rates are stored * 1e18 in order to be kept accurate
    perToken payout is / 1e18 at time of usage for actual ether balances
    unclaimedPayoutTotals are stored as actual ether value
      no need for rate * balance
    */
    return _includeUnclaimed
      ? _totalPerTokenUnclaimedConverted.add(unclaimedPayoutTotals[_address])
      : _totalPerTokenUnclaimedConverted;

  }

  function settleUnclaimedPerTokenPayouts(address _from, address _to)
    private
    returns (bool)
  {
    unclaimedPayoutTotals[_from] = unclaimedPayoutTotals[_from].add(currentPayout(_from, false));
    claimedPerTokenPayouts[_from] = totalPerTokenPayout;
    unclaimedPayoutTotals[_to] = unclaimedPayoutTotals[_to].add(currentPayout(_to, false));
    claimedPerTokenPayouts[_to] = totalPerTokenPayout;
    return true;
  }

  function reclaim()
    external
    checkTimeout
    atStage(Stages.Failed)
    returns (bool)
  {
    uint256 _balance = balances[msg.sender];
    require(_balance > 0);
    balances[msg.sender] = 0;
    totalSupply = totalSupply.sub(_balance);
    msg.sender.transfer(tokensToEth(_balance));
    return true;
  }

  function payout()
    external
    payable
    atEitherStage(Stages.Active, Stages.Terminated)
    onlyCustodian
    returns (bool)
  {
    require(msg.value > 0);
    uint256 _fee = calculateFee(msg.value);
    uint256 _payoutAmount = msg.value.sub(_fee);
    /*
    totalPerTokenPayout is a rate at which to payout based on token balance
    it is stored as * 1e18 in order to keep accuracy
    it is  / 1e18 when used relating to actual ether values
    */
    totalPerTokenPayout = totalPerTokenPayout
      .add(_payoutAmount
        .mul(1e18)
        .div(totalSupply)
      );

    // take remaining dust and send to owner rather than leave stuck in contract
    // should not be more than a few wei
    uint256 _delta = (_payoutAmount.mul(1e18) % totalSupply).div(1e18);
    unclaimedPayoutTotals[owner] = unclaimedPayoutTotals[owner].add(_fee.add(_delta));

    Payout(_payoutAmount);
    return true;
  }

  function claim()
    external
    atEitherStage(Stages.Active, Stages.Terminated)
    returns (uint256)
  {
    /*
    pass true to currentPayout in order to get both:
      perToken payouts
      unclaimedPayoutTotals
    */
    uint256 _payoutAmount = currentPayout(msg.sender, true);
    require(_payoutAmount > 0);
    claimedPerTokenPayouts[msg.sender] = totalPerTokenPayout;
    unclaimedPayoutTotals[msg.sender] = 0;

    Claim(_payoutAmount);
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
    require(settleUnclaimedPerTokenPayouts(msg.sender, _to));
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
    require(settleUnclaimedPerTokenPayouts(_from, _to));
    return super.transferFrom(_from, _to, _value);
  }

  // end ERC20 overrides

  // check if there is a way to get around gas issue when no gas limit calculated...
  // fallback function defaulting to buy
  function()
    public
    payable
  {
    buy();
  }
}
