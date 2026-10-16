// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ProviderRegistry is Ownable {
    struct ProviderInfo {
        address addr;
        string name;
        string description;
        uint256 pricePerCall;
        bool active;
        uint256 totalEarned;
    }

    error AlreadyRegistered();
    error NotRegistered();
    error ZeroPrice();
    error OnlyAgentTab();
    error AlreadySet();

    event ProviderRegistered(address indexed provider, string name, uint256 pricePerCall);
    event ProviderPriceUpdated(address indexed provider, uint256 newPrice);
    event ProviderDeactivated(address indexed provider);
    event ProviderActivated(address indexed provider);
    event AgentTabContractSet(address addr);
    event PaymentRecorded(address indexed provider, uint256 amount);

    mapping(address => ProviderInfo) public providers;
    address[] public providerList;
    mapping(address => bool) private _registered;

    address public agentTabContract;

    constructor(address initialOwner_, address agentTabContract_) Ownable(initialOwner_) {
        agentTabContract = agentTabContract_;
    }

    function register(string calldata name, string calldata description, uint256 pricePerCall) external {
        if (_registered[msg.sender]) revert AlreadyRegistered();
        if (pricePerCall == 0) revert ZeroPrice();

        providers[msg.sender] = ProviderInfo({
            addr: msg.sender,
            name: name,
            description: description,
            pricePerCall: pricePerCall,
            active: true,
            totalEarned: 0
        });

        _registered[msg.sender] = true;
        providerList.push(msg.sender);

        emit ProviderRegistered(msg.sender, name, pricePerCall);
    }

    function updatePrice(uint256 newPrice) external {
        if (!_registered[msg.sender]) revert NotRegistered();
        if (newPrice == 0) revert ZeroPrice();

        providers[msg.sender].pricePerCall = newPrice;

        emit ProviderPriceUpdated(msg.sender, newPrice);
    }

    function deactivate() external {
        if (!_registered[msg.sender]) revert NotRegistered();

        providers[msg.sender].active = false;

        emit ProviderDeactivated(msg.sender);
    }

    function activate() external {
        if (!_registered[msg.sender]) revert NotRegistered();

        providers[msg.sender].active = true;

        emit ProviderActivated(msg.sender);
    }

    function recordPayment(address provider, uint256 amount) external {
        if (msg.sender != agentTabContract) revert OnlyAgentTab();

        providers[provider].totalEarned += amount;

        emit PaymentRecorded(provider, amount);
    }

    function setAgentTabContract(address addr) external onlyOwner {
        if (agentTabContract != address(0)) revert AlreadySet();

        agentTabContract = addr;

        emit AgentTabContractSet(addr);
    }

    function getProviders() external view returns (address[] memory) {
        return providerList;
    }

    function isActive(address provider) external view returns (bool) {
        return providers[provider].active;
    }

    function getPrice(address provider) external view returns (uint256) {
        return providers[provider].pricePerCall;
    }
}
