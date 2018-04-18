pragma solidity 0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";


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


contract Registry {
  function getContractAddress(string _name)
    public
    view
    returns (address)
  {}
}


contract ExchangeRateProviderStub {
  Registry private registry;
  // used to check on if the contract has self destructed
  bool public isAlive = true;
  // used for testing simulated pending query
  bytes32 public pendingTestQueryId;
  // used for tetsing simulated testing recursion
  bytes8 public pendingQueryType;
  // used to check if should call again when testing recurision
  uint256 public shouldCallAgainIn;
  // used to check callback gas when testing recursion
  uint256 public shouldCallAgainWithGas;
  // used to check queryString when testing recursion
  string public shouldCallAgainWithQuery;
  // used to check simulated gas price setting
  uint256 public callbackGasPrice;

  // ensure that only the oracle or ExchangeRates contract are allowed
  modifier onlyAllowed()
  {
    require(
      msg.sender == registry.getContractAddress("ExchangeRates")
    );
    _;
  }

  modifier onlyExchangeRates()
  {
    require(msg.sender == registry.getContractAddress("ExchangeRates"));
    _;
  }

  // constructor: set registry address
  function ExchangeRateProviderStub(address _registryAddress)
    public
  {
    require(_registryAddress != address(0));
    registry = Registry(_registryAddress);
  }

  // SIMULATE: set callbackGasPrice
  function setCallbackGasPrice(uint256 _gasPrice)
    onlyExchangeRates
    external
    returns (bool)
  {
    callbackGasPrice = _gasPrice;
    return true;
  }

  // SIMULATE: send query to oraclize, results sent to __callback
  // money can be forwarded on from ExchangeRates
  // leave out modifier as shown in
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
    // simulate price of 2 000 000 000
    uint256 _simulatedPrice = 2e9;
    if (_simulatedPrice > this.balance) {
      // set to empty if not enought ether
      setQueryId(0x0, 0x0);
      return false;
    } else {
      // simulate _queryId by hashing first element of bytes32 array
      pendingTestQueryId = keccak256(_queryString[0]);
      setQueryId(pendingTestQueryId, _queryType);
      return true;
    }
  }

  // set queryIds on ExchangeRates for later validation when __callback happens
  function setQueryId(bytes32 _identifier, bytes8 _queryType)
    public
    returns (bool)
  {
    // get current address of ExchangeRates
    ExRates _exchangeRates = ExRates(
      registry.getContractAddress("ExchangeRates")
    );
    pendingTestQueryId = _identifier;
    // run setQueryId on ExchangeRates
    _exchangeRates.setQueryId(_identifier, _queryType);
  }

  // SIMULATE: callback function to get results of oraclize call
  function simulate__callback(bytes32 _queryId, string _result)
    public
  {
    // make sure that the caller is oraclize
    ExRates _exchangeRates = ExRates(
      registry.getContractAddress("ExchangeRates")
    );

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

    // set rate on ExchangeRates contract
    _exchangeRates.setRate(_queryId, parseInt(_result));

    if (_callInterval > 0 && _ratesActive) {
      pendingTestQueryId = keccak256(_result);
      pendingQueryType = _queryType;
      shouldCallAgainWithQuery = toLongString(_queryString);
      shouldCallAgainIn = _callInterval;
      shouldCallAgainWithGas = _callbackGasLimit;
    } else {
      delete pendingTestQueryId;
      delete pendingQueryType;
      shouldCallAgainWithQuery = "";
      shouldCallAgainIn = 0;
      shouldCallAgainWithGas = 0;
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

  // taken from oraclize in order to parseInts during testing
  // parseInt
  function parseInt(string _a)
    internal
    pure
    returns (uint)
  {
    return parseInt(_a, 0);
  }

  // parseInt(parseFloat*10^_b)
  function parseInt(string _a, uint _b)
    internal
    pure
    returns (uint)
  {
    bytes memory bresult = bytes(_a);
    uint mint = 0;
    bool decimals = false;
    for (uint i = 0; i < bresult.length; i++) {
      if ((bresult[i] >= 48) && (bresult[i] <= 57)) {
        if (decimals) {
          if (_b == 0)
            break;
          else
            _b--;
        }
        mint *= 10;
        mint += uint(bresult[i]) - 48;
      } else if (bresult[i] == 46)
        decimals = true;
    }
    if (_b > 0)
      mint *= 10 ** _b;
    return mint;
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
