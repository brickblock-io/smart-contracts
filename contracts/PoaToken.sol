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
contract PoaToken is PoaCommon {
  uint256 public constant tokenVersion = 1;

  /**********************************
  * start poaToken specific storage *
  **********************************/

  // ERC20 name of the token
  bytes32 private name32;
  // ERC20 symbol
  bytes32 private symbol32;
  // ERC0 decimals
  uint8 public constant decimals = 18;
  // the total per token payout rate: accumulates as payouts are received
  uint256 public totalPerTokenPayout;
  // the onwer of the contract
  address public owner;
  // used for deducting already claimed payouts on a per token basis
  mapping(address => uint256) public claimedPerTokenPayouts;
  // used for calculating balanceOf by deducting spent balances
  mapping(address => uint256) public spentBalances;
  // used for calculating balanceOf by adding received balances
  mapping(address => uint256) public receivedBalances;
  // allowance of spender to spend owners tokens
  mapping (address => mapping (address => uint256)) internal allowed;
  // used in order to enable/disable whitelist required transfers/transferFroms
  bool public whitelistTransfers;

  /********************************
  * end poaToken specific storage *
  ********************************/

  /************************************
  * start non-centrally logged events *
  ************************************/

  event Pause();
  event Unpause();
  event OwnershipTransferred(
    address indexed previousOwner,
    address indexed newOwner
  );
  event Approval(
    address indexed owner,
    address indexed spender,
    uint256 value
  );
  event Transfer(
    address indexed from,
    address indexed to,
    uint256 value
  );

  /**********************************
  * end non-centrally logged events *
  **********************************/

  /******************
  * start modifiers *
  ******************/

  modifier onlyOwner() {
    owner = getContractAddress("PoaManager");
    require(msg.sender == owner);
    _;
  }

  modifier whenNotPaused() {
    require(!paused);
    _;
  }

  modifier whenPaused() {
    require(paused);
    _;
  }

  modifier eitherCustodianOrOwner() {
    owner = getContractAddress("PoaManager");
    require(
      msg.sender == custodian ||
      msg.sender == owner
    );
    _;
  }

  modifier eitherBrokerOrCustodian() {
    require(
      msg.sender == broker ||
      msg.sender == custodian
    );
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
    require(!tokenInitialized);

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
    broker = _broker;
    custodian = _custodian;
    registry = _registry;
    totalSupply_ = _totalSupply;
    paused = true;
    tokenInitialized = true;

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
    require(_newCustodian != custodian);
    address _oldCustodian = custodian;
    custodian = _newCustodian;
    getContractAddress("PoaLogger").call(
      bytes4(keccak256("logCustodianChanged(address,address)")),
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
    paused = true;
    getContractAddress("PoaLogger")
      .call(bytes4(keccak256("logTerminated()")));
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
    paused = true;

    emit Pause();
  }

  function unpause()
    public
    onlyOwner
    whenPaused
    atStage(Stages.Active)
  {
    paused = false;
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

  function totalSupply()
    public
    view
    returns (uint256)
  {
    return totalSupply_;
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
      ? _totalPerTokenUnclaimedConverted.add(unclaimedPayoutTotals[_address])
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
    unclaimedPayoutTotals[_from] = unclaimedPayoutTotals[_from]
      .add(currentPayout(_from, false));
    // max out claimedPerTokenPayouts in order to effectively make perToken balance 0
    claimedPerTokenPayouts[_from] = totalPerTokenPayout;
    // same as above for to
    unclaimedPayoutTotals[_to] = unclaimedPayoutTotals[_to]
      .add(currentPayout(_to, false));
    // same as above for to
    claimedPerTokenPayouts[_to] = totalPerTokenPayout;
    return true;
  }

  /// @notice send Ξ to contract to be claimed by token holders
  function payout()
    external
    payable
    eitherBrokerOrCustodian
    atEitherStage(Stages.Active, Stages.Terminated)
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
        .div(totalSupply_)
      );

    // take remaining dust and send to feeManager rather than leave stuck in
    // contract. should not be more than a few wei
    uint256 _delta = (_payoutAmount.mul(1e18) % totalSupply_).div(1e18);
    // pay fee along with any dust to FeeManager
    payFee(_fee.add(_delta));
    getContractAddress("PoaLogger").call(
      bytes4(keccak256("logPayout(uint256)")),
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
    unclaimedPayoutTotals[msg.sender] = 0;
    // transfer Ξ payable amount to sender
    msg.sender.transfer(_payoutAmount);
    getContractAddress("PoaLogger").call(
      bytes4(keccak256("logClaim(address,uint256)")),
      msg.sender,
      _payoutAmount
    );
    return _payoutAmount;
  }

  /**
   @notice Allow proof-of-custody IPFS hash to be updated.
     This is used for both initial upload as well as changing
     or adding more documents later. The first proof-of-custody
     will be a legal document in which the custodian certifies
     that have received the actual securities that this contract
     tokenizes.
   */

  function updateProofOfCustody
  (
    bytes32[2] _ipfsHash
  )
    external
    onlyCustodian
    validIpfsHash(_ipfsHash)
    returns (bool)
  {
    require(
      stage == Stages.Active || stage == Stages.FundingSuccessful || stage == Stages.Terminated
    );
    proofOfCustody32_ = _ipfsHash;
    getContractAddress("PoaLogger").call(
      bytes4(keccak256("logProofOfCustodyUpdated()")),
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
      // Token balances will only show in "Active" stage
      // and "Terminated" stage. Why also in "Terminated"?
      // Because there can still be pending payouts
      return uint256(stage) > 5
        ? fundedFiatAmountPerUserInTokens[_address]
        : 0;
    } else {
      return uint256(stage) > 5
        ? fundedEthAmountPerUserInWei[_address]
          .mul(
            totalSupply_.sub(fundedFiatAmountInTokens)
          )
          .div(fundedEthAmountInWei)
        : 0;
    }
  }

  /// @notice ERC20 compliant balanceOf: uses NoobCoin pattern: https://github.com/TovarishFin/NoobCoin
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
    @notice ERC20 compliant transfer:
    - uses NoobCoin pattern combined with settling payout balances: https://github.com/TovarishFin/NoobCoin
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
    @notice ERC20 compliant transferFrom:
    - uses NoobCoin pattern combined with settling payout balances: https://github.com/TovarishFin/NoobCoin
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

  /**
    @notice ERCO compliant approve
  */
  function approve
  (
    address _spender,
    uint256 _value
  )
    public
    whenNotPaused
    returns (bool)
  {
    allowed[msg.sender][_spender] = _value;
    emit Approval(msg.sender, _spender, _value);
    return true;
  }

  /**
    @notice openZeppelin implementation of increaseApproval
  */
  function increaseApproval
  (
    address _spender,
    uint _addedValue
  )
    public
    whenNotPaused
    returns (bool success)
  {
    allowed[msg.sender][_spender] = (
      allowed[msg.sender][_spender].add(_addedValue));
    emit Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
    return true;
  }

  /**
    @notice openZeppelin implementation of decreaseApproval
  */
  function decreaseApproval
  (
    address _spender,
    uint _subtractedValue
  )
    public
    whenNotPaused
    returns (bool success)
  {
    uint256 oldValue = allowed[msg.sender][_spender];
    if (_subtractedValue > oldValue) {
      allowed[msg.sender][_spender] = 0;
    } else {
      allowed[msg.sender][_spender] = oldValue.sub(_subtractedValue);
    }
    emit Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
    return true;
  }

  /**
  @notice ERC20 compliant allowance
  */
  function allowance(
    address _owner,
    address _spender
   )
    public
    view
    returns (uint256)
  {
    return allowed[_owner][_spender];
  }

  /************************
  * start ERC20 overrides *
  ************************/

  /// @notice forward any non-matching function calls to poaCrowdsaleMaster
  function()
    external
    payable
  {
    assembly {
      // load value using *_slot suffix
      let _poaCrowdsaleMaster := sload(poaCrowdsaleMaster_slot)
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

      // check if call was a success and return if no errors & revert if errors
      if iszero(result) {
        revert(0, 0)
      }

      // returndatacopy(t, f, s)
      returndatacopy(
        0x0, // t = mem position to
        0x0,  // f = mem position from
        returndatasize // s = size bytes
      )

      return(
        0x0,
        returndatasize
      )
    }
  }
}
