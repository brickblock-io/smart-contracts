pragma solidity 0.4.24;


/**
  @title PoaProxyCommon acts as a convention between:
  - PoaCommon (and its inheritants: PoaToken & PoaCrowdsale)
  - PoaProxy

  It dictates where to read and write specific non sequential storage
*/
contract PoaProxyCommon {
  /*****************************************************
  * Start Proxy Common Non-Sequential Storage Pointers *
  *****************************************************/

  /*
    These are commonly agreed upon storage slots
    which other contracts can use in order to get & set.
    Constants do not use storage so they can be safely shared.
  */

  // Slot for the PoaTokenMaster logic contract used by proxies
  // TYPE: address
  bytes32 public constant poaTokenMasterSlot = keccak256("PoaTokenMaster");

  // Slot for the PoaCrowdsaleMaster logic contract used by proxies
  // TYPE: address
  bytes32 public constant poaCrowdsaleMasterSlot = keccak256("PoaCrowdsaleMaster");

  // Slot for the Registry used for getting other contract addresses
  // TYPE: address
  bytes32 public constant registrySlot = keccak256("registry");

  /****************************************************
  * End Proxy Common Non-Sequential Storage Pointers *
  ****************************************************/


  /************************************************************
  * Start Proxy Common Non-Sequential Storage Getters/Setters *
  ************************************************************/

  /**
    @dev Each function without a "set" prefix in this section is a public getter for a
    specific non-sequential storage slot.

    Setter functions, starting with "set", are internal and can only be called by this
    contract, or contracts inheriting from it. Both getters and setters work on commonly
    agreed upon storage slots in order to avoid storage collisions.
  */

  function poaTokenMaster()
    public
    view
    returns (address _poaTokenMaster)
  {
    bytes32 _poaTokenMasterSlot = poaTokenMasterSlot;
    assembly {
      _poaTokenMaster := sload(_poaTokenMasterSlot)
    }
  }

  function setPoaTokenMaster(
    address _poaTokenMaster
  )
    internal
  {
    bytes32 _poaTokenMasterSlot = poaTokenMasterSlot;
    assembly {
      sstore(_poaTokenMasterSlot, _poaTokenMaster)
    }
  }

  function poaCrowdsaleMaster()
    public
    view
    returns (address _poaCrowdsaleMaster)
  {
    bytes32 _poaCrowdsaleMasterSlot = poaCrowdsaleMasterSlot;
    assembly {
      _poaCrowdsaleMaster := sload(_poaCrowdsaleMasterSlot)
    }
  }

  function setPoaCrowdsaleMaster(
    address _poaCrowdsaleMaster
  )
    internal
  {
    bytes32 _poaCrowdsaleMasterSlot = poaCrowdsaleMasterSlot;
    assembly {
      sstore(_poaCrowdsaleMasterSlot, _poaCrowdsaleMaster)
    }
  }

  function registry()
    public
    view
    returns (address _registry)
  {
    bytes32 _registrySlot = registrySlot;
    assembly {
      _registry := sload(_registrySlot)
    }
  }

  function setRegistry(
    address _registry
  )
    internal
  {
    bytes32 _registrySlot = registrySlot;
    assembly {
      sstore(_registrySlot, _registry)
    }
  }

  /**********************************************************
  * End Proxy Common Non-Sequential Storage Getters/Setters *
  **********************************************************/


  /*********************************
  * Start Common Utility Functions *
  *********************************/

  /// @notice Gets a given contract address by bytes32 in order to save gas
  function getContractAddress
  (
    string _name
  )
    public
    view
    returns (address _contractAddress)
  {
    bytes4 _signature = bytes4(keccak256("getContractAddress32(bytes32)"));
    bytes32 _name32 = keccak256(abi.encodePacked(_name));
    address _registry = registry();

    assembly {
      let _pointer := mload(0x40)          // Set _pointer to free memory pointer
      mstore(_pointer, _signature)         // Store _signature at _pointer
      mstore(add(_pointer, 0x04), _name32) // Store _name32 at _pointer offset by 4 bytes for pre-existing _signature

      // staticcall(g, a, in, insize, out, outsize) => returns 0 on error, 1 on success
      let result := staticcall(
        gas,       // g = gas: whatever was passed already
        _registry, // a = address: address in storage
        _pointer,  // in = mem in  mem[in..(in+insize): set to free memory pointer
        0x24,      // insize = mem insize  mem[in..(in+insize): size of signature (bytes4) + bytes32 = 0x24
        _pointer,  // out = mem out  mem[out..(out+outsize): output assigned to this storage address
        0x20       // outsize = mem outsize  mem[out..(out+outsize): output should be 32byte slot (address size = 0x14 <  slot size 0x20)
      )

      // revert if not successful
      if iszero(result) {
        revert(0, 0)
      }

      _contractAddress := mload(_pointer) // Assign result to return value
      mstore(0x40, add(_pointer, 0x24))   // Advance free memory pointer by largest _pointer size
    }
  }

  /*******************************
  * End Common Utility Functions *
  *******************************/
}
