pragma solidity ^0.4.4;

import 'zeppelin-solidity/contracts/token/BurnableToken.sol';
//probably dont need this with this new layout? burning can be done on own
import 'zeppelin-solidity/contracts/token/PausableToken.sol';

contract BrickBlockToken is PausableToken, BurnableToken {
  // Event emitted when tokens have been claimed from ICO
  event TokensClaimed(uint256 amount, address to);

  string public constant name = "BrickBlockToken";
  string public constant symbol = "BBT";
  uint8 public constant decimals = 18;
  uint256 public constant initalSupply = 50 * (10 ** 6) * (10 ** uint256(decimals));
  uint256 public constant founderShare = 51;
  uint256 public constant investorShare = 49;
  bool public tokenSaleActive;
  
  function BrickBlockToken() {
    totalSupply = initalSupply;
    // TODO: need a way to deal with the fact that the owner will be changed repeatedly... need to hold the balance elsewhere
    balances[this] = initalSupply;
    // might not need this if we just use pause... though naming convention isn't great
    tokenSaleActive = true;
    // need to start paused to make sure that there can be no transfers
    // this ensures that 1. tokenClaims will only work once 2. keep in line with management's wishes
    paused = true;
  }
  
  function recover(bytes32 hash, bytes sig) private constant returns (address) {
    bytes32 r;
    bytes32 s;
    uint8 v;

    //Check the signature length
    if (sig.length != 65) {
      return (address(0));
    }

    // Divide the signature in r, s and v variables
    assembly {
      r := mload(add(sig, 32))
      s := mload(add(sig, 64))
      v := byte(0, mload(add(sig, 96)))
    }

    // Version of signature should be 27 or 28, but 0 and 1 are also possible versions
    if (v < 27) {
      v += 27;
    }

    // If the version is correct return the signer address
    if (v != 27 && v != 28) {
      return (address(0));
    } else {
      return ecrecover(hash, v, r, s);
    }
  }
  
  // need to put brickblock funds into owner address
  function finalizeTokenSale() public onlyOwner {
    require(tokenSaleActive);
    // owner should own 51% of tokens
    uint256 claimedTokens = initalSupply - balances[this];
    uint256 newTotalSupply = claimedTokens.mul(100).div(investorShare);
    uint256 ownerClaimedTokens = newTotalSupply.mul(100).div(founderShare);
    
    balances[this] = balances[this].sub(ownerClaimedTokens);
    balances[owner] = balances[owner].add(ownerClaimedTokens);
    
    // nuke the remaining balance...
    balances[this] = balances[this].sub(balanceOf(this));
    
    //set new state
    totalSupply = newTotalSupply;
    tokenSaleActive = false;
    
  }

  // TODO: need a way to deal with the fact that the owner will be changed repeatedly... need to hold the balance elsewhere
  // claim tokens based on signed message containing token amount and address
  // will not work if sent from non-matching address
  // will not work if incorrect amount is sent
  function claimTokens(bytes _signature, uint _amount) public {
    require(tokenSaleActive);
    require(msg.sender != owner);
    bytes32 createdHash = keccak256(uint(_amount), msg.sender);
    bytes memory prefix = "\x19Ethereum Signed Message:\n32";
    bytes32 prefixedHash = keccak256(prefix, createdHash);
    address sigaddr = recover(prefixedHash, _signature);
    require(sigaddr == owner);
    require(balances[msg.sender] == 0);
    balances[this] = balances[this].sub(_amount);
    balances[msg.sender] = balances[msg.sender].add(_amount);
    TokensClaimed(_amount, msg.sender);
  }
}
