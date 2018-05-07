pragma solidity 0.4.18;

import "./OraclizeAPI.sol";


// minimal definition of ExchangeRates
contract ExRates {
  mapping (bytes32 => bytes8) public queryTypes;
  bool public ratesActive;

  function setRate(bytes32 _queryId, uint256 _rate)
    external
    returns (bool)
  {}

  function setQueryId(
    bytes32 _queryId,
    bytes8 _queryType
  )
    external
    returns (bool)
  {}

  function getCurrencySettings(bytes8 _queryType)
    view
    external
    returns (uint256, uint256, bytes32[5])
  {}
}


// minimal definition of BrickblockContractRegistry
contract Registry {
  function getContractAddress(string _name)
    public
    view
    returns (address)
  {}
}


contract ExchangeRateProvider is usingOraclize {
  Registry private registry;
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

  // constructor: setup and require registry
  function ExchangeRateProvider(address _registryAddress)
    public
  {
    require(_registryAddress != address(0));
    registry = Registry(_registryAddress);
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
    bytes32[5] _queryString,
    uint256 _callInterval,
    uint256 _callbackGasLimit,
    bytes8 _queryType
  )
    onlyAllowed
    payable
    public
    returns (bool)
  {
    // check that there is enough money to make the query
    if (oraclize_getPrice("URL") > this.balance) {
      setQueryId(0x0, 0x0);
      return false;
    } else {
      // make query based on currencySettings for a given _queryType
      bytes32 _queryId = oraclize_query(
        _callInterval,
        "URL",
        toLongString(_queryString),
        _callbackGasLimit
      );
      // set the queryId on ExchangeRates so that it knows about it and can
      // accept it when __callback tries to set the rate
      setQueryId(_queryId, _queryType);
      return true;
    }
  }

  // set queryIds on ExchangeRates for later validation when __callback happens
  function setQueryId(bytes32 _identifier, bytes8 _queryType)
    private
    returns (bool)
  {
    // get current address of ExchangeRates
    ExRates _exchangeRates = ExRates(
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
    ExRates _exchangeRates = ExRates(
      registry.getContractAddress("ExchangeRates")
    );
    // get settings data from ExchangeRates
    bool _ratesActive = _exchangeRates.ratesActive();
    bytes8 _queryType = _exchangeRates.queryTypes(_queryId);
    uint256 _callInterval;
    uint256 _callbackGasLimit;
    bytes32[5] memory _queryString;
    (
      _callInterval,
      _callbackGasLimit,
      _queryString
    ) = _exchangeRates.getCurrencySettings(_queryType);

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
        _queryType
      );
    }
  }

  // takes a fixed length array of 5 bytes32. needed for contract communication
  function toLongString(bytes32[5] _data)
    pure
    public
    returns (string)
  {
    // ensure array length is correct length
    require(_data.length == 5);
    // create new empty bytes array with same length as input
    bytes memory _bytesString = new bytes(5 * 32);
    // keep track of string length for later usage in trimming
    uint256 _stringLength;

    // loop through each bytes32 in array
    for (uint _arrayCounter = 0; _arrayCounter < _data.length; _arrayCounter++) {
      // loop through each byte in bytes32
      for (uint _bytesCounter = 0; _bytesCounter < 32; _bytesCounter++) {
        /*
        convert bytes32 data to uint in order to increase the number enough to
        shift bytes further left while pushing out leftmost bytes
        then convert uint256 data back to bytes32
        then convert to bytes1 where everything but the leftmost hex value (byte)
        is cutoff leaving only the leftmost byte

        TLDR: takes a single character from bytes based on counter
        */
        bytes1 _char = bytes1(
          bytes32(
            uint(_data[_arrayCounter]) * 2 ** (8 * _bytesCounter)
          )
        );
        // add the character if not empty
        if (_char != 0) {
          _bytesString[_stringLength] = _char;
          _stringLength += 1;
        }
      }
    }

    // new bytes with correct matching string length
    bytes memory _bytesStringTrimmed = new bytes(_stringLength);
    // loop through _bytesStringTrimmed throwing in
    // non empty data from _bytesString
    for (_bytesCounter = 0; _bytesCounter < _stringLength; _bytesCounter++) {
      _bytesStringTrimmed[_bytesCounter] = _bytesString[_bytesCounter];
    }
    // return trimmed bytes array converted to string
    return string(_bytesStringTrimmed);
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
