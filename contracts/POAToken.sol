pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/StandardToken.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./BrickblockAccessToken.sol";
import "./BrickblockWhitelist.sol";


// Proof-of-Asset contract representing a token backed by a foreign asset.
contract POAToken is StandardToken, Ownable {

  BrickblockWhitelist brickblockWhitelist;
  BrickblockAccessToken brickblockAccessToken;

  event Stage(Stages stage);
  event Buy(address buyer, uint256 amount);
  event Sell(address seller, uint256 amount);
  event Payout(uint256 amount);

  string public name;
  string public symbol;

  uint8 public constant decimals = 18;

  address public owner;
  address public broker;
  address public custodian;

  // The time when the contract was created
  uint256 public creationBlock;

  // The time available to fund the contract
  uint256 public timeoutBlock;

  uint256 public constant feePercentage = 5;

  struct Account {
    uint256 balance;
    uint256 claimedPayout;
  }

  mapping(address => Account) accounts;
  mapping(address => uint256) claimedPayouts;

  uint256 public totalPayout = 0;

  enum Stages {
    Funding,
    Pending,
    Failed,
    Active,
    Terminated
  }

  Stages public stage = Stages.Funding;

  modifier atStage(Stages _stage) {
    require(stage == _stage);
    _;
  }

  modifier onlyBroker() {
    require(msg.sender == broker);
    _;
  }

  modifier onlyCustodian() {
    require(msg.sender == custodian);
    _;
  }

  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  modifier isWhitelisted() {
    require(brickblockWhitelist.whitelisted(msg.sender));
    _;
  }

  function enterStage(Stages _stage)
    private
  {
    stage = _stage;
    Stage(_stage);
  }

  // Ensure funding timeoutBlock hasn't expired
  modifier checkTimeout() {
    if (stage == Stages.Funding && block.number >= creationBlock.add(timeoutBlock)) {
      enterStage(Stages.Failed);
    }
    _;
  }

  // Create a new POAToken contract.
  function POAToken(
    string _name,
    string _symbol,
    address _broker,
    address _custodian,
    uint _timeoutBlock,
    uint256 _supply
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
    totalSupply = _supply;
    balances[owner] = _supply;
  }

  // TODO: this function is temporary until registry contract is created... remove later!
  function changeWhitelist(address _address)
    public
    onlyOwner
    returns (bool)
  {
    brickblockWhitelist = BrickblockWhitelist(_address);
    return true;
  }

  // TODO: this function is temporary until registry contract is created... remove later!
  function changeAccessToken(address _address)
    public
    onlyOwner
    returns (bool)
  {
    brickblockAccessToken = BrickblockAccessToken(_address);
    return true;
  }

  function calculateFee(uint256 _value)
    public
    view
    returns (uint256)
  {
    return feePercentage.mul(_value).div(1000);
  }

  // Used to charge fees for broker transactions
  function burnAccessTokens(uint256 _value, address _broker)
    private
    returns (bool)
  {
    require(address(brickblockAccessToken) != address(0));
    return brickblockAccessToken.burnFrom(_value, _broker);
  }

  // Buy PoA tokens from the contract.
  // Called by any investor during the `Funding` stage.
  function buy()
    payable
    public
    checkTimeout
    atStage(Stages.Funding)
    isWhitelisted
    returns (bool)
  {
    balances[owner] = balances[owner].sub(msg.value);
    balances[msg.sender] = balances[msg.sender].add(msg.value);
    Buy(msg.sender, msg.value);

    if (balances[owner] == 0) {
      enterStage(Stages.Pending);
    }
    return true;
  }

  // Activate the PoA contract, providing a valid proof-of-assets.
  // Called by the broker or custodian after assets have been received into the DTF account.
  // This verifies that the provided signature matches the expected symbol/amount and
  // was made with the custodians private key.
  // TODO: don't need this here...
  function activate()
    public
    onlyCustodian
    checkTimeout
    atStage(Stages.Pending)
    returns (bool)
  {
    broker.transfer(this.balance);
    enterStage(Stages.Active);
    return true;
  }

  // end the token due to asset getting sold/lost/act of god
  function terminate()
    public
    onlyBroker
    atStage(Stages.Active)
    payable
    returns (bool)
  {
    require(stage == Stages.Pending || stage == Stages.Active);
    require(msg.value == totalSupply);
    uint256 _fee = calculateFee(msg.value);
    require(burnAccessTokens(_fee, msg.sender));
    enterStage(Stages.Terminated);
  }

  // Reclaim funds after failed funding run.
  // Called by any investor during the `Failed` stage.
  function reclaim()
    public
    checkTimeout
    returns (bool)
  {
    require(stage == Stages.Failed || stage == Stages.Terminated);
    uint256 balance = balances[msg.sender];
    balances[msg.sender] = 0;
    totalSupply.sub(balance);
    msg.sender.transfer(balance);
    return true;
  }

  // Provide funds from a dividend payout.
  // Called by the broker after the asset yields dividends.
  // This will simply add the received value to the stored `payout`.
  function payout()
    payable
    public
    atStage(Stages.Active)
    onlyBroker
    returns (bool)
  {
    require(msg.value > 0);
    uint256 _fee = calculateFee(msg.value);
    require(burnAccessTokens(_fee, msg.sender));
    totalPayout = totalPayout.add(msg.value.mul(10e18).div(totalSupply));
    Payout(msg.value);
    return true;
  }

  function currentPayout(address _address)
    public
    view
    returns (uint256)
  {
    uint256 _balance = balances[_address];
    uint256 _claimedPayout = claimedPayouts[_address];
    uint256 _totalUnclaimed = totalPayout.sub(_claimedPayout);
    return _balance.mul(_totalUnclaimed).div(10e18);
  }

  // Claim dividend payout.
  // Called by any investor after dividends have been received.
  // This will calculate the payout, subtract any already claimed payouts,
  // update the claimed payouts for the given account, and send the payout.
  function claim()
    public
    atStage(Stages.Active)
    returns (uint256)
  {
    uint256 _payoutAmount = currentPayout(msg.sender);
    require(_payoutAmount > 0);
    claimedPayouts[msg.sender] = totalPayout;
    msg.sender.transfer(_payoutAmount);
    return _payoutAmount;
  }

  // TODO: needs to only work during Active stage i think...
  // Transfer +_value+ from sender to account +_to+.
  function transfer(address _to, uint256 _value)
    public
    returns (bool)
  {
    // send any remaining unclaimed ETHER payouts to msg.sender
    uint256 payoutAmount = currentPayout(msg.sender);
    if (payoutAmount > 0) {
      msg.sender.transfer(payoutAmount);
      // set claimed payouts to max for both accounts
      claimedPayouts[msg.sender] = totalPayout;
      claimedPayouts[_to] = totalPayout;
    }
    super.transfer(_to, _value);
  }

  function()
    public
    payable
  {
    buy();
  }

}
