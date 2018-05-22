pragma solidity 0.4.23;


contract Proxy {
  address public masterContract;

  constructor(address _master) 
    public
  {
    require(_master != address(0));
    masterContract = _master;
  }

  function()
    external
    payable
  {
    assembly {
      // load address from first storage pointer
      let _master := sload(0x0)

      // calldatacopy(t, f, s)
      calldatacopy(
        0x0, // t = mem position to
        0x0, // f = mem position from
        calldatasize // s = size bytes
      )

      // delegatecall(g, a, in, insize, out, outsize) => 0 on error 1 on success
      let success := delegatecall(
        gas, // g = gas 
        _master, // a = address
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

      if iszero(success) {
        revert(
          0x0, 
          returndatasize
        )
      }
        return(
          0x0, 
          returndatasize
        )
    }
  }
}
