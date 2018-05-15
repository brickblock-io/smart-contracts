pragma solidity ^0.4.18;

import "truffle/Assert.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../../contracts/CustomPOAToken.sol";


contract TestCustomPoaToken {
  using SafeMath for uint256;

  uint256 fundingGoal = 10e18;
  uint256 totalSupply = 33e18;
  CustomPOAToken private cpoa = new CustomPOAToken(
      'ProofOfAwesome',
      'POA',
      address(1),
      address(2),
      50,
      totalSupply,
      fundingGoal
    );

  uint256 private remainder;

  function testSafeMath() 
    private
  {
    uint256 _wei = 3;
    uint256 _expectedRemainder = (_wei * totalSupply) % fundingGoal;
    uint256 _safeExpectedRemainder = _wei.mul(totalSupply) % fundingGoal;

    Assert.equal(
      _expectedRemainder,
      _safeExpectedRemainder,
      "SafeMath and regular math should return same values here"
    );
  }

  function testWeiToTokens() 
    private
  {
    uint256 _wei = 3;
    uint256 _expectedTokens = 9;
    uint256 _tokens;

    _tokens = cpoa.weiToTokens(_wei);

    Assert.equal(
      _tokens,
      _expectedTokens,
      "tokens from wei should match expected amount"
    );
  }

  function testTokensToWei() {
    uint256 _tokens = 9;
    uint256 _expectedWei = 2;

    uint256 _wei = cpoa.tokensToWei(_tokens);

    Assert.equal(
      _wei,
      _expectedWei,
      "wei from tokens should match expected amount"
    );
  }
}
