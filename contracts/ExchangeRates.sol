pragma solidity 0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";


// minimal ExchangeRateProvider definition
contract ExRatesProvider {
  function sendQuery(
    bytes32[5] _queryString,
    uint256 _callInterval,
    uint256 _callbackGasLimit,
    bytes8 _queryType
  )
    public
    payable
    returns (bool)
  {}

  function setCallbackGasPrice(uint256 _gasPrice)
    public
    returns (bool)
  {}

  function selfDestruct(address _address)
    public
  {}
}


// minimal BrickblockContractRegistry definition
contract Registry {
  function getContractAddress(string _name)
    public
    view
    returns (address)
  {}
}


/*
Q/A
Q: Why are there two contracts for ExchangeRates?
A: Testing Oraclize seems to be a bit difficult especially considering the
bridge requires node v6... With that in mind, it was decided that the best way
to move forward was to isolate the oraclize functionality and replace with
a stub in order to facilitate effective tests.

Q: Why are there so many crazy string and bytes functions?
A: This is needed in order for the two contracts to talk to each other. Strings
cannot be sent from one contract to another because this cannot be done with
dynamically sized types, which is what a string is in
solidity (dynamic bytes array).

Q: Why are rates private?
A: So that they can be returned through custom getters getRate and
getRateReadable. This is so that we can revert when a rate has not been
initialized or an error happened when fetching. Oraclize returns '' when
erroring which we parse as a uint256 which turns to 0.
*/

// main contract
contract ExchangeRates is Ownable {
  // instance of Registry to be used for getting other contract addresses
  Registry private registry;
  // flag used to tell recursive rate fetching to stop
  bool public ratesActive = true;
  // flag used to clear out each rate interval one by one when fetching rates
  bool public shouldClearRateIntervals = false;

  struct Settings {
    bytes32[5] queryString;
    uint256 callInterval;
    uint256 callbackGasLimit;
  }

  // the actual exchange rate for each currency
  // private so that when rate is 0 (error or unset) we can revert through
  // getter functions getRate and getRateReadable
  mapping (bytes8 => uint256) private rates;
  // points to currencySettings from callback
  // is used to validate queryIds from ExchangeRateProvider
  mapping (bytes32 => bytes8) public queryTypes;
  // storage for query settings... modifiable for each currency
  // accessed and used by ExchangeRateProvider
  mapping (bytes8 => Settings) public currencySettings;

  event RateUpdated(string currency, uint256 rate);
  event QueryNoMinBalance();
  event QuerySent(string currency);
  event SettingsUpdated(string currency);

  // used to only allow specific contract to call specific functions
  modifier onlyContract(string _contractName)
  {
    require(
      msg.sender == registry.getContractAddress(_contractName)
    );
    _;
  }

  // constructor: sets registry for talking to ExchangeRateProvider
  function ExchangeRates(address _registryAddress)
    public
    payable
  {
    require(_registryAddress != address(0));
    registry = Registry(_registryAddress);
    owner = msg.sender;
  }

  /* this doesn't work with external. I think because it is internally calling
  getCurrencySettings? Though it seems that accessing the struct directly
  doesn't work either */

  // start rate fetching for a specific currency. Kicks off the first of
  // possibly many recursive query calls on ExchangeRateProvider to get rates.
  function fetchRate(string _queryType)
    public
    onlyOwner
    payable
    returns (bool)
  {
    // get the ExchangeRateProvider from registry
    ExRatesProvider provider = ExRatesProvider(
      registry.getContractAddress("ExchangeRateProvider")
    );
    // convert _queryType to uppercase bytes8:
    // cannot use strings to talk to other contracts
    bytes8 _queryTypeBytes = toBytes8(toUpperCase(_queryType));
    // get settings to use in query on ExchangeRateProvider
    uint256 _callInterval;
    uint256 _callbackGasLimit;
    bytes32[5] memory _queryString;
    (
      _callInterval,
      _callbackGasLimit,
      _queryString
    ) = getCurrencySettings(_queryTypeBytes);
    // check that queryString isn't empty before making the query
    require(bytes(toLongString(_queryString)).length > 0);
    // make query on ExchangeRateProvider
    // forward any ether value sent on to ExchangeRateProvider
    // setQuery is called from ExchangeRateProvider to trigger an event
    // whether there is enough balance or not
    provider.sendQuery.value(msg.value)(
      _queryString,
      _callInterval,
      _callbackGasLimit,
      toBytes8(_queryType)
    );
    return true;
  }

  // ExchangeRateProvider ONLY FUNCTIONS:

  // set a pending queryId callable only by ExchangeRateProvider
  // set from sendQuery on ExchangeRateProvider
  // used to check that correct query is being matched to correct values
  function setQueryId(
    bytes32 _queryId,
    bytes8 _queryType
  )
    external
    onlyContract("ExchangeRateProvider")
    returns (bool)
  {
    if (_queryId[0] != 0x0 && _queryType[0] != 0x0) {
      QuerySent(toShortString(_queryType));
      queryTypes[_queryId] = _queryType;
    } else {
      QueryNoMinBalance();
    }
    return true;
  }

  // called only by ExchangeRateProvider
  // sets the rate for a given currency when query __callback occurs.
  // checks that the queryId returned is correct.
  function setRate(
    bytes32 _queryId,
    uint256 _result
  )
    external
    onlyContract("ExchangeRateProvider")
    returns (bool)
  {
    // get the query type (usd, eur, etc)
    bytes8 _queryType = queryTypes[_queryId];
    // check that first byte of _queryType is not 0 (something wrong or empty)
    // if the queryType is 0 then the queryId is incorrect
    require(_queryType[0] != 0x0);
    // set _queryId to empty (uninitialized, to prevent from being called again)
    delete queryTypes[_queryId];
    // set currency rate depending on _queryType (USD, EUR, etc.)
    rates[_queryType] = _result;
    // get the settings for a specific currency
    Settings storage _settings = currencySettings[_queryType];
    // event for particular rate that was updated
    RateUpdated(
      toShortString(_queryType),
      _result
    );

    // check on if should clear rate intervals
    // this is used as a way to clear out intervals for all active rates
    if (shouldClearRateIntervals) {
      _settings.callInterval = 0;
    }

    return true;
  }

  // SETTERS:

  // special function to set ACT price for use with FeeManager
  function setActRate(uint256 _actRate)
    onlyOwner
    external
    returns (bool)
  {
    require(_actRate > 0);
    rates[toBytes8("ACT")] = _actRate;
    return true;
  }

  /*
  set setting for a given currency:
  currencyName: used as identifier to store settings (stored as bytes8)
  queryString: the http endpoint to hit to get data along with format
    example: "json(https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD).USD"
  callInterval: used to specifiy how often (if at all) the rate should refresh
  callbackGasLimit: used to specify how much gas to give the oraclize callback
  */
  function setCurrencySettings(
    string _currencyName,
    string _queryString,
    uint256 _callInterval,
    uint256 _callbackGasLimit
  )
    external
    onlyOwner
    returns (bool)
  {
    // store settings by bytes8 of string, convert queryString to bytes array
    currencySettings[toBytes8(toUpperCase(_currencyName))] = Settings(
      toBytes32Array(_queryString),
      _callInterval,
      _callbackGasLimit
    );
    SettingsUpdated(_currencyName);
    return true;
  }

  // set only query string in settings
  function setCurrencySettingQueryString(
    string _currencyName,
    string _queryString
  )
    external
    onlyOwner
    returns (bool)
  {
    Settings _settings = currencySettings[toBytes8(toUpperCase(_currencyName))];
    _settings.queryString = toBytes32Array(_queryString);
    SettingsUpdated(_currencyName);
    return true;
  }

  // set only callInterval in settings
  function setCurrencySettingCallInterval(
    string _currencyName,
    uint256 _callInterval
  )
    external
    onlyOwner
    returns (bool)
  {
    Settings _settings = currencySettings[toBytes8(toUpperCase(_currencyName))];
    _settings.callInterval = _callInterval;
    SettingsUpdated(_currencyName);
    return true;
  }

  // set only callbackGasLimit in settings
  function setCurrencySettingCallbackGasLimit(
    string _currencyName,
    uint256 _callbackGasLimit
  )
    external
    onlyOwner
    returns (bool)
  {
    Settings _settings = currencySettings[toBytes8(toUpperCase(_currencyName))];
    _settings.callbackGasLimit = _callbackGasLimit;
    SettingsUpdated(_currencyName);
    return true;
  }

  // set callback gasPrice for all currencies
  function setCallbackGasPrice(uint256 _gasPrice)
    external
    onlyOwner
    returns (bool)
  {
    // get the ExchangeRateProvider from registry
    ExRatesProvider provider = ExRatesProvider(
      registry.getContractAddress("ExchangeRateProvider")
    );
    provider.setCallbackGasPrice(_gasPrice);
    SettingsUpdated("ALL");
    return true;
  }

  // set to active or inactive in order to stop recursive rate fetching
  // rate needs to be fetched once in order for it to stop.
  function toggleRatesActive()
    external
    onlyOwner
    returns (bool)
  {
    ratesActive = !ratesActive;
    SettingsUpdated("ALL");
    return true;
  }

  // set rate intervals to 0, effectively stopping rate fetching
  // AND clearing intervals
  // needs to be fetched once for settings to take effect on a rate
  function toggleClearRateIntervals()
    external
    onlyOwner
    returns (bool)
  {
    shouldClearRateIntervals = !shouldClearRateIntervals;
    SettingsUpdated("ALL");
    return true;
  }

  // GETTERS:

  // get currency settings by bytes8 for ExchangeRateProvider
  // ExchangeRateProvider cannot get by string, must be fixed size bytes
  // getting this way avoids having to define struct in ExchangeRateProvider
  function getCurrencySettings(bytes8 _queryType)
    public
    view
    returns (uint256, uint256, bytes32[5])
  {
    Settings memory _settings = currencySettings[_queryType];
    return (
      _settings.callInterval,
      _settings.callbackGasLimit,
      _settings.queryString
    );
  }

  // get currency settings by string.
  // same as getCurrencySettings but by string
  // meant for regular accounts to use more easily than with bytes8
  function getCurrencySettingsReadable(string _queryTypeString)
    external
    view
    returns (uint256, uint256, string)
  {
    // convert string to bytes8 to accesss settings item
    Settings memory _settings = currencySettings[
      toBytes8(toUpperCase(_queryTypeString))
    ];
    return (
      _settings.callInterval,
      _settings.callbackGasLimit,
      toLongString(_settings.queryString)
    );
  }

  // get rate by bytes, meant to be used by contracts
  // if the rate is 0 (errored or uninitialized), it will throw
  function getRate(bytes8 _queryTypeBytes)
    public
    view
    returns (uint256)
  {
    uint256 _rate = rates[_queryTypeBytes];
    require(_rate > 0);
    return _rate;
  }

  // same as getRate but uses string for easy use by regular accounts
  function getRateReadable(string _queryTypeString)
    external
    view
    returns (uint256)
  {
    uint256 _rate = rates[toBytes8(toUpperCase(_queryTypeString))];
    require(_rate > 0);
    return _rate;
  }

  // UTILITY FUNCTIONS:

  // convert a string to bytes8 in order to access short strings by contracts
  function toBytes8(string _string)
    pure
    public
    returns (bytes8 _convertedBytes8)
  {
    // make sure that there wont be any data loss by converting something more
    // than 8 characters long
    require(bytes(_string).length <= 8);
    assembly {
      // load memory location of _string with an offset of 32
      // to avoid non-byte data
      _convertedBytes8 := mload(add(_string, 32))
    }
  }

  // convert string to uppercase to ensure that there are not multiple
  // instances of same currencies
  function toUpperCase(string _base)
    pure
    public
    returns (string)
  {
    bytes memory _stringBytes = bytes(_base);
    for (
      uint _byteCounter = 0;
      _byteCounter < _stringBytes.length;
      _byteCounter++
    ) {
      if (
        _stringBytes[_byteCounter] >= 0x61 &&
        _stringBytes[_byteCounter] <= 0x7A
      ) {
        _stringBytes[_byteCounter] = bytes1(
          uint8(_stringBytes[_byteCounter]) - 32
        );
      }
    }
    return string(_stringBytes);
  }

  // creates a bytes32 array of 5 from string (max length 160)
  // needed for passing query strings between contracts
  function toBytes32Array(string _string)
    pure
    public
    returns(bytes32[5])
  {
    bytes memory _stringBytes = bytes(_string);
    require(bytes(_stringBytes).length <= 5 * 32);
    uint _bytes32ArrayByteCount = 5 * 32;
    uint _remainingBytes32Bytes;
    uint _bytes32HolderIndex = 0;
    bytes memory _bytes32Holder = new bytes(32);
    string memory _stringSegmentHolder;
    bytes32 _convertedBytes32;
    bytes32[5] memory _bytes32ArrayResult;

    uint _bytes32Counter = 0;
    // loop through each byte in in a bytes32 array with a length of 5
    for (
      uint _byteCounter = 1;
      _byteCounter <= _bytes32ArrayByteCount;
      _byteCounter++
    ) {
      // check to see if a bytes32 block is complete
      _remainingBytes32Bytes = _byteCounter % 32;
      if (_remainingBytes32Bytes == 0) {
        // check to see if we have already written out all string bytes
        if (_byteCounter > _stringBytes.length) {
          _bytes32Holder[_bytes32HolderIndex] = 0x0;
        } else {
          _bytes32Holder[_bytes32HolderIndex] = _stringBytes[_byteCounter - 1];
        }

        _bytes32HolderIndex = 0;
        _stringSegmentHolder = string(_bytes32Holder);

        assembly {
          _convertedBytes32 := mload(add(_stringSegmentHolder, 32))
        }

        _bytes32ArrayResult[_bytes32Counter] = _convertedBytes32;
        _bytes32Counter = _bytes32Counter + 1;
      } else {
        if (_byteCounter > _stringBytes.length) {
          _bytes32Holder[_bytes32HolderIndex] = 0x0;
        } else {
          _bytes32Holder[_bytes32HolderIndex] = _stringBytes[_byteCounter - 1];
        }

        _bytes32HolderIndex = _bytes32HolderIndex + 1;
      }
    }
    return _bytes32ArrayResult;
  }

  // convert bytes8 back to string, for use in readable events
  function toShortString(bytes8 _data)
    pure
    public
    returns (string)
  {
    bytes memory _bytesString = new bytes(8);
    uint256 _charCount = 0;
    uint256 _bytesCounter;
    uint256 _charCounter;

    // loop through converted bytes from string
    for (_bytesCounter = 0; _bytesCounter < 8; _bytesCounter++) {
      /*
      convert bytes32 data to uint in order to increase the number enough to
      shift bytes further left while pushing out leftmost bytes
      then convert uint256 data back to bytes32
      then convert to bytes1 where everything but the leftmost hex value (byte)
      is cutoff leaving only the leftmost byte

      TLDR: takes a single character from bytes based on counter
      */
      bytes1 _char = bytes1(bytes8(uint256(_data) * 2 ** (8 * _bytesCounter)));
      if (_char != 0) {
        _bytesString[_charCount] = _char;
        _charCount++;
      }
    }

    // create new bytes with correct length of string
    bytes memory _bytesStringTrimmed = new bytes(_charCount);

    // loop through correct length bytes and throw in data from _bytesString
    // which is probably padded
    for (_charCounter = 0; _charCounter < _charCount; _charCounter++) {
      _bytesStringTrimmed[_charCounter] = _bytesString[_charCounter];
    }

    // return string which has been trimmed of any padding converted from bytes
    return string(_bytesStringTrimmed);
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

  function killProvider(address _address)
    public
    onlyOwner
  {
    // get the ExchangeRateProvider from registry
    ExRatesProvider provider = ExRatesProvider(
      registry.getContractAddress("ExchangeRateProvider")
    );
    provider.selfDestruct(_address);
  }

  // we don't need to send money to this contract.
  // we do need to send to ExchangeRateProvider
  function()
    payable
    public
  {
    revert();
  }
}
