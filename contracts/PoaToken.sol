pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./PoaCommon.sol";

/* solium-disable security/no-low-level-calls */


/**
  @title This acts as a master copy for use with PoaProxy in conjunction
  with PoaCrowdsale. Storage is assumed to be set on PoaProxy through
  delegatecall in fallback function. This contract handles the
  token/dividends functionality of PoaProxy. Inherited PoaCommon dictates
  common storage slots as well as common functions used by both PoaToken
  and PoaCrowdsale.
*/
contract PoaToken is StandardToken, Ownable, PoaCommon {
  uint256 public constant tokenVersion = 1;

  /**********************************
  * start poaToken specific storage *
  **********************************/

  // ERC20 name of the token
  bytes32 private name32;
  // ERC20 symbol
  bytes32 private symbol32;
  // ERC0 decimals
  uint256 public constant decimals = 18;
  // the total per token payout rate: accumulates as payouts are received
  uint256 public totalPerTokenPayout;
  // used to enable/disable whitelist required transfers/transferFroms
  bool public whitelistTransfers;

  // used to deduct already claimed payouts on a per token basis
  mapping(address => uint256) public claimedPerTokenPayouts;
  // used to calculate balanceOf by deducting spent balances
  mapping(address => uint256) public spentBalances;
  // used to calculate balanceOf by adding received balances
  mapping(address => uint256) public receivedBalances;
  // hide balances to ensure that only balanceOf is being used
  mapping(address => uint256) private balances;

  /********************************
  * end poaToken specific storage *
  ********************************/

  event Pause();
  event Unpause();

  /******************
  * start modifiers *
  ******************/

  modifier eitherCustodianOrOwner() {
    owner = getContractAddress("PoaManager");
    require(
      msg.sender == custodian() ||
      msg.sender == owner
    );
    _;
  }

  modifier onlyOwner() {
    owner = getContractAddress("PoaManager");
    require(msg.sender == owner);
    _;
  }

  modifier isTransferWhitelisted
  (
    address _address
  ) {
    if (whitelistTransfers) {
      require(isWhitelisted(_address));
    }

    _;
  }

  modifier whenNotPaused() {
    require(!paused());
    _;
  }

  modifier whenPaused() {
    require(paused());
    _;
  }

  /****************
  * end modifiers *
  ****************/

  /**
    @notice Proxied contracts cannot have constructors. This works in place
    of the constructor in order to initialize the contract storage.
  */
  function initializeToken(
    bytes32 _name32, // bytes32 of name string
    bytes32 _symbol32, // bytes32 of symbol string
    address _broker,
    address _custodian,
    address _registry,
    uint256 _totalSupply // token total supply
  )
    external
    returns (bool)
  {
    // ensure initialize has not been called already
    require(!tokenInitialized());

    // validate initialize parameters
    require(_name32 != bytes32(0));
    require(_symbol32 != bytes32(0));
    require(_broker != address(0));
    require(_custodian != address(0));
    require(_registry != address(0));
    require(_totalSupply >= 1e18);

    // initialize sequential storage
    name32 = _name32;
    symbol32 = _symbol32;
    whitelistTransfers = false;
    owner = getContractAddress("PoaManager");

    // initialize non-sequential storage
    setBroker(_broker);
    setCustodian(_custodian);
    setRegistry(_registry);
    setTotalSupply(_totalSupply);
    setPaused(true);
    setTokenInitialized(true);

    return true;
  }

  /****************************
  * start lifecycle functions *
  ****************************/

  /// @notice function to change custodianship of poa
  function changeCustodianAddress
  (
    address _newCustodian
  )
    external
    onlyCustodian
    returns (bool)
  {
    require(_newCustodian != address(0));
    require(_newCustodian != custodian());
    address _oldCustodian = custodian();
    setCustodian(_newCustodian);
    getContractAddress("Logger").call(
      bytes4(keccak256("logCustodianChangedEvent(address,address)")),
      _oldCustodian,
      _newCustodian
    );
    return true;
  }

  /**
    @notice Used when asset should no longer be tokenized.
    Allows for winding down via payouts, and freeze trading
  */
  function terminate()
    external
    eitherCustodianOrOwner
    atStage(Stages.Active)
    returns (bool)
  {
    // set Stage to terminated
    enterStage(Stages.Terminated);
    // pause. Cannot be unpaused now that in Stages.Terminated
    setPaused(true);
    getContractAddress("Logger")
      .call(bytes4(keccak256("logTerminatedEvent()")));
    return true;
  }

  /**************************
  * end lifecycle functions *
  **************************/

  /************************
  * start owner functions *
  ************************/

  function pause()
    public
    onlyOwner
    whenNotPaused
  {
    setPaused(true);

    emit Pause();
  }

  function unpause()
    public
    onlyOwner
    whenPaused
    atStage(Stages.Active)
  {
    setPaused(false);
    emit Unpause();
  }

  /// @notice enables whitelisted transfers/transferFroms
  function toggleWhitelistTransfers()
    external
    onlyOwner
    returns (bool)
  {
    whitelistTransfers = !whitelistTransfers;
    return whitelistTransfers;
  }

  /**********************
  * end owner functions *
  **********************/

  /*************************
  * start getter functions *
  *************************/

  /// @notice returns string coverted from bytes32 representation of name
  function name()
    external
    view
    returns (string)
  {
    return to32LengthString(name32);
  }

  /// @notice returns strig converted from bytes32 representation of symbol
  function symbol()
    external
    view
    returns (string)
  {
    return to32LengthString(symbol32);
  }

  /***********************
  * end getter functions *
  ***********************/

  /*********************************
  * start payout related functions *
  *********************************/

  /// @notice get current payout for perTokenPayout and unclaimed
  function currentPayout
  (
    address _address,
    bool _includeUnclaimed
  )
    public
    view
    returns (uint256)
  {
    /**
      @dev Need to check if there have been no payouts, otherwise safe math
      will throw due to dividing by 0.
      The below variable represents the total payout from the per token rate pattern.
      It uses this funky naming pattern in order to differentiate from the unclaimedPayoutTotals
      which means something very different.
    */
    uint256 _totalPerTokenUnclaimedConverted = totalPerTokenPayout == 0
      ? 0
      : balanceOf(_address)
      .mul(totalPerTokenPayout.sub(claimedPerTokenPayouts[_address]))
      .div(1e18);

    /**
      @dev Balances may be bumped into unclaimedPayoutTotals in order to
      maintain balance tracking accross token transfers.
      Per token payout rates are stored * 1e18 in order to be kept accurate
      per token payout is / 1e18 at time of usage for actual Ξ balances
      `unclaimedPayoutTotals` are stored as actual Ξ value no need for rate * balance
    */
    return _includeUnclaimed
      ? _totalPerTokenUnclaimedConverted.add(unclaimedPayoutTotals(_address))
      : _totalPerTokenUnclaimedConverted;

  }

  /// @notice settle up perToken balances and move into unclaimedPayoutTotals in order
  /// to ensure that token transfers will not result in inaccurate balances
  function settleUnclaimedPerTokenPayouts
  (
    address _from,
    address _to
  )
    internal
    returns (bool)
  {
    // add perToken balance to unclaimedPayoutTotals which will not be affected by transfers
    setUnclaimedPayoutTotals(
      _from,
      unclaimedPayoutTotals(_from).add(currentPayout(_from, false))
    );
    // max out claimedPerTokenPayouts in order to effectively make perToken balance 0
    claimedPerTokenPayouts[_from] = totalPerTokenPayout;
    // same as above for to
    setUnclaimedPayoutTotals(
      _to,
      unclaimedPayoutTotals(_to).add(currentPayout(_to, false))
    );
    // same as above for to
    claimedPerTokenPayouts[_to] = totalPerTokenPayout;
    return true;
  }

  /// @notice send Ξ to contract to be claimed by token holders
  function payout()
    external
    payable
    atEitherStage(Stages.Active, Stages.Terminated)
    onlyBroker
    returns (bool)
  {
    // calculate fee based on feeRateInPermille
    uint256 _fee = calculateFee(msg.value);
    // ensure the value is high enough for a fee to be claimed
    require(_fee > 0);
    // deduct fee from payout
    uint256 _payoutAmount = msg.value.sub(_fee);
    /*
      totalPerTokenPayout is a rate at which to payout based on token balance.
      It is stored as * 1e18 in order to keep accuracy
      It is / 1e18 when used relating to actual Ξ values
    */
    totalPerTokenPayout = totalPerTokenPayout
      .add(_payoutAmount
        .mul(1e18)
        .div(totalSupply())
      );

    // take remaining dust and send to feeManager rather than leave stuck in
    // contract. should not be more than a few wei
    uint256 _delta = (_payoutAmount.mul(1e18) % totalSupply()).div(1e18);
    // pay fee along with any dust to FeeManager
    payFee(_fee.add(_delta));
    getContractAddress("Logger").call(
      bytes4(keccak256("logPayoutEvent(uint256)")),
      _payoutAmount.sub(_delta)
    );
    return true;
  }

  /// @notice claim total eth claimable for sender based on token holdings at time of each payout
  function claim()
    external
    atEitherStage(Stages.Active, Stages.Terminated)
    returns (uint256)
  {
    /*
      pass true to currentPayout in order to get both:
      - perToken payouts
      - unclaimedPayoutTotals
    */
    uint256 _payoutAmount = currentPayout(msg.sender, true);
    // check that there indeed is a pending payout for sender
    require(_payoutAmount > 0);
    // max out per token payout for sender in order to make payouts effectively
    // 0 for sender
    claimedPerTokenPayouts[msg.sender] = totalPerTokenPayout;
    // 0 out unclaimedPayoutTotals for user
    setUnclaimedPayoutTotals(msg.sender, 0);
    // transfer Ξ payable amount to sender
    msg.sender.transfer(_payoutAmount);
    getContractAddress("Logger").call(
      bytes4(keccak256("logClaimEvent(address,uint256)")),
      msg.sender,
      _payoutAmount
    );
    return _payoutAmount;
  }

  /// @notice allow ipfs hash to be updated when audit etc occurs
  function updateProofOfCustody
  (
    bytes32[2] _ipfsHash
  )
    external
    atEitherStage(Stages.Active, Stages.Terminated)
    onlyCustodian
    validIpfsHash(_ipfsHash)
    returns (bool)
  {
    setProofOfCustody32(_ipfsHash);
    getContractAddress("Logger").call(
      bytes4(keccak256("logProofOfCustodyUpdatedEvent(string)")),
      _ipfsHash
    );
    return true;
  }

  /*******************************
  * end payout related functions *
  *******************************/

  /************************
  * start ERC20 overrides *
  ************************/

  /// @notice used for calculating starting balance once activated
  function startingBalance
  (
    address _address
  )
    internal
    view
    returns (uint256)
  {
    if (isFiatInvestor(_address)) {
      return uint256(stage()) > 4
        ? fiatInvestmentPerUserInTokens(_address)
        : 0;
    } else {
      return uint256(stage()) > 4
        ? investmentAmountPerUserInWei(_address)
          .mul(
            totalSupply().sub(fundedAmountInTokensDuringFiatFunding())
          )
          .div(fundedAmountInWei())
        : 0;
    }
  }

  /// @notice ERC20 override uses NoobCoin pattern
  function balanceOf
  (
    address _address
  )
    public
    view
    returns (uint256)
  {
    return startingBalance(_address)
      .add(receivedBalances[_address])
      .sub(spentBalances[_address]);
  }

  /**
    @notice ERC20 transfer override:
    - uses NoobCoin pattern combined with settling payout balances
  */
  function transfer
  (
    address _to,
    uint256 _value
  )
    public
    whenNotPaused
    isTransferWhitelisted(_to)
    isTransferWhitelisted(msg.sender)
    returns (bool)
  {
    // move perToken payout balance to unclaimedPayoutTotals
    settleUnclaimedPerTokenPayouts(msg.sender, _to);

    require(_to != address(0));
    require(_value <= balanceOf(msg.sender));
    spentBalances[msg.sender] = spentBalances[msg.sender].add(_value);
    receivedBalances[_to] = receivedBalances[_to].add(_value);
    emit Transfer(msg.sender, _to, _value);
    return true;
  }

  /**
    @notice ERC20 transfer override:
    - uses NoobCoin pattern combined with settling payout balances
  */
  function transferFrom
  (
    address _from,
    address _to,
    uint256 _value
  )
    public
    whenNotPaused
    isTransferWhitelisted(_to)
    isTransferWhitelisted(_from)
    returns (bool)
  {
    // move perToken payout balance to unclaimedPayoutTotals
    settleUnclaimedPerTokenPayouts(_from, _to);

    require(_to != address(0));
    require(_value <= balanceOf(_from));
    require(_value <= allowed[_from][msg.sender]);
    spentBalances[_from] = spentBalances[_from].add(_value);
    receivedBalances[_to] = receivedBalances[_to].add(_value);
    allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
    emit Transfer(_from, _to, _value);
    return true;
  }

  function approve
  (
    address _spender,
    uint256 _value
  )
    public
    whenNotPaused
    returns (bool)
  {
    return super.approve(_spender, _value);
  }

  function increaseApproval
  (
    address _spender,
    uint _addedValue
  )
    public
    whenNotPaused
    returns (bool success)
  {
    return super.increaseApproval(_spender, _addedValue);
  }

  function decreaseApproval
  (
    address _spender,
    uint _subtractedValue
  )
    public
    whenNotPaused
    returns (bool success)
  {
    return super.decreaseApproval(_spender, _subtractedValue);
  }

  /************************
  * start ERC20 overrides *
  ************************/

  /// @notice forward any non-matching function calls to poaCrowdsaleMaster
  function()
    external
    payable
  {
    address _poaCrowdsaleMaster = poaCrowdsaleMaster();
    assembly {

      // calldatacopy(t, f, s)
      calldatacopy(
        0x0, // t = mem position to
        0x0, // f = mem position from
        calldatasize // s = size bytes
      )

      // delegatecall(g, a, in, insize, out, outsize) => 0 on error 1 on success
      let result := delegatecall(
        gas, // g = gas
        _poaCrowdsaleMaster, // a = address
        0x0, // in = mem in  mem[in..(in+insize)
        calldatasize, // insize = mem insize  mem[in..(in+insize)
        0x0, // out = mem out  mem[out..(out+outsize)
        0 // outsize = mem outsize  mem[out..(out+outsize)
      )

      // returndatacopy(t, f, s)
      returndatacopy(
        0x0, // t = mem position to
        0x0,  // f = mem position from
        returndatasize // s = size bytes
      )

      // check if call was a success and return if no errors & revert if errors
      if iszero(result) {
        revert(0, 0)
      }

        return(
          0x0,
          returndatasize
        )
    }
  }
}
