pragma solidity ^0.4.23;

import "./OraclizeAPI.sol";
import "./interfaces/BrickblockContractRegistryInterface.sol";
import "./interfaces/ExchangeRatesInterface.sol";


contract ExchangeRateProvider is usingOraclize {

  uint8 public constant version = 1;

  RegistryInterface private registry;
  // used to check on if the contract has self destructed
  bool public isAlive = true;

  // ensure that only the oracle or ExchangeRates contract are allowed
  modifier onlyAllowed()
  {
    require(
      msg.sender == registry.getContractAddress("ExchangeRates") ||
      msg.sender == oraclize_cbAddress()
    );
    _;
  }

  modifier onlyExchangeRates()
  {
    require(msg.sender == registry.getContractAddress("ExchangeRates"));
    _;
  }

  constructor(
    address _registryAddress
  )
    public
  {
    require(_registryAddress != address(0));
    registry = RegistryInterface(_registryAddress);
  }

  // set gas price used for oraclize callbacks
  function setCallbackGasPrice(uint256 _gasPrice)
    onlyExchangeRates
    external
    returns (bool)
  {
    oraclize_setCustomGasPrice(_gasPrice);
    return true;
  }

  // send query to oraclize, results sent to __callback
  // money can be forwarded on from ExchangeRates
  function sendQuery(
    string _queryString,
    uint256 _callInterval,
    uint256 _callbackGasLimit,
    string _queryType
  )
    onlyAllowed
    payable
    public
    returns (bool)
  {
    // check that there is enough money to make the query
    if (oraclize_getPrice("URL") > address(this).balance) {
      setQueryId(0x0, "");
      return false;
    } else {
      // make query based on currencySettings for a given _queryType
      bytes32 _queryId = oraclize_query(
        _callInterval,
        "URL",
        _queryString,
        _callbackGasLimit
      );
      // set the queryId on ExchangeRates so that it knows about it and can
      // accept it when __callback tries to set the rate
      setQueryId(_queryId, _queryType);
      return true;
    }
  }

  // set queryIds on ExchangeRates for later validation when __callback happens
  function setQueryId(bytes32 _identifier, string _queryType)
    private
    returns (bool)
  {
    // get current address of ExchangeRates
    ExchangeRatesInterface _exchangeRates = ExchangeRatesInterface(
      registry.getContractAddress("ExchangeRates")
    );
    // run setQueryId on ExchangeRates
    _exchangeRates.setQueryId(_identifier, _queryType);
  }

  // callback function for returned results of oraclize call
  function __callback(bytes32 _queryId, string _result)
    public
  {
    // make sure that the caller is oraclize
    require(msg.sender == oraclize_cbAddress());
    // get currency address of BrickblockContractRegistry
    ExchangeRatesInterface _exchangeRates = ExchangeRatesInterface(
      registry.getContractAddress("ExchangeRates")
    );
    // get settings data from ExchangeRates
    bool _ratesActive = _exchangeRates.ratesActive();
    uint256 _callInterval;
    uint256 _callbackGasLimit;
    string memory queryType = _exchangeRates.queryTypes(_queryId);
    string memory _queryString;
    (
      _callInterval,
      _callbackGasLimit,
      _queryString
    ) = _exchangeRates.getCurrencySettings(queryType);

    // set rate on ExchangeRates contract giving queryId for validation
    // rate is set in cents api returns float string which is parsed as int
    /* TODO: make sure that tests are all fine with this */
    require(_exchangeRates.setRate(_queryId, parseInt(_result, 2)));

    // check if call interval has been set and that _ratesActive is still true
    // if so, call again with the interval
    if (_callInterval > 0 && _ratesActive) {
      sendQuery(
        _queryString,
        _callInterval,
        _callbackGasLimit,
        queryType
      );
    }
  }

  // used in case we need to get money out of the contract before replacing
  function selfDestruct(address _address)
    onlyExchangeRates
    public
  {
    selfdestruct(_address);
  }

  // ensure that we can fund queries by paying the contract
  function()
    payable
    public
  {}
}
