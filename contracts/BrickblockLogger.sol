pragma solidity ^0.4.23;

import "./interfaces/BrickblockContractRegistryInterface.sol";
import "./interfaces/PoaManagerInterface.sol";
import "./interfaces/PoaTokenInterface.sol";


contract BrickblockLogger {
  // registry instance to get other contract addresses
  RegistryInterface public registry;

  constructor(
    address _registryAddress
  )
    public
  {
    require(_registryAddress != address(0));
    registry = RegistryInterface(_registryAddress);
  }
  
  // only allow listed poa tokens to trigger events
  modifier onlyActivePoaToken() {
    require(
      PoaManagerInterface(
        registry.getContractAddress("PoaManager")
      ).getTokenStatus(msg.sender)
    );
    _;
  }

  // possible events from a PoaToken
  event StageEvent(
    address indexed tokenAddress, 
    uint256 stage
  );
  event BuyEvent(
    address indexed tokenAddress, 
    address indexed buyer, 
    uint256 amount
  );
  event ProofOfCustodyUpdatedEvent(
    address indexed tokenAddress, 
    string ipfsHash
  );
  event PayoutEvent(
    address indexed tokenAddress, 
    uint256 amount
  );
  event ClaimEvent(
    address indexed tokenAddress, 
    address indexed claimer, 
    uint256 payout
  );
  event TerminatedEvent(
    address indexed tokenAddress
  );
  event CustodianChangedEvent(
    address indexed tokenAddress,
    address oldAddress,
    address newAddress
  );
  event ReclaimEvent(
    address indexed tokenAddress, 
    address indexed reclaimer, 
    uint256 amount
  );

  // event triggers for each event
  function logStageEvent(
    uint256 stage
  )
    external
    onlyActivePoaToken
  {
    emit StageEvent(msg.sender, stage);
  }

  function logBuyEvent(
    address buyer, 
    uint256 amount
  )
    external
    onlyActivePoaToken
  {
    emit BuyEvent(msg.sender, buyer, amount);
  }

  function logProofOfCustodyUpdatedEvent()
    external
    onlyActivePoaToken
  {
    // easier to get the set ipfsHash from contract rather than send over string
    string memory _realIpfsHash = PoaTokenInterface(msg.sender).proofOfCustody();

    emit ProofOfCustodyUpdatedEvent(
      msg.sender,
      _realIpfsHash
    );
  }

  function logPayoutEvent(
    uint256 _amount
  )
    external
    onlyActivePoaToken
  {
    emit PayoutEvent(
      msg.sender,
      _amount
    );
  }

  function logClaimEvent(
    address _claimer,
    uint256 _payout
    )
    external
    onlyActivePoaToken
  {
    emit ClaimEvent(
      msg.sender,
      _claimer,
      _payout
    );
  }

  function logTerminatedEvent()
    external
    onlyActivePoaToken
  {
    emit TerminatedEvent(msg.sender);
  }

  function logCustodianChangedEvent(
    address _oldAddress, 
    address _newAddress
  )
    external
    onlyActivePoaToken
  {
    emit CustodianChangedEvent(
      msg.sender,
      _oldAddress,
      _newAddress
    );
  }

  function logReclaimEvent(
    address _reclaimer,
    uint256 _amount
  )
    external
    onlyActivePoaToken
  {
    emit ReclaimEvent(
      msg.sender,
      _reclaimer,
      _amount
    );
  }

  // keep money from entering this contract, unless selfdestruct of course :)
  function()
    public
    payable
  {
    revert();
  }
}
