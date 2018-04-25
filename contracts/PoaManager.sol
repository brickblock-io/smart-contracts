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

  modifier isNewEntity(address _address) {
    require(_address != address(0));
    require(entityMap[_address].index == 0);
    _;
  }

  modifier doesEntityExist(address _address) {
    require(_address != address(0));
    require(entityMap[_address].index != 0);
    _;
  }

  modifier onlyActiveBroker {
    EntityState memory entity = entityMap[msg.sender];
    require(entity.active);
    require(entity.entityType == EntityType.Broker);
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

  function getStatus(address _address)
    public
    view
    doesEntityExist(_address)
    returns (bool)
  {
    return entityMap[_address].active;
  }

  function addEntity(
    address _address,
    address[] storage entityList,
    bool _active,
    EntityType _entityType
  )
    private
    isNewEntity(_address)
  {
    entityList.push(_address);
    // we do not offset by `-1` so that we never have `entity.index = 0` as this is what is
    // used to check for existence in modifiers [isNewEntity, doesEntityExist]
    uint256 index = entityList.length;
    EntityState memory entity = EntityState(index, _active, _entityType);
    entityMap[_address] = entity;
  }

  function removeEntity(
    address _address,
    address[] storage _entityList
  )
    private
    doesEntityExist(_address)
  {
    // we offset by -1 here to account for how `addEntity` marks the `entity.index` value
    uint256 index = entityMap[_address].index.sub(1);

    // swap the entity to be removed with the last element in the list
    _entityList[index] = _entityList[_entityList.length - 1];

    // update the index in swapped element
    EntityState storage entityToSwap = entityMap[_entityList[index]];
    entityToSwap.index = index.add(1);

    // we do not need to delete the element, the compiler should clean up for us
    _entityList.length--;

    delete entityMap[_address];
  }

  function setEntityActiveValue(
    address _address,
    bool _active
  )
    private
    doesEntityExist(_address)
  {
    EntityState storage entity = entityMap[_address];
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
    addEntity(_brokerAddress, brokerAddressList, true, EntityType.Broker);
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

  // Set previously deactivated broker to activated
  function activateBroker(address _brokerAddress)
    public
    onlyOwner
  {
    setEntityActiveValue(_brokerAddress, true);
    BrokerStatusChanged(_brokerAddress, true);
  }

  // Set previously activated broker to deactivated
  function deactivateBroker(address _brokerAddress)
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
    onlyActiveBroker
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
    addEntity(_tokenAddress, tokenAddressList, true, EntityType.Token);
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

  // Set previously deactivated token to activated
  function activateToken(address _tokenAddress)
    public
    onlyOwner
  {
    setEntityActiveValue(_tokenAddress, true);
    TokenStatusChanged(_tokenAddress, true);
  }

  // Set previously activated token to deactivated
  function deactivateToken(address _tokenAddress)
    public
    onlyOwner
  {
    setEntityActiveValue(_tokenAddress, false);
    TokenStatusChanged(_tokenAddress, false);
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
