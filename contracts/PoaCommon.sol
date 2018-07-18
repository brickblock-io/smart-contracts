/* solium-disable security/no-low-level-calls */

pragma solidity 0.4.23;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./PoaProxyCommon.sol";


/**
  @title Firstly, PoaCommon acts as an agreement between PoaToken and PoaCrowdsale
  to use agreed upon non-sequential storage for getting & setting
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
    PreFunding,  // 0
    FiatFunding, // 1
    EthFunding,  // 2
    Pending,     // 3
    Failed,      // 4
    Active,      // 5
    Terminated,  // 6
    Cancelled    // 7
  }

  /***********************************************
  * Start Common Non-Sequential Storage Pointers *
  ***********************************************/

  /*
    These are commonly agreed upon storage slots
    which other contracts can use in order to get & set.
    Constants do not use storage so they can be safely shared.
  */

  // Represents current stage
  // TYPE: Stage
  bytes32 internal constant stageSlot = keccak256("stage");

  // Custodian in charge of taking care of asset and payouts
  // TYPE: address
  bytes32 internal constant custodianSlot = keccak256("custodian");

  // IPFS hash storing the proof of custody provided by custodian
  // TYPE: bytes32[2]
  bytes32 internal constant proofOfCustody32Slot = keccak256("proofOfCustody32");

  // ERC20 totalSupply
  // TYPE: uint256
  bytes32 internal constant totalSupplySlot = keccak256("totalSupply");

  // Tracks the total amount of tokens sold during the FiatFunding stage
  // TYPE: uint256
  bytes32 internal constant fundedAmountInTokensDuringFiatFundingSlot =
  keccak256("fundedAmountInTokensDuringFiatFunding");

  // Tracks the Fiat investments per user raised during the FiatFunding stage
  // TYPE: mapping(address => uint256)
  bytes32 internal constant fiatInvestmentPerUserInTokensSlot =
  keccak256("fiatInvestmentPerUserInTokens");

  // Tracks the total amount of ETH raised during the EthFunding stage.
  // NOTE: We can't use `address(this).balance` because after activating the
  // POA contract, its balance will become `claimable` by the broker and can
  // therefore no longer be used to calculate balances.
  // TYPE: uint256
  bytes32 internal constant fundedAmountInWeiSlot = keccak256("fundedAmountInWei");

  // Tracks the ETH investments per user raised during the EthFunding stage
  // TYPE: mapping(address => uint256)
  bytes32 internal constant investmentAmountPerUserInWeiSlot =
  keccak256("investmentAmountPerUserInWei");

  // Tracks unclaimed payouts per user
  // TYPE: mapping(address => uint256)
  bytes32 internal constant unclaimedPayoutTotalsSlot = keccak256("unclaimedPayoutTotals");

  // ERC20 paused - Used for enabling/disabling token transfers
  // TYPE: bool
  bytes32 internal constant pausedSlot = keccak256("paused");

  // Indicates if poaToken has been initialized
  // TYPE: bool
  bytes32 internal constant tokenInitializedSlot = keccak256("tokenInitialized");

  /*********************************************
  * End Common Non-Sequential Storage Pointers *
  *********************************************/


  /*************************
  * Start Common Modifiers *
  *************************/

  modifier onlyCustodian() {
    require(msg.sender == custodian());
    _;
  }

  modifier atStage(Stages _stage) {
    require(stage() == _stage);
    _;
  }

  modifier atEitherStage(Stages _stage, Stages _orStage) {
    require(stage() == _stage || stage() == _orStage);
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
    require(keccak256(_ipfsHashBytes) != keccak256(bytes(proofOfCustody())));
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
    return to64LengthString(proofOfCustody32());
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
    setStage(_stage);
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
    return fiatInvestmentPerUserInTokens(_buyer) != 0;
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
        0x24,               // insize = mem insize  mem[in..(in+insize): size of sig (bytes4) + bytes32 = 0x24
        _pointer,           // out = mem out  mem[out..(out+outsize): output assigned to this storage address
        0x20                // outsize = mem outsize  mem[out..(out+outsize): output should be 32byte slot (bool size = 0x01 < slot size 0x20)
      )

      // Revert if not successful
      if iszero(result) {
        revert(0, 0)
      }

      _isWhitelisted := mload(_pointer) // assign result to returned value
      mstore(0x40, add(_pointer, 0x24)) // advance free memory pointer by largest _pointer size
    }
  }

  /// @notice Takes a single bytes32 and returns a max 32 char long string
  /// @param _data single bytes32 representation of a string
  function to32LengthString(
    bytes32 _data
  )
    pure
    internal
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
    pure
    internal
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


  /******************************************************
  * Start Common Non-Sequential Storage Getters/Setters *
  ******************************************************/

  /*
    Each function without a "set" prefix in this section is a public getter for a
    specific non-sequential storage slot.

    Setter functions, starting with "set", are internal and can only be called by this
    contract, or contracts inheriting from it. Both getters and setters work on commonly
    agreed upon storage slots in order to avoid storage collisions.
  */

  function stage()
    public
    view
    returns (Stages _stage)
  {
    bytes32 _stageSlot = stageSlot;
    assembly {
      _stage := sload(_stageSlot)
    }
  }

  function setStage(Stages _stage)
    internal
  {
    bytes32 _stageSlot = stageSlot;
    assembly {
      sstore(_stageSlot, _stage)
    }
  }

  function custodian()
    public
    view
    returns (address _custodian)
  {
    bytes32 _custodianSlot = custodianSlot;
    assembly {
      _custodian := sload(_custodianSlot)
    }
  }

  function setCustodian(address _custodian)
    internal
  {
    bytes32 _custodianSlot = custodianSlot;
    assembly {
      sstore(_custodianSlot, _custodian)
    }
  }

  function proofOfCustody32()
    public
    view
    returns (bytes32[2] _proofOfCustody32)
  {
    bytes32 _proofOfCustody32Slot = proofOfCustody32Slot;

    assembly {
      mstore(_proofOfCustody32, sload(_proofOfCustody32Slot))
      mstore(add(_proofOfCustody32, 0x20), sload(add(_proofOfCustody32Slot, 0x01)))
    }
  }

  function setProofOfCustody32(
    bytes32[2] _proofOfCustody32
  )
    internal
  {
    bytes32 _proofOfCustody32Slot = proofOfCustody32Slot;
    assembly {
      // Store first slot from memory
      sstore(
        _proofOfCustody32Slot,
        mload(_proofOfCustody32)
      )
      // Store second slot from memory
      sstore(
        add(_proofOfCustody32Slot, 0x01),
        mload(
          add(_proofOfCustody32, 0x20)
        )
      )
    }
  }

  function totalSupply()
    public
    view
    returns (uint256 _totalSupply)
  {
    bytes32 _totalSupplySlot = totalSupplySlot;
    assembly {
      _totalSupply := sload(_totalSupplySlot)
    }
  }

  function setTotalSupply(uint256 _totalSupply)
    internal
  {
    bytes32 _totalSupplySlot = totalSupplySlot;
    assembly {
      sstore(_totalSupplySlot, _totalSupply)
    }
  }

  function fundedAmountInTokensDuringFiatFunding()
    public
    view
    returns (uint256 _fundedAmountInTokensDuringFiatFunding)
  {
    bytes32 _fundedAmountInTokensDuringFiatFundingSlot = fundedAmountInTokensDuringFiatFundingSlot;
    assembly {
      _fundedAmountInTokensDuringFiatFunding := sload(
        _fundedAmountInTokensDuringFiatFundingSlot
      )
    }
  }

  function setFundedAmountInTokensDuringFiatFunding(
    uint256 _amount
  )
    internal
  {
    bytes32 _fundedAmountInTokensDuringFiatFundingSlot = fundedAmountInTokensDuringFiatFundingSlot;
    assembly {
      sstore(
        _fundedAmountInTokensDuringFiatFundingSlot,
        _amount
      )
    }
  }

  function fiatInvestmentPerUserInTokens(
    address _address
  )
    public
    view
    returns (uint256 _fiatInvested)
  {
    bytes32 _entrySlot = keccak256(
      abi.encodePacked(_address, fiatInvestmentPerUserInTokensSlot)
    );
    assembly {
      _fiatInvested := sload(_entrySlot)
    }
  }

  function setFiatInvestmentPerUserInTokens(
    address _address,
    uint256 _fiatInvestment
  )
    internal
  {
    bytes32 _entrySlot = keccak256(
      abi.encodePacked(_address, fiatInvestmentPerUserInTokensSlot)
    );
    assembly {
      sstore(_entrySlot, _fiatInvestment)
    }
  }

  function fundedAmountInWei()
    public
    view
    returns (uint256 _fundedAmountInWei)
  {
    bytes32 _fundedAmountInWeiSlot = fundedAmountInWeiSlot;
    assembly {
      _fundedAmountInWei := sload(_fundedAmountInWeiSlot)
    }
  }

  function setFundedAmountInWei(
    uint256 _fundedAmountInWei
  )
    internal
  {
    bytes32 _fundedAmountInWeiSlot = fundedAmountInWeiSlot;
    assembly {
      sstore(_fundedAmountInWeiSlot, _fundedAmountInWei)
    }
  }

  function investmentAmountPerUserInWei(
    address _address
  )
    public
    view
    returns (uint256 _investmentAmountPerUserInWei)
  {
    bytes32 _entrySlot = keccak256(
      abi.encodePacked(_address, investmentAmountPerUserInWeiSlot)
    );
    assembly {
      _investmentAmountPerUserInWei := sload(_entrySlot)
    }
  }

  function setInvestmentAmountPerUserInWei(
    address _address,
    uint256 _amount
  )
    internal
  {
    bytes32 _entrySlot = keccak256(
      abi.encodePacked(_address, investmentAmountPerUserInWeiSlot)
    );
    assembly {
      sstore(_entrySlot, _amount)
    }
  }

  function unclaimedPayoutTotals(
    address _address
  )
    public
    view
    returns (uint256 _unclaimedPayoutTotals)
  {
    bytes32 _entrySlot = keccak256(
      abi.encodePacked(_address, unclaimedPayoutTotalsSlot)
    );
    assembly {
      _unclaimedPayoutTotals := sload(_entrySlot)
    }
  }

  function setUnclaimedPayoutTotals(
    address _address,
    uint256 _amount
  )
    internal
  {
    bytes32 _entrySlot = keccak256(
      abi.encodePacked(_address, unclaimedPayoutTotalsSlot)
    );
    assembly {
      sstore(_entrySlot, _amount)
    }
  }

  function paused()
    public
    view
    returns (bool _paused)
  {
    bytes32 _pausedSlot = pausedSlot;
    assembly {
      _paused := sload(_pausedSlot)
    }
  }

  function setPaused(
    bool _paused
  )
    internal
  {
    bytes32 _pausedSlot = pausedSlot;
    assembly {
      sstore(_pausedSlot, _paused)
    }
  }

  function tokenInitialized()
    public
    view
    returns (bool _tokenInitialized)
  {
    bytes32 _tokenInitializedSlot = tokenInitializedSlot;
    assembly {
      _tokenInitialized := sload(_tokenInitializedSlot)
    }
  }

  function setTokenInitialized(
    bool _tokenInitialized
  )
    internal
  {
    bytes32 _tokenInitializedSlot = tokenInitializedSlot;
    assembly {
      sstore(_tokenInitializedSlot, _tokenInitialized)
    }
  }

  /****************************************************
  * End Common Non-Sequential Storage Getters/Setters *
  ****************************************************/
}
