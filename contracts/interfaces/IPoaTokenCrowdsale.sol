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

  function initializeCrowdsale(
    bytes32 _fiatCurrency32, // bytes32 of fiat currency string
    uint256 _startTime, // unix timestamp
    uint256 _fundingTimeout, // seconds after startTime
    uint256 _activationTimeout, // seconds after startTime + fundingTimeout
    uint256 _fundingGoalInCents // fiat cents
  )
    external
    returns (bool);

  function startFiatSale()
    external
    returns (bool);

  function startEthSale()
    external
    returns (bool);

  function buyFiat
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

  function setFailed()
    external
    returns (bool);

  function reclaim()
    external
    returns (bool);

  function setCancelled()
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

  function fundedAmountInCents()
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

  function startTime()
    external
    view
    returns (uint256 _startTime);

  function fundingTimeout()
    external
    view
    returns (uint256 _fundingTimeout);

  function activationTimeout()
    external
    view
    returns (uint256 _activationTimeout);

  function fundingGoalInCents()
    external
    view
    returns (uint256 _fundingGoalInCents);

  function fundedAmountInCentsDuringFiatFunding()
    external
    view
    returns (uint256 _fundedAmountInCentsDuringFiatFunding);

  function broker()
    external
    view
    returns (address _broker);

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

  function fundedAmountInTokensDuringFiatFunding()
    external
    view
    returns (uint256 _fundedAmountInTokensDuringFiatFunding);

  function fiatInvestmentPerUserInTokens
  (
    address _address
  )
    external
    view
    returns (uint256 _fiatInvested);

  function fundedAmountInWei()
    external
    view
    returns (uint256 _fundedAmountInWei);

  function investmentAmountPerUserInWei
  (
    address _address
  )
    external
    view
    returns (uint256 _investmentAmountPerUserInWei);

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

  //
  // end common functionality
  //
}
