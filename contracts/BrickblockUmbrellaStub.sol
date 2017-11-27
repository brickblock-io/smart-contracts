pragma solidity ^0.4.18;

import "./BrickblockAccessToken.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";


contract BrickblockUmbrellaStub is Ownable {
  using SafeMath for uint;

  struct Broker {
    address _address;
    bool _active;
  }

  struct Token {
    address _address;
    bool _active;
  }

  Broker[] public brokers;
  Token[] public tokens;

  mapping (address => uint256) public brokerIndexMap;
  mapping (address => uint256) public tokenIndexMap;

  BrickblockAccessToken public brickblockAccessToken;

  function BrickblockUmbrellaStub() {
    // ensure that 1st element of tokens is not active
    tokens.push(Token(address(0), false));
    brokers.push(Broker(address(0), false));
  }

  function addFakeToken(address _tokenAddress)
    public
  {
    Token memory token = Token(_tokenAddress, true);
    tokens.push(token);
    tokenIndexMap[_tokenAddress] = tokens.length.sub(1);
  }

  function tokenStatus(address _tokenAddress)
    public
    view
    returns (bool)
  {
    return tokens[tokenIndexMap[_tokenAddress]]._active;
  }

  function addBroker(address _brokerAddress)
    public
  {
    Broker memory broker = Broker(_brokerAddress, true);
    brokers.push(broker);
    brokerIndexMap[_brokerAddress] = brokers.length.sub(1);
  }

  function brokerStatus(address _brokerAddress)
    public
    view
    returns (bool)
  {
    return brokers[brokerIndexMap[_brokerAddress]]._active;
  }

  function deactivateBroker(address _brokerAddress)
    public
  {
    uint256 _brokerIndex = brokerIndexMap[_brokerAddress];
    brokers[_brokerIndex]._active = false;
  }

  function deactivateToken(address _tokenAddress)
  {
    uint256 _tokenIndex = tokenIndexMap[_tokenAddress];
    tokens[_tokenIndex]._active = false;
  }

  function changeAccessTokenAddress(address _newAddress)
    public
  {
    brickblockAccessToken = BrickblockAccessToken(_newAddress);
  }

  function simulateBurnFrom(uint256 _value, address _from)
    public
  {
    brickblockAccessToken.burnFrom(_value, _from);
  }
}
