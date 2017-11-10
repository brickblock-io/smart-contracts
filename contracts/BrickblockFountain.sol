pragma solidity ^0.4.4;

import 'zeppelin-solidity/contracts/token/TokenTimelock.sol';

contract BrickBlockFountain is TokenTimelock {
  string public test;
  function BrickBlockFountain(string _test) {
    test = _test;
  }
}
