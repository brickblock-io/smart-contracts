pragma solidity 0.4.24;

// this is meant to be a combined interface of PoaToken and PoaCrowdsale
// the resulting ABI can be used for calling both PoaToken and PoaCrowdsale functions
interface IPoaTokenCrowdsale {

  //
  // start token functionality
  //

  function owner()
    external
    view
    returns (address);

  function decimals()
    external
    view
    returns (uint256);

  function totalPerTokenPayout()
    external
    view
    returns (uint256);

  function whitelistTransfers()
    external
    view
    returns (bool);

  function initializeToken(
    bytes32 _name32, // bytes32 of name string
    bytes32 _symbol32, // bytes32 of symbol string
    address _broker,
    address _custodian,
    address _registry,
    uint256 _totalSupply // token total supply
  )
    external
    returns (bool);

  function changeCustodianAddress(
    address _newCustodian
  )
    external
    returns (bool);

  function terminate()
    external
    returns (bool);

  function pause()
    external;

  function unpause()
    external;

  function toggleWhitelistTransfers()
    external
    returns (bool);

  function name()
    external
    view
    returns (string);

  function symbol()
    external
    view
    returns (string);

  function currentPayout
  (
    address _address,
    bool _includeUnclaimed
  )
    external
    view
    returns (uint256);

  function payout()
    external
    payable
    returns (bool);

  function claim()
    external
    returns (uint256);

  function updateProofOfCustody
  (
    bytes32[2] _ipfsHash
  )
    external
    returns (bool);

  function balanceOf
  (
    address _address
  )
    external
    view
    returns (uint256);

  function transfer
  (
    address _to,
    uint256 _value
  )
    external
    returns (bool);

  function transferFrom
  (
    address _from,
    address _to,
    uint256 _value
  )
    external
    returns (bool);

  function paused()
    external
    view
    returns (bool _paused);

  function allowance
  (
    address _owner,
    address _spender
  )
    external
    view
    returns (uint256);

  function approve(
    address _spender,
    uint256 _value
  )
    external
    returns (bool);


  //
  // end token functionality
  //

  //
  // start crowdsale functionality
  //

  function precisionOfPercentCalc()
    external
    returns(uint256);

  /**
    @notice Starts the crowdsale
    @param _fiatCurrency32 bytes32 of fiat currency string
    @param _startTimeForEthFunding unix timestamp in seconds
    @param _endTimeForEthFunding seconds after startTimeForEthFunding
    @param _activationTimeout seconds after startTimeForEthFunding + endTimeForEthFunding
    @param _fundingGoalInCents in fiat cents
   */
  function initializeCrowdsale(
    bytes32 _fiatCurrency32,
    uint256 _startTimeForEthFunding,
    uint256 _endTimeForEthFunding,
    uint256 _activationTimeout,
    uint256 _fundingGoalInCents
  )
    external
    returns (bool);

  function startFiatSale()
    external
    returns (bool);

  function startEthSale()
    external
    returns (bool);

  function calculateTokenAmountForAmountInCents(
    uint256 _amountInCents
  )
    external
    returns (uint256);

  function buyFiat
  (
    address _contributor,
    uint256 _amountInCents
  )
    external
    returns (bool);

  function removeFiat
  (
    address _contributor,
    uint256 _amountInCents
  )
    external
    returns (bool);

  function buy()
    external
    payable
    returns (bool);

  function activate
  (
    bytes32[2] _ipfsHash
  )
    external
    returns (bool);

  function setStageToTimedOut()
    external
    returns (bool);

  function reclaim()
    external
    returns (bool);

  function cancelFunding()
    external
    returns (bool);

  function getFiatRate()
    external
    view
    returns (uint256 _fiatRate);

  function percent(
    uint256 numerator,
    uint256 denominator,
    uint256 precision)
    external
    returns(uint256 quotient);

  function weiToFiatCents(uint256 _wei)
    external
    view
    returns (uint256);

  function fiatCentsToWei(uint256 _cents)
    external
    view
    returns (uint256);

  function fundedEthAmountInCents()
    external
    view
    returns (uint256);

  function fundingGoalInWei()
    external
    view
    returns (uint256);

  function fiatCurrency()
    external
    view
    returns (string);

  function crowdsaleInitialized()
    external
    view
    returns (bool _crowdsaleInitialized);

  function startTimeForEthFunding()
    external
    view
    returns (uint256 _startTimeForEthFunding);

  function endTimeForEthFunding()
    external
    view
    returns (uint256 _endTimeForEthFunding);

  function activationTimeout()
    external
    view
    returns (uint256 _activationTimeout);

  function fundingGoalInCents()
    external
    view
    returns (uint256 _fundingGoalInCents);

  function fundedFiatAmountInCents()
    external
    view
    returns (uint256 _fundedFiatAmountInCents);

  function broker()
    external
    view
    returns (address _broker);

  function checkFundingSuccessful()
    external
    returns (bool);

  //
  // end crowdsale functionality
  //

  //
  // start common functionality
  //

  function feeRateInPermille()
    external
    view
    returns (uint256);

  function calculateFee
  (
    uint256 _value
  )
    external
    pure
    returns (uint256);

  function getContractAddress
  (
    string _name
  )
    external
    view
    returns (address _contractAddress);

  function isWhitelisted
  (
    address _address
  )
    external
    view
    returns (bool _isWhitelisted);

  function proofOfCustody()
    external
    view
    returns (string);

  function stage()
    external
    view
    returns (uint256 _stage);

  function proofOfCustody32()
    external
    view
    returns (bytes32[2]);

  function totalSupply()
    external
    view
    returns (uint256 _totalSupply);

  function fundedFiatAmountInTokens()
    external
    view
    returns (uint256 _fundedFiatAmountInTokens);

  function fundedFiatAmountPerUserInTokens
  (
    address _address
  )
    external
    view
    returns (uint256 _fiatInvested);

  function fundedEthAmountInWei()
    external
    view
    returns (uint256 _fundedEthAmountInWei);

  function fundedEthAmountPerUserInWei
  (
    address _address
  )
    external
    view
    returns (uint256 _fundedEthAmountPerUserInWei);

  function registry()
    external
    view
    returns (address _registry);

  function unclaimedPayoutTotals
  (
    address _address
  )
    external
    view
    returns (uint256 _unclaimedPayoutTotals);

  function tokenInitialized()
    external
    view
    returns (bool _tokenInitialized);

  function poaCrowdsaleMaster()
    external
    view
    returns (address _poaCrowdsaleMaster);

  function custodian()
    external
    view
    returns (address _custodian);

  function crowdsaleVersion()
    external
    view
    returns (uint256);

  function tokenVersion()
    external
    view
    returns (uint256);

  function poaTokenMaster()
    external
    view
    returns (address);

  //
  // end common functionality
  //
}
