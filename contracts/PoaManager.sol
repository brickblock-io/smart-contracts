pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./interfaces/IRegistry.sol";
import "./interfaces/IPoaToken.sol";
import "./interfaces/IPoaCrowdsale.sol";
import "./PoaProxy.sol";


contract PoaManager is Ownable {
  using SafeMath for uint256;

  uint256 constant version = 1;

  IRegistry public registry;

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

  event BrokerAdded(address indexed broker);
  event BrokerRemoved(address indexed broker);
  event BrokerStatusChanged(address indexed broker, bool active);

  event TokenAdded(address indexed token);
  event TokenRemoved(address indexed token);
  event TokenStatusChanged(address indexed token, bool active);

  modifier isNewBroker(address _brokerAddress) {
    require(_brokerAddress != address(0));
    require(brokerMap[_brokerAddress].index == 0);
    _;
  }

  modifier onlyActiveBroker() {
    EntityState memory entity = brokerMap[msg.sender];
    require(entity.active);
    _;
  }

  constructor(
    address _registryAddress
  )
    public
  {
    require(_registryAddress != address(0));
    registry = IRegistry(_registryAddress);
  }

  //
  // Entity functions
  //

  function doesEntityExist(address _entityAddress, EntityState entity)
    private
    pure
    returns (bool)
  {
    return (_entityAddress != address(0) && entity.index != 0);
  }

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

    emit BrokerAdded(_brokerAddress);
  }

  // Remove a broker
  function removeBroker(address _brokerAddress)
    public
    onlyOwner
  {
    require(doesEntityExist(_brokerAddress, brokerMap[_brokerAddress]));

    address addressToUpdate;
    uint256 indexUpdate;
    (addressToUpdate, indexUpdate) = removeEntity(brokerMap[_brokerAddress], brokerAddressList);
    brokerMap[addressToUpdate].index = indexUpdate;
    delete brokerMap[_brokerAddress];

    emit BrokerRemoved(_brokerAddress);
  }

  // Set previously delisted broker to listed
  function listBroker(address _brokerAddress)
    public
    onlyOwner
  {
    require(doesEntityExist(_brokerAddress, brokerMap[_brokerAddress]));

    setEntityActiveValue(brokerMap[_brokerAddress], true);
    emit BrokerStatusChanged(_brokerAddress, true);
  }

  // Set previously listed broker to delisted
  function delistBroker(address _brokerAddress)
    public
    onlyOwner
  {
    require(doesEntityExist(_brokerAddress, brokerMap[_brokerAddress]));

    setEntityActiveValue(brokerMap[_brokerAddress], false);
    emit BrokerStatusChanged(_brokerAddress, false);
  }

  function getBrokerStatus(address _brokerAddress)
    public
    view
    returns (bool)
  {
    require(doesEntityExist(_brokerAddress, brokerMap[_brokerAddress]));

    return brokerMap[_brokerAddress].active;
  }

  function isRegisteredBroker(address _brokerAddress)
    external
    view
    returns (bool)
  {
    return doesEntityExist(_brokerAddress, brokerMap[_brokerAddress]);
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

  function createPoaTokenProxy()
    private
    returns (address _proxyContract)
  {
    address _poaTokenMaster = registry.getContractAddress("PoaTokenMaster");
    address _poaCrowdsaleMaster = registry.getContractAddress("PoaCrowdsaleMaster");
    _proxyContract = new PoaProxy(_poaTokenMaster, _poaCrowdsaleMaster, address(registry));
  }

  /**
    @notice Creates a PoaToken contract with given parameters, and set active value to false
    @param _fiatCurrency32 Fiat symbol used in ExchangeRates
    @param _startTimeForFundingPeriod Given as unix time in seconds since 01.01.1970
    @param _durationForFiatFundingPeriod How long fiat funding can last, given in seconds
    @param _durationForEthFundingPeriod How long eth funding can last, given in seconds
    @param _durationForActivationPeriod How long a custodian has to activate token, given in seconds
    @param _fundingGoalInCents Given as fiat cents
   */
  function addToken
  (
    bytes32 _name32,
    bytes32 _symbol32,
    bytes32 _fiatCurrency32,
    address _custodian,
    uint256 _totalSupply,
    uint256 _startTimeForFundingPeriod,
    uint256 _durationForFiatFundingPeriod,
    uint256 _durationForEthFundingPeriod,
    uint256 _durationForActivationPeriod,
    uint256 _fundingGoalInCents
  )
    public
    onlyActiveBroker
    returns (address)
  {
    address _tokenAddress = createPoaTokenProxy();

    IPoaToken(_tokenAddress).initializeToken(
      _name32,
      _symbol32,
      msg.sender,
      _custodian,
      registry,
      _totalSupply
    );

    IPoaCrowdsale(_tokenAddress).initializeCrowdsale(
      _fiatCurrency32,
      _startTimeForFundingPeriod,
      _durationForFiatFundingPeriod,
      _durationForEthFundingPeriod,
      _durationForActivationPeriod,
      _fundingGoalInCents
    );

    tokenMap[_tokenAddress] = addEntity(
      _tokenAddress,
      tokenAddressList,
      false
    );

    emit TokenAdded(_tokenAddress);

    return _tokenAddress;
  }

  // Remove a token
  function removeToken(address _tokenAddress)
    public
    onlyOwner
  {
    require(doesEntityExist(_tokenAddress, tokenMap[_tokenAddress]));

    address addressToUpdate;
    uint256 indexUpdate;
    (addressToUpdate, indexUpdate) = removeEntity(tokenMap[_tokenAddress], tokenAddressList);
    tokenMap[addressToUpdate].index = indexUpdate;
    delete tokenMap[_tokenAddress];

    emit TokenRemoved(_tokenAddress);
  }

  // Set previously delisted token to listed
  function listToken(address _tokenAddress)
    public
    onlyOwner
  {
    require(doesEntityExist(_tokenAddress, tokenMap[_tokenAddress]));

    setEntityActiveValue(tokenMap[_tokenAddress], true);
    emit TokenStatusChanged(_tokenAddress, true);
  }

  // Set previously listed token to delisted
  function delistToken(address _tokenAddress)
    public
    onlyOwner
  {
    require(doesEntityExist(_tokenAddress, tokenMap[_tokenAddress]));

    setEntityActiveValue(tokenMap[_tokenAddress], false);
    emit TokenStatusChanged(_tokenAddress, false);
  }

  function getTokenStatus(address _tokenAddress)
    public
    view
    returns (bool)
  {
    require(doesEntityExist(_tokenAddress, tokenMap[_tokenAddress]));

    return tokenMap[_tokenAddress].active;
  }

  //
  // Token onlyOwner functions as PoaManger is `owner` of all PoaToken
  //

  // Allow unpausing a listed PoaToken
  function pauseToken(address _tokenAddress)
    public
    onlyOwner
  {
    IPoaToken(_tokenAddress).pause();
  }

  // Allow unpausing a listed PoaToken
  function unpauseToken(IPoaToken _tokenAddress)
    public
    onlyOwner
  {
    _tokenAddress.unpause();
  }

  // Allow terminating a listed PoaToken
  function terminateToken(IPoaToken _tokenAddress)
    public
    onlyOwner
  {
    _tokenAddress.terminate();
  }

  // upgrade an existing PoaToken proxy to what is stored in ContractRegistry
  function upgradeToken(
    PoaProxy _proxyToken
  )
    external
    onlyOwner
    returns (bool)
  {
    _proxyToken.proxyChangeTokenMaster(
      registry.getContractAddress("PoaTokenMaster")
    );
  }

  // upgrade an existing PoaCrowdsale proxy to what is stored in ContractRegistry
  function upgradeCrowdsale(
    PoaProxy _proxyToken
  )
    external
    onlyOwner
    returns (bool)
  {
    _proxyToken.proxyChangeCrowdsaleMaster(
      registry.getContractAddress("PoaCrowdsaleMaster")
    );
  }
}
