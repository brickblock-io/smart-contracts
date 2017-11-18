pragma solidity ^0.4.18;

import "./POAToken.sol";


contract Brickblock {
// The parent contract managing the list of active brokers and POAToken contracts.

    // Event emitted when a broker has been added
    event BrokerAdded(address brokerAddress, uint brokerIndex);

    // Event emitted when a broker has been removed
    event BrokerRemoved(address brokerAddress, uint brokerIndex);

    // Event emitted when a token has been added.
    event TokenAdded(address token);

    // The owner of this contract
    address public owner;

    // The list of brokers
    address[] brokers;

    // The list of tokens
    address[] tokens;

    // Instantiate the Brickblock contract.
    function Brickblock() {
        owner = msg.sender;
    }

    // Ensure only contract owner can call this function.
    modifier onlyOwner {
        require(msg.sender == owner);
        _;
    }

    // List all active broker addresses
    function listBrokers() public constant returns(address[]) {
        return brokers;
    }

    // Add broker +_broker+ to the list
    function addBroker(address _broker) public constant onlyOwner {
        brokers.push(_broker);
        BrokerAdded(_broker, brokers.length - 1);
    }

    // Remove broker with given index +_i+ from the list.
    function removeBroker(uint _i) public constant onlyOwner {
        // TODO(mattgstevens): this makes the contract efficient but how will the UI keep in sync
        //  with changing index? Currently we must call listBrokers() after every removeBroker
        address broker = brokers[_i];
        brokers[_i] = brokers[brokers.length - 1];
        delete brokers[brokers.length - 1];
        brokers.length--;
        BrokerRemoved(broker, _i);
    }

    // Create a new POAToken contract with given parameters and add it to the list.
    function addToken(
        string _name,
        string _symbol,
        address _custodian,
        uint _timeout,
        uint256 _supply
    ) onlyOwner
      public constant
    {
        address token = new POAToken(_name, _symbol, msg.sender, _custodian, _timeout, _supply);
        tokens.push(token);
        TokenAdded(token);
    }
}
