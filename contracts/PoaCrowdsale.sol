pragma solidity 0.4.24;

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

  event Unpause();

  /******************
  * start modifiers *
  ******************/

  /// @notice Ensure that the contract has not timed out
  modifier checkTimeout() {
    uint256 fundingTimeoutDeadline = startTime.add(fundingTimeout);
    uint256 activationTimeoutDeadline = startTime
      .add(fundingTimeout)
      .add(activationTimeout);

    if (
      (uint256(stage) < 3 && block.timestamp >= fundingTimeoutDeadline) ||
      (stage == Stages.FundingSuccessful && block.timestamp >= activationTimeoutDeadline)
    ) {
      enterStage(Stages.TimedOut);
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

    @param _fiatCurrency32     bytes32 of fiat currency string
    @param _startTime          Beginning of the sale as unix timestamp
    @param _fundingTimeout     Duration of the sale (starting from _startTime)
    @param _activationTimeout  Timeframe for the custodian to activate the token (starting from _startTime + _fundingTimeout)
    @param _fundingGoalInCents Funding goal in fiat cents (e.g. a €10,000 fundingGoal would be '10000000')
  */
  function initializeCrowdsale(
    bytes32 _fiatCurrency32,
    uint256 _startTime,
    uint256 _fundingTimeout,
    uint256 _activationTimeout,
    uint256 _fundingGoalInCents
  )
    external
    returns (bool)
  {
    // ensure that token has already been initialized
    require(tokenInitialized);
    // ensure that crowdsale has not already been initialized
    require(!crowdsaleInitialized);

    // validate initialize parameters
    require(_fiatCurrency32 != bytes32(0));
    require(_startTime > block.timestamp);
    require(_fundingTimeout >= 60 * 60 * 24);
    require(_activationTimeout >= 60 * 60 * 24 * 7);
    require(_fundingGoalInCents > 0);
    require(totalSupply_ > _fundingGoalInCents);

    // initialize non-sequential storage
    fiatCurrency32 = _fiatCurrency32;
    startTime = _startTime;
    fundingTimeout = _fundingTimeout;
    activationTimeout = _activationTimeout;
    fundingGoalInCents = _fundingGoalInCents;

    // run getRate once in order to see if rate is initialized, throws if not
    require(getFiatRate() > 0);

    // set crowdsaleInitialized to true so cannot be initialized again
    crowdsaleInitialized = true;

    return true;
  }

  /****************************
  * start lifecycle functions *
  ****************************/

  /// @notice Used for moving contract into FiatFunding stage where fiat purchases can be made
  function startFiatSale()
    external
    onlyBroker
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
    require(block.timestamp >= startTime);
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

    uint256 _newFundedAmount = fundedAmountInCentsDuringFiatFunding.add(_amountInCents);

    // if the amount is smaller than remaining amount, continue the transaction

    if (fundingGoalInCents.sub(_newFundedAmount) >= 0) {
      fundedAmountInCentsDuringFiatFunding = fundedAmountInCentsDuringFiatFunding
        .add(_amountInCents);

      //_percentOfFundingGoal multipled by precisionOfPercentCalc to get a more accurate result
      uint256 _percentOfFundingGoal = percent(_amountInCents, fundingGoalInCents, precisionOfPercentCalc);
      uint256 _tokenAmount = totalSupply_.mul(_percentOfFundingGoal).div(10 ** precisionOfPercentCalc);

      // update total fiat funded amount
      fundedAmountInTokensDuringFiatFunding = fundedAmountInTokensDuringFiatFunding
        .add(_tokenAmount);

      // update balance of investor
      fiatInvestmentPerUserInTokens[_contributor] = fiatInvestmentPerUserInTokens[_contributor]
        .add(_tokenAmount);

      // if funded amount reaches the funding goal, enter FundingSuccessful stage
      if (fundedAmountInCentsDuringFiatFunding >= fundingGoalInCents) {
        enterStage(Stages.FundingSuccessful);
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
    if (weiToFiatCents(fundedAmountInWei) > fundingGoalInCents) {
      enterStage(Stages.FundingSuccessful);
      if (msg.value > 0) {
        msg.sender.transfer(msg.value);
      }
      return false;
    }

    // get current funded amount + sent value in cents
    // with most current rate available
    uint256 _currentFundedCents = weiToFiatCents(fundedAmountInWei.add(msg.value))
      .add(fundedAmountInCentsDuringFiatFunding);
    // check if balance has met funding goal to move on to FundingSuccessful
    if (_currentFundedCents < fundingGoalInCents) {
      // give a range due to fun fun integer division
      if (fundingGoalInCents.sub(_currentFundedCents) > 1) {
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
    investmentAmountPerUserInWei[msg.sender] = investmentAmountPerUserInWei[msg.sender]
      .add(_payAmount);
    // increment the funded amount
    fundedAmountInWei = fundedAmountInWei.add(_payAmount);

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
    enterStage(Stages.FundingSuccessful);
    uint256 _refundAmount = _shouldRefund ?
      fundedAmountInWei.add(msg.value).sub(fiatCentsToWei(fundingGoalInCents)) :
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
    atStage(Stages.FundingSuccessful)
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
    proofOfCustody32_ = _ipfsHash;
    getContractAddress("Logger")
      .call(bytes4(keccak256("logProofOfCustodyUpdatedEvent()")));
    // balance of contract (fundingGoalInCents) set to claimable by broker.
    // can now be claimed by broker via claim function
    // should only be buy()s - fee. this ensures buy() dust is cleared
    unclaimedPayoutTotals[broker] = unclaimedPayoutTotals[broker]
      .add(address(this).balance); 
    // allow trading of tokens
    paused = false;
    // let world know that this token can now be traded.
    emit Unpause();

    return true;
  }

  /**
   @notice Used for manually setting Stage to TimedOut when no users have bought any tokens
   if no `buy()`s occurred before fundingTimeoutBlock token would be stuck in Funding
   can also be used when activate is not called by custodian within activationTimeout
   lastly can also be used when no one else has called reclaim.
  */
  function setStageToTimedOut()
    external
    atEitherStage(Stages.EthFunding, Stages.FundingSuccessful)
    checkTimeout
    returns (bool)
  {
    if (stage != Stages.TimedOut) {
      revert();
    }
    return true;
  }

  /// @notice Reclaim eth for sender if fundingGoalInCents is not met within fundingTimeoutBlock
  function reclaim()
    external
    checkTimeout
    atStage(Stages.TimedOut)
    returns (bool)
  {
    require(!isFiatInvestor(msg.sender));
    totalSupply_ = 0;
    uint256 _refundAmount = investmentAmountPerUserInWei[msg.sender];
    investmentAmountPerUserInWei[msg.sender] = 0;
    require(_refundAmount > 0);
    fundedAmountInWei = fundedAmountInWei.sub(_refundAmount);
    msg.sender.transfer(_refundAmount);
    getContractAddress("Logger").call(
      bytes4(keccak256("logReclaimEvent(address,uint256)")),
      msg.sender,
      _refundAmount
    );
    return true;
  }

  /**
    @notice When something goes wrong during the "PreFunding" or "FiatFunding"
    stages, this is an escape hatch to cancel the funding process.
    If the contract hits the "EthFunding" stage, this can no longer be used.

    This is a nuclear option and should only be used under exceptional
    circumstances, for example:
    - Asset gets damaged due to natural catastrophe
    - Legal issue arises with the asset
    - Broker gets blacklisted during the funding phase
      due to fraudulent behavior
    */
  function cancelFunding()
    external
    onlyCustodian
    atEitherStage(Stages.PreFunding, Stages.FiatFunding)
    returns (bool)
  {
    enterStage(Stages.FundingCancelled);

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
    return weiToFiatCents(fundedAmountInWei);
  }

  /// @notice Get fundingGoal in wei
  function fundingGoalInWei()
    external
    view
    returns (uint256)
  {
    return fiatCentsToWei(fundingGoalInCents);
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
    return to32LengthString(fiatCurrency32);
  }

  /**********************
  * end regular getters *
  **********************/
}