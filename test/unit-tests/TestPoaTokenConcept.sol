import "truffle/Assert.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "../../contracts/PoaTokenConcept.sol";
import "truffle/DeployedAddresses.sol";

contract TestPoaTokenConcept {

  function testWeiToTokens() {
    PoaTokenConcept poac = PoaTokenConcept(DeployedAddresses.PoaTokenConcept());
    uint256 _wei = 1e18;
    uint256 _actualTokens = poac.weiToTokens(_wei);
    // wei       fiatCents  fromWei to Wei+perc.    fundingGoalInCents
    // (1e18 *   50000 /    1e18) * 1e20          / 5e5
    uint256 _expectedTokens = 10000000000000000000;

    Assert.equal(
      _expectedTokens,
      _actualTokens,
      "weiToTokens should return correct value"
    );
  }

}
