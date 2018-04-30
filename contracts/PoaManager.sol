pragma solidity ^0.4.18;

import "./PoaToken.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";


contract PoaManager is Ownable {
  using SafeMath for uint256;

  address private registryAddress;

  enum EntityType {
    Broker,
    Token
  }

  // Both brokers and tokens are tracked by the same values, so this struct is called EntityState
  struct EntityState {
    uint256 index;
    bool active;
    EntityType entityType;
  }

  // A mapping of all tracked entities
  //
  // NOTE: this means we expect that a Broker and Token can never have the same address
  mapping (address => EntityState) private entityMap;

  // Keeping a list for each entity address we track for easy access
  address[] private brokerAddressList;
  address[] private tokenAddressList;

  event BrokerAdded(address indexed broker);
  event BrokerRemoved(address indexed broker);
  event BrokerStatusChanged(address indexed broker, bool active);

  event TokenAdded(address indexed token);
  event TokenRemoved(address indexed token);
  event TokenStatusChanged(address indexed token, bool active);

  modifier isNewEntity(address _entityAddress) {
    require(_entityAddress != address(0));
    require(entityMap[_entityAddress].index == 0);
    _;
  }

  modifier doesEntityExist(address _entityAddress) {
    require(_entityAddress != address(0));
    require(entityMap[_entityAddress].index != 0);
    _;
  }

  modifier onlyActiveBroker(address _brokerAddress) {
    EntityState memory entity = entityMap[_brokerAddress];
    require(entity.active);
    require(entity.entityType == EntityType.Broker);
    _;
  }

  modifier onlyActiveToken(address _tokenAddress) {
    EntityState memory entity = entityMap[_tokenAddress];
    require(entity.active);
    require(entity.entityType == EntityType.Token);
    _;
  }

  function PoaManager(address _registryAddress)
    public
  {
    require(_registryAddress != address(0));
    registryAddress = _registryAddress;
  }

  //
  // Entity functions
  //

  function getStatus(address _entityAddress)
    public
    view
    doesEntityExist(_entityAddress)
    returns (bool)
  {
    return entityMap[_entityAddress].active;
  }

  function addEntity(
    address _entityAddress,
    address[] storage entityList,
    bool _active,
    EntityType _entityType
  )
    private
    isNewEntity(_entityAddress)
  {
    entityList.push(_entityAddress);
    // we do not offset by `-1` so that we never have `entity.index = 0` as this is what is
    // used to check for existence in modifiers [isNewEntity, doesEntityExist]
    uint256 index = entityList.length;
    EntityState memory entity = EntityState(index, _active, _entityType);
    entityMap[_entityAddress] = entity;
  }

  function removeEntity(
    address _entityAddress,
    address[] storage _entityList
  )
    private
    doesEntityExist(_entityAddress)
  {
    // we offset by -1 here to account for how `addEntity` marks the `entity.index` value
    uint256 index = entityMap[_entityAddress].index.sub(1);

    // swap the entity to be removed with the last element in the list
    _entityList[index] = _entityList[_entityList.length - 1];

    // update the index in swapped element
    EntityState storage entityToSwap = entityMap[_entityList[index]];
    entityToSwap.index = index.add(1);

    // we do not need to delete the element, the compiler should clean up for us
    _entityList.length--;

    delete entityMap[_entityAddress];
  }

  function setEntityActiveValue(
    address _entityAddress,
    bool _active
  )
    private
    doesEntityExist(_entityAddress)
  {
    EntityState storage entity = entityMap[_entityAddress];
    require(entity.active != _active);
    entity.active = _active;
  }

  //
  // Broker functions
  //

  // Return all tracked broker addresses
  function getBrokerAddressList()
    public
    view
    returns (address[])
  {
    return brokerAddressList;
  }

  // Add a broker and set active value to true
  function addBroker(address _brokerAddress)
    public
    onlyOwner
  {
    addEntity(
      _brokerAddress,
      brokerAddressList,
      true,
      EntityType.Broker
    );

    BrokerAdded(_brokerAddress);
  }

  // Remove a broker
  function removeBroker(address _brokerAddress)
    public
    onlyOwner
  {
    removeEntity(_brokerAddress, brokerAddressList);
    BrokerRemoved(_brokerAddress);
  }

  // Set previously delisted broker to listed
  function listBroker(address _brokerAddress)
    public
    onlyOwner
  {
    setEntityActiveValue(_brokerAddress, true);
    BrokerStatusChanged(_brokerAddress, true);
  }

  // Set previously listed broker to delisted
  function delistBroker(address _brokerAddress)
    public
    onlyOwner
  {
    setEntityActiveValue(_brokerAddress, false);
    BrokerStatusChanged(_brokerAddress, false);
  }

  //
  // Token functions
  //

  // Return all tracked token addresses
  function getTokenAddressList()
    public
    view
    returns (address[])
  {
    return tokenAddressList;
  }

  // Create a PoaToken contract with given parameters, and set active value to true
  function addToken
  (
    string _name,
    string _symbol,
    address _custodian,
    uint256 _timeout,
    uint256 _supply
  )
    public
    onlyActiveBroker(msg.sender)
    returns (address)
  {
    address _tokenAddress = new PoaToken(
      _name,
      _symbol,
      msg.sender,
      _custodian,
      registryAddress,
      _timeout,
      _supply
    );

    addEntity(
      _tokenAddress,
      tokenAddressList,
      false,
      EntityType.Token
    );

    TokenAdded(_tokenAddress);

    return _tokenAddress;
  }

  // Remove a token
  function removeToken(address _tokenAddress)
    public
    onlyOwner
  {
    removeEntity(_tokenAddress, tokenAddressList);
    TokenRemoved(_tokenAddress);
  }

  // Set previously delisted token to listed
  function listToken(address _tokenAddress)
    public
    onlyOwner
  {
    setEntityActiveValue(_tokenAddress, true);
    TokenStatusChanged(_tokenAddress, true);
  }

  // Set previously listed token to delisted
  function delistToken(address _tokenAddress)
    public
    onlyOwner
  {
    setEntityActiveValue(_tokenAddress, false);
    TokenStatusChanged(_tokenAddress, false);
  }

  //
  // Token ownerOnly functions as PoaManger is `owner` of all PoaToken
  //

  // Allow unpausing a listed PoaToken
  function pauseToken(PoaToken _tokenAddress)
    public
    onlyOwner
    onlyActiveToken(_tokenAddress)
  {
    _tokenAddress.pause();
  }

  // Allow unpausing a listed PoaToken
  function unpauseToken(PoaToken _tokenAddress)
    public
    onlyOwner
    onlyActiveToken(_tokenAddress)
  {
    _tokenAddress.unpause();
  }

  // Allow terminating a listed PoaToken
  function terminateToken(PoaToken _tokenAddress)
    public
    onlyOwner
    onlyActiveToken(_tokenAddress)
  {
    _tokenAddress.terminate();
  }

  //
  // Fallback
  //

  function()
    public
  {
    revert();
  }

}
