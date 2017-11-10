pragma solidity ^0.4.4;

import 'zeppelin-solidity/contracts/token/TokenTimelock.sol';

contract BrickblockFountain is TokenTimelock {
  string public test;
  function BrickblockFountain(string _test) {
    test = _test;
  }
}
