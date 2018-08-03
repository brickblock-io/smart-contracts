/* solium-disable security/no-low-level-calls */

pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./PoaProxyCommon.sol";


/**
  @title Firstly, PoaCommon acts as a convention between:
  - PoaToken
  - PoaCrowdsale
  to use agreed upon storage for getting & setting
  variables which are used by both contracts.

  Secondly, it has a set of shared functions.

  Thirdly, it inherits from PoaProxyCommon to adhere to the agreed
  upon storage slots for getting & setting PoaProxy related storage.
*/
contract PoaCommon is PoaProxyCommon {
  using SafeMath for uint256;

  // The fee paid to the BBK network per crowdsale investment and per payout
  // NOTE: Tracked in permille (and NOT percent) to reduce dust and
  // inaccuracies caused by integer division
  uint256 public constant feeRateInPermille = 5; // read: 0.5%

  // An enum representing all stages a contract can be in.
  // Different stages enable or restrict certain functionality.
  enum Stages {
    PreFunding,        // 0
    FiatFunding,       // 1
    EthFunding,        // 2
    FundingSuccessful, // 3
    FundingCancelled,  // 4
    TimedOut,          // 5
    Active,            // 6
    Terminated         // 7
  }

  /***********************
  * Start Common Storage *
  ***********************/

  // Represents current stage
  Stages public stage;

  // Broker in charge of starting sale, paying fee and handling payouts
  address public broker;

  // Custodian in charge of taking care of asset and payouts
  address public custodian;

  // IPFS hash storing the proof of custody provided by custodian
  bytes32[2] internal proofOfCustody32_;

  // ERC20 totalSupply
  uint256 internal totalSupply_;

  // Tracks the total amount of tokens sold during the FiatFunding stage
  uint256 public fundedAmountInTokensDuringFiatFunding;

  // Tracks the Fiat investments per user raised during the FiatFunding stage
  mapping(address => uint256) public fiatInvestmentPerUserInTokens;

  // Tracks the total amount of ETH raised during the EthFunding stage.
  // NOTE: We can't use `address(this).balance` because after activating the
  // POA contract, its balance will become `claimable` by the broker and can
  // therefore no longer be used to calculate balances.
  uint256 public fundedAmountInWei;

  // Tracks the ETH investments per user raised during the EthFunding stage
  mapping(address => uint256) public investmentAmountPerUserInWei;

  // Tracks unclaimed payouts per user
  mapping(address => uint256) public unclaimedPayoutTotals;

  // ERC20 paused - Used for enabling/disabling token transfers
  bool public paused;

  // Indicates if poaToken has been initialized
  bool public tokenInitialized;

  /*********************
  * End Common Storage *
  *********************/

  /**************************
  * Start Crowdsale Storage *
  **************************/

  /*
    Crowdsale storage must be declared in PoaCommon in order to
    avoid storage overwrites by PoaCrowdsale.
  */

  // Bool indicating whether or not crowdsale proxy has been initialized
  bool public crowdsaleInitialized;

  // Used for checking when contract should move from PreFunding or FiatFunding to EthFunding stage
  uint256 public startTime;

  // Amount of seconds (starting at startTime) until moving from EthFunding to TimedOut stage
  uint256 public fundingTimeout;

  // Amount of seconds (starting at startTime + fundingTimeout) until moving from FundingSuccessful stage to TimedOut
  uint256 public activationTimeout;

  // bytes32 representation fiat currency symbol used to get rate
  bytes32 public fiatCurrency32;

  // Amount needed before moving to 'FundingSuccessful', calculated in fiat
  uint256 public fundingGoalInCents;

  // Used for keeping track of actual funded amount in fiat during FiatFunding stage
  uint256 public fundedAmountInCentsDuringFiatFunding;

  /************************
  * End Crowdsale Storage *
  ************************/

  /*************************
  * Start Common Modifiers *
  *************************/

  modifier onlyCustodian() {
    require(msg.sender == custodian);
    _;
  }

  modifier onlyBroker() {
    require(msg.sender == broker);
    _;
  }

  modifier atStage(Stages _stage) {
    require(stage == _stage);
    _;
  }

  modifier atEitherStage(Stages _stage, Stages _orStage) {
    require(stage == _stage || stage == _orStage);
    _;
  }

  /**
    @notice Check that the most common hashing algo is used (keccak256)
    and that its length is correct. In theory, it could be different.
    But the use of this functionality is limited to "onlyCustodian"
    so this validation should suffice.
  */
  modifier validIpfsHash(bytes32[2] _ipfsHash) {
    bytes memory _ipfsHashBytes = bytes(to64LengthString(_ipfsHash));
    require(_ipfsHashBytes.length == 46);
    require(_ipfsHashBytes[0] == 0x51);
    require(_ipfsHashBytes[1] == 0x6D);
    require(keccak256(abi.encodePacked(_ipfsHashBytes)) != keccak256(abi.encodePacked(proofOfCustody())));
    _;
  }

  /***********************
  * End Common Modifiers *
  ***********************/


  /************************
  * Start Regular Getters *
  ************************/

  /**
    @notice Converts proofOfCustody from bytes32 to string
    @return string
   */
  function proofOfCustody()
    public
    view
    returns (string)
  {
    return to64LengthString(proofOfCustody32_);
  }

  /**********************
  * End Regular Getters *
  **********************/


  /***********************************
  * Start Common Lifecycle Functions *
  ***********************************/

  function enterStage(Stages _stage)
    internal
  {
    stage = _stage;
    getContractAddress("Logger").call(
      bytes4(keccak256("logStageEvent(uint256)")),
      _stage
    );
  }

  /*********************************
  * End Common Lifecycle Functions *
  *********************************/


  /*********************************
  * Start Common Utility Functions *
  *********************************/

  /// @notice Utility function calculating the necessary fee for a given amount
  /// @return uint256 Payable fee
  function calculateFee(uint256 _value)
    public
    pure
    returns (uint256)
  {
    return feeRateInPermille.mul(_value).div(1000);
  }

  /// @notice Pay fee to FeeManager contract
  /// @return true if fee payment succeeded, or false if it failed
  function payFee(uint256 _value)
    internal
    returns (bool)
  {
    require(
      // NOTE: It's an `internal` call and we know exactly what
      // we're calling so it's safe to ignore this solium warning.
      // solium-disable-next-line security/no-call-value
      getContractAddress("FeeManager")
        .call.value(_value)(bytes4(keccak256("payFee()")))
    );
  }

  /// @notice Checks if a given address has invested during the FiatFunding stage.
  function isFiatInvestor(
    address _buyer
  )
    internal
    view
    returns(bool)
  {
    return fiatInvestmentPerUserInTokens[_buyer] != 0;
  }

  /// @notice Checks if a given address is whitelisted
  /// @return true if address is whitelisted, false if not
  function isWhitelisted
  (
    address _address
  )
    public
    view
    returns (bool _isWhitelisted)
  {
    bytes4 _signature = bytes4(keccak256("whitelisted(address)"));
    address _whitelistContract = getContractAddress("Whitelist");

    assembly {
      let _pointer := mload(0x40)  // Set _pointer to free memory pointer
      mstore(_pointer, _signature) // Store _signature at _pointer
      mstore(add(_pointer, 0x04), _address) // Store _address at _pointer. Offset by 4 bytes for previously stored _signature

      // staticcall(g, a, in, insize, out, outsize) => returns 0 on error, 1 on success
      let result := staticcall(
        gas,                // g = gas: whatever was passed already
        _whitelistContract, // a = address: _whitelist address assigned from getContractAddress()
        _pointer,           // in = mem in  mem[in..(in+insize): set to _pointer pointer
        0x24,               // insize = mem insize  mem[in..(in+insize): size of signature (bytes4) + bytes32 = 0x24
        _pointer,           // out = mem out  mem[out..(out+outsize): output assigned to this storage address
        0x20                // outsize = mem outsize  mem[out..(out+outsize): output should be 32byte slot (bool size = 0x01 < slot size 0x20)
      )

      // Revert if not successful
      if iszero(result) {
        revert(0, 0)
      }

      _isWhitelisted := mload(_pointer) // Assign result to returned value
      mstore(0x40, add(_pointer, 0x24)) // Advance free memory pointer by largest _pointer size
    }
  }

  /// @notice Takes a single bytes32 and returns a max 32 char long string
  /// @param _data single bytes32 representation of a string
  function to32LengthString(
    bytes32 _data
  )
    internal
    pure
    returns (string)
  {
    // Create new empty bytes array with same length as input
    bytes memory _bytesString = new bytes(32);

    // Keep track of string length for later usage in trimming
    uint256 _stringLength;

    // Loop through each byte in bytes32
    for (uint _bytesCounter = 0; _bytesCounter < 32; _bytesCounter++) {
      /*
        Convert bytes32 data to uint256 in order to increase the number enough to
        shift bytes further left while pushing out leftmost bytes.
        Then convert uint256 data back to bytes32.
        Then convert bytes32 data to bytes1 where everything but the leftmost hex value (byte)
        is cut off, leaving only the leftmost byte.

        TL;DR: Takes a single character from a bytes32 based on a counter
      */
      bytes1 _char = bytes1(
        bytes32(
          uint(_data) * 2 ** (8 * _bytesCounter)
        )
      );

      // Add the character if not empty
      if (_char != 0) {
        _bytesString[_stringLength] = _char;
        _stringLength += 1;
      }
    }

    // New bytes with matching string length
    bytes memory _bytesStringTrimmed = new bytes(_stringLength);

    // Loop through _bytesStringTrimmed throwing in non empty data from _bytesString
    for (_bytesCounter = 0; _bytesCounter < _stringLength; _bytesCounter++) {
      _bytesStringTrimmed[_bytesCounter] = _bytesString[_bytesCounter];
    }

    // Return trimmed bytes array converted to string
    return string(_bytesStringTrimmed);
  }

  /// @notice Needed for longer strings up to 64 chars long
  /// @param _data 2 length sized array of bytes32
  function to64LengthString(
    bytes32[2] _data
  )
    internal
    pure
    returns (string)
  {
    // Create new empty bytes array with same length as input
    bytes memory _bytesString = new bytes(_data.length * 32);

    // Keep track of string length for later usage in trimming
    uint256 _stringLength;

    // Loop through each bytes32 in the array
    for (uint _arrayCounter = 0; _arrayCounter < _data.length; _arrayCounter++) {

      // Loop through each byte in the bytes32
      for (uint _bytesCounter = 0; _bytesCounter < 32; _bytesCounter++) {
        /*
          Convert bytes32 data to uint in order to increase the number enough to
          shift bytes further left while pushing out leftmost bytes.
          Then convert uint256 data back to bytes32
          Then convert bytes32 data to bytes1 where everything but the leftmost hex value (byte)
          is cut off, leaving only the leftmost byte.

          TL;DR: Takes a single character from a bytes32 based on a counter
        */
        bytes1 _char = bytes1(
          bytes32(
            uint(_data[_arrayCounter]) * 2 ** (8 * _bytesCounter)
          )
        );

        // Add the character if not empty
        if (_char != 0) {
          _bytesString[_stringLength] = _char;
          _stringLength += 1;
        }
      }
    }

    // New bytes with correct matching string length
    bytes memory _bytesStringTrimmed = new bytes(_stringLength);

    // Loop through _bytesStringTrimmed throwing in non empty data from _bytesString
    for (_bytesCounter = 0; _bytesCounter < _stringLength; _bytesCounter++) {
      _bytesStringTrimmed[_bytesCounter] = _bytesString[_bytesCounter];
    }

    // Return trimmed bytes array converted to string
    return string(_bytesStringTrimmed);
  }

  /*******************************
  * End Common Utility Functions *
  *******************************/
}
