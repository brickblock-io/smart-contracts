pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/StandardToken.sol";


// Proof-of-Asset contract representing a token backed by a foreign asset.
contract POAToken is StandardToken {

  event Stage(Stages stage);
  event Buy(address buyer, uint256 amount);
  event Sell(address seller, uint256 amount);
  event Payout(uint256 amount);

  string public name;
  string public symbol;

  uint256 totalPayout = 0;

  uint8 public constant decimals = 18;

  address public owner;
  address public broker;
  address public custodian;

  // The time when the contract was created
  uint public creationTime;

  // The time available to fund the contract
  uint public timeout;

  struct Account {
    uint256 balance;
    uint256 claimedPayout;
  }

  mapping(address => Account) accounts;
  mapping(address => uint256) claimedPayouts;
  mapping(address => uint256) unliquidated;

  enum Stages {
    Funding,
    Pending,
    Failed,
    Active
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

  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  function enterStage(Stages _stage)
    private
  {
    stage = _stage;
    Stage(_stage);
  }

  // Ensure funding timeout hasn't expired
  modifier checkTimeout() {
    if (stage == Stages.Funding && now >= creationTime.add(timeout)) {
      enterStage(Stages.Failed);
    }
    _;
  }

  function POAToken
  (
    string _name,
    string _symbol,
    address _broker,
    address _custodian,
    uint _timeout,
    uint256 _supply
  )
    public
  {
    owner = msg.sender;
    name = _name;
    symbol = _symbol;
    broker = _broker;
    custodian = _custodian;
    timeout = _timeout;
    creationTime = now;
    totalSupply = _supply;
    balances[owner] = _supply;
  }

  // Buy PoA tokens from the contract.
  // Called by any investor during the `Funding` stage.
  function buy()
    payable
    public
    checkTimeout
    atStage(Stages.Funding)
  {
    // SafeMath will do these checks for us
    // require(accounts[owner].balance >= msg.value);
    // require(accounts[msg.sender].balance ` msg.value > accounts[msg.sender].balance);
    balances[owner] = balances[owner].sub(msg.value);
    balances[msg.sender] = balances[msg.sender].add(msg.value);
    Buy(msg.sender, msg.value);

    if (balances[owner] == 0) {
      enterStage(Stages.Pending);
    }
  }

  // Activate the PoA contract, providing a valid proof-of-assets.
  // Called by the broker or custodian after assets have been received into the DTF account.
  // This verifies that the provided signature matches the expected symbol/amount and
  // was made with the custodians private key.
  // TODO: don't need this here...
  function activate
  (
    uint8 _v,
    bytes32 _r,
    bytes32 _s
  )
    public
    checkTimeout
    atStage(Stages.Pending)
  {
    bytes32 hash = keccak256(symbol, bytes32(totalSupply));
    bytes memory prefix = "\x19Ethereum Signed Message:\n32";
    bytes32 prefixedHash = keccak256(prefix, hash);

    address sigaddr = ecrecover(
      prefixedHash,
      _v,
      _r,
      _s
    );

    if (sigaddr == custodian) {
      broker.transfer(this.balance);
      enterStage(Stages.Active);
    }
  }

  // Reclaim funds after failed funding run.
  // Called by any investor during the `Failed` stage.
  function reclaim()
    public
    checkTimeout
    atStage(Stages.Failed)
  {
    uint256 balance = balances[msg.sender];
    balances[msg.sender] = 0;
    msg.sender.transfer(balance);
  }

  // Sell PoA tokens back to the contract.
  // Called by any investor during the `Active` stage.
  // This will subtract the given `amount` from the users
  // token balance and saves it as unliquidated balance.
  function sell(uint256 _amount)
    public
    atStage(Stages.Active)
  {
    // SafeMath will do this check for us
    // require(accounts[msg.sender].balance >= amount);
    balances[msg.sender] = balances[msg.sender].sub(_amount);
    unliquidated[msg.sender] = unliquidated[msg.sender].add(_amount);
    Sell(msg.sender, _amount);
  }

   // Provide funds from liquidated assets.
   // Called by the broker after liquidating assets.
   // This checks if the user has unliquidated balances
   // and transfers the value to the user.
  function liquidated(address _account)
    payable
    public
    atStage(Stages.Active)
    onlyBroker
  {
    unliquidated[_account] = unliquidated[_account].sub(msg.value);
    totalSupply = totalSupply.sub(msg.value);
    _account.transfer(msg.value);
  }

  // Provide funds from a dividend payout.
  // Called by the broker after the asset yields dividends.
  // This will simply add the received value to the stored `payout`.
  function payout()
    payable
    public
    atStage(Stages.Active)
    onlyBroker
  {
    require(msg.value > 0);
    totalPayout = totalPayout.add(msg.value.mul(10e18).div(totalSupply));
    Payout(msg.value);
  }

  // TODO: verify internal is the correct one to use here...
  function currentPayout(uint256 _balance, uint256 _claimedPayout)
    internal
    returns (uint256)
  {
    uint256 totalUnclaimed = totalPayout.sub(_claimedPayout);
    return _balance.mul(totalUnclaimed).div(10e18);
  }

  // Claim dividend payout.
  // Called by any investor after dividends have been received.
  // This will calculate the payout, subtract any already claimed payouts,
  // update the claimed payouts for the given account, and send the payout.
  function claim()
    public
    atStage(Stages.Active)
  {
    uint256 payoutAmount = currentPayout(
      balances[msg.sender],
      claimedPayouts[msg.sender]
    );
    require(payoutAmount > 0);
    claimedPayouts[msg.sender] = totalPayout;
    msg.sender.transfer(payoutAmount);
  }

  // TODO: need to see about making this a standard ERC20 function... super???
  // Transfer `_value` from sender to account `_to`.
  function transfer(address _to, uint256 _value)
    public
    returns (bool)
  {
    // send any remaining unclaimed ETHER payouts to msg.sender
    uint256 payoutAmount = currentPayout(
      balances[msg.sender],
      claimedPayouts[msg.sender]
    );
    if (payoutAmount > 0) {
      msg.sender.transfer(payoutAmount);
    }

    // shift balances
    balances[msg.sender] = balances[msg.sender].sub(_value);
    balances[_to] = balances[_to].add(_value);

    // set claimed payouts to max for both accounts
    claimedPayouts[msg.sender] = totalPayout;
    claimedPayouts[_to] = totalPayout;

    Transfer(msg.sender, _to, _value);
    return true;
  }

  /*// Get balance of given address `_account`.
  function balanceOf(address _account)
    public
    constant
    returns (uint256 balance)
  {
    return accounts[_account].balance;
  }*/

  // TODO: needed to test dividend payouts until we implement real changing supply
  function debugSetSupply(uint256 _supply)
    public
    onlyOwner
  {
    totalSupply = _supply;
  }

}
