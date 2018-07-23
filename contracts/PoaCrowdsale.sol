pragma solidity 0.4.23;

import "./PoaCommon.sol";

/* solium-disable security/no-block-members */
/* solium-disable security/no-low-level-calls */


/**
  @title This contract acts as a master copy for use with PoaProxy in conjunction
  with PoaToken. Storage is assumed to be set on PoaProxy through
  delegatecall in fallback function. This contract handles the
  crowdsale functionality of PoaProxy. Inherited PoaCommon dictates
  common storage slots as well as common functions used by both PoaToken
  and PoaCrowdsale.
*/
contract PoaCrowdsale is PoaCommon {

  uint256 public constant crowdsaleVersion = 1;

  // Number of digits included during the percent calculation
  uint256 public constant precisionOfPercentCalc = 18;

  /*********************************************
  * start special hashed PoaCrowdsale pointers *
  *********************************************/

  /**
    These are non-sequential storage slots used in order to not override
    PoaProxy storage. It is needed for any contract which is the target
    of a second level delegate call. There is no sequential storage on
    this contract in order to avoid these collisions.
  */

  // TYPE: bool
  // Bool indicating whether or not crowdsale proxy has been initialized
  bytes32 private constant crowdsaleInitializedSlot = keccak256("crowdsaleInitialized");
  // TYPE: uint256
  // Used for checking when contract should move from PreFunding or FiatFunding to Funding stage
  bytes32 private constant startTimeSlot = keccak256("startTime");
  // TYPE: uint256
  // Amount of seconds until moving to Failed from Funding stage after startTime
  bytes32 private constant fundingTimeoutSlot = keccak256("fundingTimeout");
  // TYPE: uint256
  // Amount of seconds until moving to Failed from Pending stage after startTime + fundingTimeout
  bytes32 private constant activationTimeoutSlot = keccak256("activationTimeout");
  // TYPE: bytes32
  // bytes32 representation fiat currency symbol used to get rate
  bytes32 private constant fiatCurrency32Slot = keccak256("fiatCurrency32");
  // TYPE: uint256
  // Amount needed before moving to pending calculated in fiat
  bytes32 private constant fundingGoalInCentsSlot = keccak256("fundingGoalInCents");
  // TYPE: uint256
  // Used for keeping track of actual funded amount in fiat during FiatFunding stage
  bytes32 private constant fundedAmountInCentsDuringFiatFundingSlot
  = keccak256("fundedAmountInCentsDuringFiatFunding");

  /*******************************************
  * end special hashed PoaCrowdsale pointers *
  *******************************************/

  event Unpause();

  /******************
  * start modifiers *
  ******************/

  /// @notice Ensure that the contract has not timed out
  modifier checkTimeout() {
    uint256 fundingTimeoutDeadline = startTime().add(fundingTimeout());
    uint256 activationTimeoutDeadline = startTime()
      .add(fundingTimeout())
      .add(activationTimeout());

    if (
      (uint256(stage()) < 3 && block.timestamp >= fundingTimeoutDeadline) ||
      (stage() == Stages.Pending && block.timestamp >= activationTimeoutDeadline)
    ) {
      enterStage(Stages.Failed);
    }

    _;
  }

  /// @notice Ensure that a buyer is whitelisted before buying
  modifier isBuyWhitelisted() {
    require(isWhitelisted(msg.sender));
    _;
  }

  /****************
  * end modifiers *
  ****************/

  /**
    @notice Proxied contracts cannot have constructors. This works in place
    of the constructor in order to initialize the contract storage.
  */
  function initializeCrowdsale(
    bytes32 _fiatCurrency32, // bytes32 of fiat currency string
    uint256 _startTime, // unix timestamp
    uint256 _fundingTimeout, // seconds after startTime
    uint256 _activationTimeout, // seconds after startTime + fundingTimeout
    uint256 _fundingGoalInCents // fiat cents
  )
    external
    returns (bool)
  {
    // ensure that token has already been initialized
    require(tokenInitialized());
    // ensure that crowdsale has not already been initialized
    require(!crowdsaleInitialized());

    // validate initialize parameters
    require(_fiatCurrency32 != bytes32(0));
    require(_startTime > block.timestamp);
    require(_fundingTimeout >= 60 * 60 * 24);
    require(_activationTimeout >= 60 * 60 * 24 * 7);
    require(_fundingGoalInCents > 0);
    require(totalSupply() > _fundingGoalInCents);

    // initialize non-sequential storage
    setFiatCurrency32(_fiatCurrency32);
    setStartTime(_startTime);
    setFundingTimeout(_fundingTimeout);
    setActivationTimeout(_activationTimeout);
    setFundingGoalInCents(_fundingGoalInCents);

    // run getRate once in order to see if rate is initialized, throws if not
    require(getFiatRate() > 0);

    // set crowdsaleInitialized to true so cannot be initialized again
    setCrowdsaleInitialized(true);

    return true;
  }

  /****************************
  * start lifecycle functions *
  ****************************/

  /// @notice Used for moving contract into FiatFunding stage where fiat purchases can be made
  function startFiatPreSale()
    external
    onlyCustodian
    atStage(Stages.PreFunding)
    returns (bool)
  {
    enterStage(Stages.FiatFunding);
    return true;
  }

  /// @notice Used for starting ETH sale as long as startTime has passed
  function startEthSale()
    external
    atEitherStage(Stages.PreFunding, Stages.FiatFunding)
    returns (bool)
  {
    require(block.timestamp >= startTime());
    enterStage(Stages.EthFunding);
    return true;
  }

  /// @notice Used for funding through FIAT offchain during crowdsale. Balances are updated by custodian
  function buyFiat
  (
    address _contributor,
    uint256 _amountInCents
  )
    external
    atStage(Stages.FiatFunding)
    onlyCustodian
    returns (bool)
  {
    // Do not allow funding less than 100 cents
    require(_amountInCents >= 100);

    uint256 _newFundedAmount = fundedAmountInCentsDuringFiatFunding().add(_amountInCents);

    // if the amount is smaller than remaining amount, continue the transaction

    if (fundingGoalInCents().sub(_newFundedAmount) >= 0) {
      setFundedAmountInCentsDuringFiatFunding(
        fundedAmountInCentsDuringFiatFunding().add(_amountInCents)
      );

      //_percentOfFundingGoal multipled by precisionOfPercentCalc to get a more accurate result
      uint256 _percentOfFundingGoal = percent(_amountInCents, fundingGoalInCents(), precisionOfPercentCalc);
      uint256 _tokenAmount = totalSupply().mul(_percentOfFundingGoal).div(10 ** precisionOfPercentCalc);

      // update total fiat funded amount
      setFundedAmountInTokensDuringFiatFunding(
        fundedAmountInTokensDuringFiatFunding().add(_tokenAmount)
      );

      // update balance of investor
      setFiatInvestmentPerUserInTokens(
        _contributor,
        fiatInvestmentPerUserInTokens(_contributor).add(_tokenAmount)
      );

      // if funded amount reaches the funding goal, enter to Pending stage
      if (fundedAmountInCentsDuringFiatFunding() >= fundingGoalInCents()) {
        enterStage(Stages.Pending);
      }

      return true;
    } else {
      return false;
    }
  }

  /// @notice Used for funding through ETH during crowdsale
  function buy()
    external
    payable
    checkTimeout
    atStage(Stages.EthFunding)
    isBuyWhitelisted
    returns (bool)
  {
    // prevent FiatFunding addresses from contributing to funding to keep total supply legit
    if (isFiatInvestor(msg.sender)) {
      return false;
    }

    // prevent case where buying after reaching fundingGoal results in buyer
    // earning money on a buy
    if (weiToFiatCents(fundedAmountInWei()) > fundingGoalInCents()) {
      enterStage(Stages.Pending);
      if (msg.value > 0) {
        msg.sender.transfer(msg.value);
      }
      return false;
    }

    // get current funded amount + sent value in cents
    // with most current rate available
    uint256 _currentFundedCents = weiToFiatCents(fundedAmountInWei().add(msg.value))
      .add(fundedAmountInCentsDuringFiatFunding());
    // check if balance has met funding goal to move on to Pending
    if (_currentFundedCents < fundingGoalInCents()) {
      // give a range due to fun fun integer division
      if (fundingGoalInCents().sub(_currentFundedCents) > 1) {
        // continue sale if more than 1 cent from goal in fiat
        return buyAndContinueFunding(msg.value);
      } else {
        // finish sale if within 1 cent of goal in fiat
        // no refunds for overpayment should be given
        return buyAndEndFunding(false);
      }
    } else {
      // finish sale, we are now over the funding goal
      // a refund for overpaid amount should be given
      return buyAndEndFunding(true);
    }
  }

  /// @notice Buy and continue funding process (when funding goal not met)
  function buyAndContinueFunding(uint256 _payAmount)
    internal
    returns (bool)
  {
    // save this for later in case needing to reclaim
    setInvestmentAmountPerUserInWei(
      msg.sender,
      investmentAmountPerUserInWei(msg.sender).add(_payAmount)
    );
    // increment the funded amount
    setFundedAmountInWei(fundedAmountInWei().add(_payAmount));

    getContractAddress("Logger").call(
      bytes4(keccak256("logBuyEvent(address,uint256)")), msg.sender, _payAmount
    );

    return true;
  }

  /// @notice Buy and finish funding process (when funding goal met)
  function buyAndEndFunding(bool _shouldRefund)
    internal
    returns (bool)
  {
    enterStage(Stages.Pending);
    uint256 _refundAmount = _shouldRefund ?
      fundedAmountInWei().add(msg.value).sub(fiatCentsToWei(fundingGoalInCents())) :
      0;
    // transfer refund amount back to user
    msg.sender.transfer(_refundAmount);
    // actual Ξ amount to buy after refund
    uint256 _payAmount = msg.value.sub(_refundAmount);
    buyAndContinueFunding(_payAmount);

    return true;
  }

  /// @notice Activate token with proofOfCustody fee is taken from contract balance
  /// brokers must work this into their funding goals
  function activate
  (
    bytes32[2] _ipfsHash
  )
    external
    checkTimeout
    onlyCustodian
    atStage(Stages.Pending)
    validIpfsHash(_ipfsHash)
    returns (bool)
  {
    // calculate company fee charged for activation
    uint256 _fee = calculateFee(address(this).balance);
    // if activated and fee paid: put in Active stage
    enterStage(Stages.Active);
    // fee sent to FeeManager where fee gets
    // turned into ACT for lockedBBK holders
    payFee(_fee);
    setProofOfCustody32(_ipfsHash);
    getContractAddress("Logger")
      .call(bytes4(keccak256("logProofOfCustodyUpdatedEvent()")));
    // balance of contract (fundingGoalInCents) set to claimable by broker.
    // can now be claimed by broker via claim function
    // should only be buy()s - fee. this ensures buy() dust is cleared
    setUnclaimedPayoutTotals(
      broker(),
      unclaimedPayoutTotals(broker()).add(address(this).balance)
    );
    // allow trading of tokens
    setPaused(false);
    // let world know that this token can now be traded.
    emit Unpause();

    return true;
  }

  /**
   @notice Used for manually setting Stage to Failed when no users have bought any tokens
   if no `buy()`s occurred before fundingTimeoutBlock token would be stuck in Funding
   can also be used when activate is not called by custodian within activationTimeout
   lastly can also be used when no one else has called reclaim.
  */
  function setFailed()
    external
    atEitherStage(Stages.EthFunding, Stages.Pending)
    checkTimeout
    returns (bool)
  {
    if (stage() != Stages.Failed) {
      revert();
    }
    return true;
  }

  /// @notice Reclaim eth for sender if fundingGoalInCents is not met within fundingTimeoutBlock
  function reclaim()
    external
    checkTimeout
    atStage(Stages.Failed)
    returns (bool)
  {
    require(!isFiatInvestor(msg.sender));
    setTotalSupply(0);
    uint256 _refundAmount = investmentAmountPerUserInWei(msg.sender);
    setInvestmentAmountPerUserInWei(msg.sender, 0);
    require(_refundAmount > 0);
    setFundedAmountInWei(fundedAmountInWei().sub(_refundAmount));
    msg.sender.transfer(_refundAmount);
    getContractAddress("Logger").call(
      bytes4(keccak256("logReclaimEvent(address,uint256)")),
      msg.sender,
      _refundAmount
    );
    return true;
  }

  /// @notice When custodian enters wrong FIAT records BEFORE EthFunding stage, custodian can cancel the contract
  function setCancelled()
    external
    onlyCustodian
    atEitherStage(Stages.PreFunding, Stages.FiatFunding)
    returns (bool)
  {
    enterStage(Stages.Cancelled);

    return true;
  }

  /**************************
  * end lifecycle functions *
  **************************/

  /**************************
  * start utility functions *
  **************************/

  /// @notice Convert to accurate percent using desired level of precision
  function percent(
    uint256 _numerator,
    uint256 _denominator,
    uint256 _precision
  )
    public
    pure
    returns(uint256)
  {

    // caution, check safe-to-multiply here
    uint256 _safeNumerator = _numerator.mul(10 ** (_precision + 1));
    // with rounding of last digit
    uint256 _quotient = _safeNumerator.div(_denominator).add(5).div(10);
    return (_quotient);
  }

  /// @notice gas saving call to get fiat rate without interface
  function getFiatRate()
    public
    view
    returns (uint256 _fiatRate)
  {
    bytes4 _sig = bytes4(keccak256("getRate32(bytes32)"));
    address _exchangeRates = getContractAddress("ExchangeRates");
    bytes32 _fiatCurrency = keccak256(fiatCurrency());

    assembly {
      let _call := mload(0x40) // set _call to free memory pointer
      mstore(_call, _sig) // store _sig at _call pointer
      mstore(add(_call, 0x04), _fiatCurrency) // store _fiatCurrency at _call offset by 4 bytes for pre-existing _sig

      // staticcall(g, a, in, insize, out, outsize) => 0 on error 1 on success
      let success := staticcall(
        gas,             // g = gas: whatever was passed already
        _exchangeRates,  // a = address: address from getContractAddress
        _call,           // in = mem in  mem[in..(in+insize): set to free memory pointer
        0x24,            // insize = mem insize  mem[in..(in+insize): size of sig (bytes4) + bytes32 = 0x24
        _call,           // out = mem out  mem[out..(out+outsize): output assigned to this storage address
        0x20             // outsize = mem outsize  mem[out..(out+outsize): output should be 32byte slot (uint256 size = 0x20 = slot size 0x20)
      )

      // revert if not successful
      if iszero(success) {
        revert(0, 0)
      }

      _fiatRate := mload(_call) // assign result to return value
      mstore(0x40, add(_call, 0x24)) // advance free memory pointer by largest _call size
    }
  }

  /// @notice Returns fiat value in cents of given wei amount
  function weiToFiatCents(uint256 _wei)
    public
    view
    returns (uint256)
  {
    // get eth to fiat rate in cents from ExchangeRates
    return _wei.mul(getFiatRate()).div(1e18);
  }

  /// @notice Returns wei value from fiat cents
  function fiatCentsToWei(uint256 _cents)
    public
    view
    returns (uint256)
  {
    return _cents.mul(1e18).div(getFiatRate());
  }

  /// @notice Get funded amount in cents
  function fundedAmountInCents()
    external
    view
    returns (uint256)
  {
    return weiToFiatCents(fundedAmountInWei());
  }

  /// @notice Get fundingGoal in wei
  function fundingGoalInWei()
    external
    view
    returns (uint256)
  {
    return fiatCentsToWei(fundingGoalInCents());
  }

  /************************
  * end utility functions *
  ************************/

  /************************
  * start regular getters *
  ************************/

  /// @notice Return converted string from bytes32 fiatCurrency32
  function fiatCurrency()
    public
    view
    returns (string)
  {
    return to32LengthString(fiatCurrency32());
  }

  /**********************
  * end regular getters *
  **********************/

  /***********************************************
  * start non-sequential storage getters/setters *
  ***********************************************/

  /*
    Each function in this section without "set" prefix is a getter for a specific
    non-sequential storage slot which are public and can be called by a user or contract.
    Functions with "set" are internal and can only be called by the contract/inherited contracts.

    Both getters and setters use commonly agreed upon storage slots to avoid collisions.
  */

  function crowdsaleInitialized()
    public
    view
    returns (bool _crowdsaleInitialized)
  {
    bytes32 _crowdsaleInitializedSlot = crowdsaleInitializedSlot;
    assembly {
      _crowdsaleInitialized := sload(_crowdsaleInitializedSlot)
    }
  }

  function setCrowdsaleInitialized(
    bool _crowdsaleInitialized
  )
    internal
  {
    bytes32 _crowdsaleInitializedSlot = crowdsaleInitializedSlot;
    assembly {
      sstore(_crowdsaleInitializedSlot, _crowdsaleInitialized)
    }
  }

  function startTime()
    public
    view
    returns (uint256 _startTime)
  {
    bytes32 _startTimeSlot = startTimeSlot;
    assembly {
      _startTime := sload(_startTimeSlot)
    }
  }

  function setStartTime(
    uint256 _startTime
  )
    internal
  {
    bytes32 _startTimeSlot = startTimeSlot;
    assembly {
      sstore(_startTimeSlot, _startTime)
    }
  }

  function fundingTimeout()
    public
    view
    returns (uint256 _fundingTimeout)
  {
    bytes32 _fundingTimeoutSlot = fundingTimeoutSlot;
    assembly {
      _fundingTimeout := sload(_fundingTimeoutSlot)
    }
  }

  function setFundingTimeout(
    uint256 _fundingTimeout
  )
    internal
  {
    bytes32 _fundingTimeoutSlot = fundingTimeoutSlot;
    assembly {
      sstore(_fundingTimeoutSlot, _fundingTimeout)
    }
  }

  function activationTimeout()
    public
    view
    returns (uint256 _activationTimeout)
  {
    bytes32 _activationTimeoutSlot = activationTimeoutSlot;
    assembly {
      _activationTimeout := sload(_activationTimeoutSlot)
    }
  }

  function setActivationTimeout(
    uint256 _activationTimeout
  )
    internal
  {
    bytes32 _activationTimeoutSlot = activationTimeoutSlot;
    assembly {
      sstore(_activationTimeoutSlot, _activationTimeout)
    }
  }

  function fiatCurrency32()
    internal
    view
    returns (bytes32 _fiatCurrency32)
  {
    bytes32 _fiatCurrency32Slot = fiatCurrency32Slot;
    assembly {
      _fiatCurrency32 := sload(_fiatCurrency32Slot)
    }
  }

  function setFiatCurrency32(
    bytes32 _fiatCurrency32
  )
    internal
  {
    bytes32 _fiatCurrency32Slot = fiatCurrency32Slot;
    assembly {
      sstore(_fiatCurrency32Slot, _fiatCurrency32)
    }
  }

  function fundingGoalInCents()
    public
    view
    returns (uint256 _fundingGoalInCents)
  {
    bytes32 _fundingGoalInCentsSlot = fundingGoalInCentsSlot;
    assembly {
      _fundingGoalInCents := sload(_fundingGoalInCentsSlot)
    }
  }

  function setFundingGoalInCents(
    uint256 _fundingGoalInCents
  )
    internal
  {
    bytes32 _fundingGoalInCentsSlot = fundingGoalInCentsSlot;
    assembly {
      sstore(_fundingGoalInCentsSlot, _fundingGoalInCents)
    }
  }

  function fundedAmountInCentsDuringFiatFunding()
    public
    view
    returns (uint256 _fundedAmountInCentsDuringFiatFunding)
  {
    bytes32 _fundedAmountInCentsDuringFiatFundingSlot = fundedAmountInCentsDuringFiatFundingSlot;
    assembly {
      _fundedAmountInCentsDuringFiatFunding := sload(_fundedAmountInCentsDuringFiatFundingSlot)
    }
  }

  function setFundedAmountInCentsDuringFiatFunding(
    uint256 _fundedAmountInCentsDuringFiatFunding
  )
    internal
  {
    bytes32 _fundedAmountInCentsDuringFiatFundingSlot = fundedAmountInCentsDuringFiatFundingSlot;
    assembly {
      sstore(_fundedAmountInCentsDuringFiatFundingSlot, _fundedAmountInCentsDuringFiatFunding)
    }
  }

  /*********************************************
  * end non-sequential storage getters/setters *
  *********************************************/

}
