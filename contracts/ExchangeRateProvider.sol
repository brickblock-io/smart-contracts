pragma solidity 0.4.24;

import "./OraclizeAPI.sol";
import "./interfaces/IRegistry.sol";
import "./interfaces/IExchangeRates.sol";


/**
  @title This contract is the integration point for using the Oraclize service.
*/
contract ExchangeRateProvider is usingOraclize {
  uint8 public constant version = 1;

  IRegistry private registry;

  // ensure that only the oracle or ExchangeRates contract are allowed
  modifier onlyAllowed()
  {
    require(
      msg.sender == registry.getContractAddress("ExchangeRates") ||
      msg.sender == oraclize_cbAddress()
    );
    _;
  }

  modifier onlyOraclizer()
  {
    require(msg.sender == oraclize_cbAddress());
    _;
  }

  modifier onlyExchangeRates()
  {
    require(msg.sender == registry.getContractAddress("ExchangeRates"));
    _;
  }

  constructor(address _registryAddress)
    public
  {
    require(_registryAddress != address(0));
    registry = IRegistry(_registryAddress);
  }

  // set gas price used for oraclize callbacks
  function setCallbackGasPrice(uint256 _gasPrice)
    external
    onlyExchangeRates
    returns (bool)
  {
    oraclize_setCustomGasPrice(_gasPrice);

    return true;
  }

  // send query to oraclize, results sent to __callback
  // money can be forwarded on from ExchangeRates
  // current implementation requires > 1e5 & < 2e5 callbackGasLimit
  function sendQuery(
    string _queryString,
    uint256 _callInterval,
    uint256 _callbackGasLimit,
    string _queryType
  )
    public
    onlyAllowed
    payable
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
  function setQueryId(
    bytes32 _identifier,
    string _queryType
  )
    private
    returns (bool)
  {
    // get current address of ExchangeRates
    IExchangeRates _exchangeRates = IExchangeRates(
      registry.getContractAddress("ExchangeRates")
    );
    // run setQueryId on ExchangeRates
    return _exchangeRates.setQueryId(_identifier, _queryType);
  }

  // callback function for returned results of oraclize call
  // solium-disable-next-line mixedcase
  function __callback(
    bytes32 _queryId,
    string _result
  )
    public
    onlyOraclizer
  {
    // get currency address of ContractRegistry
    IExchangeRates _exchangeRates = IExchangeRates(
      registry.getContractAddress("ExchangeRates")
    );
    // get settings data from ExchangeRates
    bool _ratesActive = _exchangeRates.ratesActive();
    uint256 _callInterval;
    uint256 _callbackGasLimit;
    string memory _queryString;
    string memory _queryType = _exchangeRates.queryTypes(_queryId);
    (
      _callInterval,
      _callbackGasLimit,
      _queryString
    ) = _exchangeRates.getCurrencySettings(_queryType);

    // Set the rate on ExchangeRates contract giving queryId for validation.
    // The api returns a string which is parsed as int with 2 decimal places
    // ie. _result = 500.12
    //    parseInt(_result, 2) => 50012
    require(
      _exchangeRates.setRate(
        _queryId,
        parseInt(_result, 2)
      )
    );

    // check if call interval has been set and that _ratesActive is still true
    // if so, call again with the interval
    if (_callInterval > 0 && _ratesActive) {
      sendQuery(
        _queryString,
        _callInterval,
        _callbackGasLimit,
        _queryType
      );
    }
  }

  // used in case we need to get money out of the contract before replacing
  function selfDestruct(address _address)
    public
    onlyExchangeRates
  {
    // solium-disable-next-line security/no-suicide-or-selfdestruct
    selfdestruct(_address);
  }

  // ensure that we can fund queries by paying the contract
  function()
    public
    payable
  {}
}
