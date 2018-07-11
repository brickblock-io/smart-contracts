pragma solidity 0.4.23;


/*
  PoaProxyCommon acts as a "contract" between:
  - PoaCommon (indirectly PoaToken & PoaCrowdsale)
  - PoaProxy

  This "contract" dictates where to read and write specific non sequential storage
*/
contract PoaProxyCommon {
  //
  // start proxy common non-sequential storage pointers
  //

  /*
    These are commonly agreed upon storage slots
    which other contracts can use in order to get & set.

    Constants do not use storage so they can be safely shared.
  */
  // TYPE: ADDRESS
  bytes32 public constant poaTokenMasterSlot = keccak256("PoaTokenMaster");
  // TYPE: ADDRESS
  bytes32 public constant poaCrowdsaleMasterSlot = keccak256("PoaCrowdsaleMaster");
  // TYPE: ADDRESS
  bytes32 public constant registrySlot = keccak256("registry");

  //
  // end proxy common non-sequential storage pointers
  //

  //
  // start proxy common non-sequential storage getters/setters
  //

  /*
    Each function in this section without "set" prefix is a getter for a specific
    non-sequential storage  slot which can be called by either a user or the contract.
    Functions with "set" are internal and can only be called by the contract/inherited contracts.

    Both getters and setters work on commonly agreed up storage slots in order to avoid collisions.
  */

  // contract address of poaTokenMaster, used for delegatecalls
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

  // contract address of poaCrowdsaleMaster, used for delegatecalls
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

  // contract address of the registry, used for calling other contracts
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

  //
  // end proxy common non-sequential storage getters/setters
  //

  //
  // start common utility functions
  //

  // gets a given contract address by bytes32 saving gas
  function getContractAddress
  (
    string _name
  )
    public
    view
    returns (address _contractAddress)
  {
    bytes4 _sig = bytes4(keccak256("getContractAddress32(bytes32)"));
    bytes32 _name32 = keccak256(_name);
    address _registry = registry();

    assembly {
      let _call := mload(0x40)          // set _call to free memory pointer
      mstore(_call, _sig)               // store _sig at _call pointer
      mstore(add(_call, 0x04), _name32) // store _name32 at _call offset by 4 bytes for pre-existing _sig

      // staticcall(g, a, in, insize, out, outsize) => 0 on error 1 on success
      let success := staticcall(
        gas,    // g = gas: whatever was passed already
        _registry,  // a = address: address in storage
        _call,  // in = mem in  mem[in..(in+insize): set to free memory pointer
        0x24,   // insize = mem insize  mem[in..(in+insize): size of sig (bytes4) + bytes32 = 0x24
        _call,   // out = mem out  mem[out..(out+outsize): output assigned to this storage address
        0x20    // outsize = mem outsize  mem[out..(out+outsize): output should be 32byte slot (address size = 0x14 <  slot size 0x20)
      )

      // revert if not successful
      if iszero(success) {
        revert(0, 0)
      }

      _contractAddress := mload(_call) // assign result to return value
      mstore(0x40, add(_call, 0x24)) // advance free memory pointer by largest _call size
    }
  }

  //
  // end common utility functions
  //

}
