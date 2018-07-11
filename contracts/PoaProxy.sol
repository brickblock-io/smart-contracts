pragma solidity 0.4.23;

import "./PoaProxyCommon.sol";

/* solium-disable security/no-low-level-calls */


/*
  This is the contract where all poa storage is set.
  It uses chained delegatecalls to use functions from
  PoaToken and PoaCrowdsale and set the resulting storage
  here on PoaProxy.
*/
contract PoaProxy is PoaProxyCommon {
  uint8 public constant version = 1;

  event ProxyUpgradedEvent(address upgradedFrom, address upgradedTo);

  // set addresses to chain
  constructor(
    address _poaTokenMaster,
    address _poaCrowdsaleMaster,
    address _registry
  )
    public
  {
    // ensure that none of the addresses given are empty/address(0)
    require(_poaTokenMaster != address(0));
    require(_poaCrowdsaleMaster != address(0));
    require(_registry != address(0));

    // set addresses in common storage using commonly agreed upon slots
    setPoaTokenMaster(_poaTokenMaster);
    setPoaCrowdsaleMaster(_poaCrowdsaleMaster);
    setRegistry(_registry);
  }

  //
  // start proxy state helpers
  //

  // ensures that address has code/is contract
  function isContract(address _address)
    private
    view
    returns (bool)
  {
    uint256 _size;
    assembly { _size := extcodesize(_address) }
    return _size > 0;
  }

  //
  // end proxy state helpers
  //

  //
  // start proxy state setters
  //

  // change poaTokenMaster to new contract in order to upgrade
  function proxyChangeTokenMaster(address _newMaster)
    public
    returns (bool)
  {
    require(msg.sender == getContractAddress("PoaManager"));
    require(_newMaster != address(0));
    require(poaTokenMaster() != _newMaster);
    require(isContract(_newMaster));
    address _oldMaster = poaTokenMaster();
    setPoaTokenMaster(_newMaster);

    emit ProxyUpgradedEvent(_oldMaster, _newMaster);
    getContractAddress("Logger").call(
      bytes4(keccak256("logProxyUpgradedEvent(address,address)")),
      _oldMaster, _newMaster
    );

    return true;
  }

  // change poaCrowdsaleMaster to new contract in order to upgrade
  function proxyChangeCrowdsaleMaster(address _newMaster)
    public
    returns (bool)
  {
    require(msg.sender == getContractAddress("PoaManager"));
    require(_newMaster != address(0));
    require(poaCrowdsaleMaster() != _newMaster);
    require(isContract(_newMaster));
    address _oldMaster = poaCrowdsaleMaster();
    setPoaCrowdsaleMaster(_newMaster);

    emit ProxyUpgradedEvent(_oldMaster, _newMaster);
    getContractAddress("Logger").call(
      bytes4(keccak256("logProxyUpgradedEvent(address,address)")),
      _oldMaster, _newMaster
    );

    return true;
  }

  //
  // start proxy state setters
  //

  /*
    fallback for all proxied functions using delegatecall
    will first try functions at poaTokenMaster
    if no matches are found...
    will then try functions at poaCrowdsale using similar fallback
    defined in poaTokenMaster
  */
  function()
    external
    payable
  {
    bytes32 _poaTokenMasterSlot = poaTokenMasterSlot;
    assembly {
      // load address from first storage pointer
      let _poaTokenMaster := sload(_poaTokenMasterSlot)

      // calldatacopy(t, f, s)
      calldatacopy(
        0x0, // t = mem position to
        0x0, // f = mem position from
        calldatasize // s = size bytes
      )

      // delegatecall(g, a, in, insize, out, outsize) => 0 on error 1 on success
      let success := delegatecall(
        gas, // g = gas
        _poaTokenMaster, // a = address
        0x0, // in = mem in  mem[in..(in+insize)
        calldatasize, // insize = mem insize  mem[in..(in+insize)
        0x0, // out = mem out  mem[out..(out+outsize)
        0 // outsize = mem outsize  mem[out..(out+outsize)
      )

      // returndatacopy(t, f, s)
      returndatacopy(
        0x0, // t = mem position to
        0x0,  // f = mem position from
        returndatasize // s = size bytes
      )

      // check if call was a success and return if no errors & revert if errors
      if iszero(success) {
        revert(0, 0)
      }
        return(
          0x0,
          returndatasize
        )
    }
  }
}
