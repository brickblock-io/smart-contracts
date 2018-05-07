pragma solidity ^0.4.18;

import "./PoaToken.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";


contract PoaManager is Ownable {
  using SafeMath for uint256;

  uint256 constant version = 1;

  address private registryAddress;

  struct EntityState {
    uint256 index;
    bool active;
  }

  // Keeping a list for addresses we track for easy access
  address[] private brokerAddressList;
  address[] private tokenAddressList;

  // A mapping for each address we track
  mapping (address => EntityState) private tokenMap;
  mapping (address => EntityState) private brokerMap;

  event BrokerAddedEvent(address indexed broker);
  event BrokerRemovedEvent(address indexed broker);
  event BrokerStatusChangedEvent(address indexed broker, bool active);

  event TokenAddedEvent(address indexed token);
  event TokenRemovedEvent(address indexed token);
  event TokenStatusChangedEvent(address indexed token, bool active);

  modifier doesEntityExist(address _entityAddress, EntityState entity) {
    require(_entityAddress != address(0));
    require(entity.index != 0);
    _;
  }

  modifier isNewBroker(address _brokerAddress) {
    require(_brokerAddress != address(0));
    require(brokerMap[_brokerAddress].index == 0);
    _;
  }

  modifier onlyActiveBroker(address _brokerAddress) {
    EntityState memory entity = brokerMap[_brokerAddress];
    require(entity.active);
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

  function addEntity(
    address _entityAddress,
    address[] storage entityList,
    bool _active
  )
    private
    returns (EntityState)
  {
    entityList.push(_entityAddress);
    // we do not offset by `-1` so that we never have `entity.index = 0` as this is what is
    // used to check for existence in modifier [doesEntityExist]
    uint256 index = entityList.length;
    EntityState memory entity = EntityState(index, _active);
    return entity;
  }

  function removeEntity(
    EntityState _entityToRemove,
    address[] storage _entityList
  )
    private
    returns (address, uint256)
  {
    // we offset by -1 here to account for how `addEntity` marks the `entity.index` value
    uint256 index = _entityToRemove.index.sub(1);

    // swap the entity to be removed with the last element in the list
    _entityList[index] = _entityList[_entityList.length - 1];

    // because we wanted seperate mappings for token and broker, and we cannot pass a storage mapping
    // as a function argument, this abstraction is leaky; we return the address and index so the
    // caller can update the mapping
    address entityToSwapAddress = _entityList[index];

    // we do not need to delete the element, the compiler should clean up for us
    _entityList.length--;

    return (entityToSwapAddress, _entityToRemove.index);
  }

  function setEntityActiveValue(
    EntityState storage entity,
    bool _active
  )
    private
  {
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
    isNewBroker(_brokerAddress)
  {
    brokerMap[_brokerAddress] = addEntity(
      _brokerAddress,
      brokerAddressList,
      true
    );

    BrokerAddedEvent(_brokerAddress);
  }

  // Remove a broker
  function removeBroker(address _brokerAddress)
    public
    onlyOwner
    doesEntityExist(_brokerAddress, brokerMap[_brokerAddress])
  {
    var (addressToUpdate, indexUpdate) = removeEntity(brokerMap[_brokerAddress], brokerAddressList);
    brokerMap[addressToUpdate].index = indexUpdate;
    delete brokerMap[_brokerAddress];

    BrokerRemovedEvent(_brokerAddress);
  }

  // Set previously delisted broker to listed
  function listBroker(address _brokerAddress)
    public
    onlyOwner
    doesEntityExist(_brokerAddress, brokerMap[_brokerAddress])
  {
    setEntityActiveValue(brokerMap[_brokerAddress], true);
    BrokerStatusChangedEvent(_brokerAddress, true);
  }

  // Set previously listed broker to delisted
  function delistBroker(address _brokerAddress)
    public
    onlyOwner
    doesEntityExist(_brokerAddress, brokerMap[_brokerAddress])
  {
    setEntityActiveValue(brokerMap[_brokerAddress], false);
    BrokerStatusChangedEvent(_brokerAddress, false);
  }

  function getBrokerStatus(address _brokerAddress)
    public
    view
    doesEntityExist(_brokerAddress, brokerMap[_brokerAddress])
    returns (bool)
  {
    return brokerMap[_brokerAddress].active;
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

    tokenMap[_tokenAddress] = addEntity(
      _tokenAddress,
      tokenAddressList,
      false
    );

    TokenAddedEvent(_tokenAddress);

    return _tokenAddress;
  }

  // Remove a token
  function removeToken(address _tokenAddress)
    public
    onlyOwner
    doesEntityExist(_tokenAddress, tokenMap[_tokenAddress])
  {
    var (addressToUpdate, indexUpdate) = removeEntity(tokenMap[_tokenAddress], tokenAddressList);
    tokenMap[addressToUpdate].index = indexUpdate;
    delete tokenMap[_tokenAddress];

    TokenRemovedEvent(_tokenAddress);
  }

  // Set previously delisted token to listed
  function listToken(address _tokenAddress)
    public
    onlyOwner
    doesEntityExist(_tokenAddress, tokenMap[_tokenAddress])
  {
    setEntityActiveValue(tokenMap[_tokenAddress], true);
    TokenStatusChangedEvent(_tokenAddress, true);
  }

  // Set previously listed token to delisted
  function delistToken(address _tokenAddress)
    public
    onlyOwner
    doesEntityExist(_tokenAddress, tokenMap[_tokenAddress])
  {
    setEntityActiveValue(tokenMap[_tokenAddress], false);
    TokenStatusChangedEvent(_tokenAddress, false);
  }

  function getTokenStatus(address _tokenAddress)
    public
    view
    doesEntityExist(_tokenAddress, tokenMap[_tokenAddress])
    returns (bool)
  {
    return tokenMap[_tokenAddress].active;
  }

  //
  // Token ownerOnly functions as PoaManger is `owner` of all PoaToken
  //

  // Allow unpausing a listed PoaToken
  function pauseToken(PoaToken _tokenAddress)
    public
    onlyOwner
  {
    _tokenAddress.pause();
  }

  // Allow unpausing a listed PoaToken
  function unpauseToken(PoaToken _tokenAddress)
    public
    onlyOwner
  {
    _tokenAddress.unpause();
  }

  // Allow terminating a listed PoaToken
  function terminateToken(PoaToken _tokenAddress)
    public
    onlyOwner
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
