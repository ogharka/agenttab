// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IProviderRegistry {
    function recordPayment(address provider, uint256 amount) external;
    function isActive(address provider) external view returns (bool);
}

contract AgentTab is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct AgentAccount {
        address owner;
        address agent;
        uint256 balance;
        uint256 dailyLimit;
        uint256 spentToday;
        uint256 dayWindowStart;
        uint256 maxPerPayment;
        bool paused;
        bool exists;
        address[] allowlist;
    }

    error AccountNotFound();
    error NotAccountOwner();
    error NotAccountAgent();
    error AccountPaused();
    error ExceedsPerPaymentCap();
    error ExceedsDailyLimit();
    error ProviderNotAllowlisted();
    error ProviderNotActive();
    error InsufficientBalance();
    error InvalidLimits();
    error ZeroAmount();
    error ZeroAddress();

    event AccountCreated(
        uint256 indexed accountId,
        address indexed owner,
        address indexed agent,
        uint256 depositAmount,
        uint256 dailyLimit,
        uint256 maxPerPayment
    );
    event ToppedUp(uint256 indexed accountId, uint256 amount);
    event Paid(
        uint256 indexed accountId,
        address indexed agent,
        address indexed provider,
        uint256 amount,
        string memo
    );
    event LimitsUpdated(uint256 indexed accountId, uint256 dailyLimit, uint256 maxPerPayment);
    event AllowlistUpdated(uint256 indexed accountId, address[] allowlist);
    event Paused(uint256 indexed accountId);
    event Unpaused(uint256 indexed accountId);
    event Withdrawn(uint256 indexed accountId, uint256 amount);
    event AccountClosed(uint256 indexed accountId, uint256 remainingBalance);

    IERC20 public immutable usdc;
    IProviderRegistry public immutable registry;

    mapping(uint256 => AgentAccount) public accounts;
    uint256 public nextAccountId;
    mapping(address => uint256[]) public ownerAccounts;
    mapping(address => uint256[]) public agentAccounts;

    constructor(address usdc_, address registry_) {
        if (usdc_ == address(0) || registry_ == address(0)) revert ZeroAddress();

        usdc = IERC20(usdc_);
        registry = IProviderRegistry(registry_);
    }

    function createAccount(
        address agent,
        uint256 depositAmount,
        uint256 dailyLimit,
        uint256 maxPerPayment,
        address[] calldata allowlist
    ) external nonReentrant {
        if (agent == address(0)) revert ZeroAddress();
        if (depositAmount == 0) revert ZeroAmount();
        if (dailyLimit == 0 || maxPerPayment == 0 || maxPerPayment > dailyLimit) revert InvalidLimits();
        if (depositAmount < maxPerPayment) revert InvalidLimits();

        usdc.safeTransferFrom(msg.sender, address(this), depositAmount);

        uint256 accountId = nextAccountId;
        nextAccountId = accountId + 1;

        AgentAccount storage account = accounts[accountId];
        account.owner = msg.sender;
        account.agent = agent;
        account.balance = depositAmount;
        account.dailyLimit = dailyLimit;
        account.spentToday = 0;
        account.dayWindowStart = block.timestamp;
        account.maxPerPayment = maxPerPayment;
        account.paused = false;
        account.exists = true;

        for (uint256 i = 0; i < allowlist.length; i++) {
            account.allowlist.push(allowlist[i]);
        }

        ownerAccounts[msg.sender].push(accountId);
        agentAccounts[agent].push(accountId);

        emit AccountCreated(accountId, msg.sender, agent, depositAmount, dailyLimit, maxPerPayment);
    }

    function topUp(uint256 accountId, uint256 amount) external nonReentrant {
        AgentAccount storage account = _getExistingAccount(accountId);
        if (account.owner != msg.sender) revert NotAccountOwner();
        if (amount == 0) revert ZeroAmount();

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        account.balance += amount;

        emit ToppedUp(accountId, amount);
    }

    function withdraw(uint256 accountId, uint256 amount) external nonReentrant {
        AgentAccount storage account = _getExistingAccount(accountId);
        if (account.owner != msg.sender) revert NotAccountOwner();
        if (amount == 0) revert ZeroAmount();
        if (amount > account.balance) revert InsufficientBalance();

        account.balance -= amount;
        usdc.safeTransfer(msg.sender, amount);

        emit Withdrawn(accountId, amount);
    }

    function withdrawAll(uint256 accountId) external nonReentrant {
        AgentAccount storage account = _getExistingAccount(accountId);
        if (account.owner != msg.sender) revert NotAccountOwner();

        uint256 amount = account.balance;
        account.balance = 0;

        if (amount > 0) {
            usdc.safeTransfer(msg.sender, amount);
        }

        emit Withdrawn(accountId, amount);
    }

    function updateLimits(uint256 accountId, uint256 dailyLimit, uint256 maxPerPayment) external {
        AgentAccount storage account = _getExistingAccount(accountId);
        if (account.owner != msg.sender) revert NotAccountOwner();
        if (dailyLimit == 0 || maxPerPayment == 0 || maxPerPayment > dailyLimit) revert InvalidLimits();

        account.dailyLimit = dailyLimit;
        account.maxPerPayment = maxPerPayment;

        emit LimitsUpdated(accountId, dailyLimit, maxPerPayment);
    }

    function updateAllowlist(uint256 accountId, address[] calldata allowlist) external {
        AgentAccount storage account = _getExistingAccount(accountId);
        if (account.owner != msg.sender) revert NotAccountOwner();

        delete account.allowlist;
        for (uint256 i = 0; i < allowlist.length; i++) {
            account.allowlist.push(allowlist[i]);
        }

        emit AllowlistUpdated(accountId, allowlist);
    }

    function pause(uint256 accountId) external {
        AgentAccount storage account = _getExistingAccount(accountId);
        if (account.owner != msg.sender) revert NotAccountOwner();

        account.paused = true;

        emit Paused(accountId);
    }

    function unpause(uint256 accountId) external {
        AgentAccount storage account = _getExistingAccount(accountId);
        if (account.owner != msg.sender) revert NotAccountOwner();

        account.paused = false;

        emit Unpaused(accountId);
    }

    function closeAccount(uint256 accountId) external nonReentrant {
        AgentAccount storage account = _getExistingAccount(accountId);
        if (account.owner != msg.sender) revert NotAccountOwner();

        uint256 remainingBalance = account.balance;
        account.balance = 0;
        account.exists = false;

        if (remainingBalance > 0) {
            usdc.safeTransfer(msg.sender, remainingBalance);
        }

        emit AccountClosed(accountId, remainingBalance);
    }

    function pay(uint256 accountId, address provider, uint256 amount, string calldata memo) external nonReentrant {
        AgentAccount storage account = _getExistingAccount(accountId);
        if (account.agent != msg.sender) revert NotAccountAgent();
        if (account.paused) revert AccountPaused();
        if (amount == 0) revert ZeroAmount();
        if (amount > account.maxPerPayment) revert ExceedsPerPaymentCap();

        _refreshDailyWindow(account);

        if (account.spentToday + amount > account.dailyLimit) revert ExceedsDailyLimit();
        if (!_isProviderAllowed(account.allowlist, provider)) revert ProviderNotAllowlisted();
        if (!registry.isActive(provider)) revert ProviderNotActive();
        if (amount > account.balance) revert InsufficientBalance();

        account.balance -= amount;
        account.spentToday += amount;

        registry.recordPayment(provider, amount);
        usdc.safeTransfer(provider, amount);

        emit Paid(accountId, msg.sender, provider, amount, memo);
    }

    function getAccount(uint256 accountId) external view returns (AgentAccount memory) {
        AgentAccount memory account = accounts[accountId];
        if (!account.exists) revert AccountNotFound();
        return account;
    }

    function getOwnerAccounts(address owner) external view returns (uint256[] memory) {
        return ownerAccounts[owner];
    }

    function getAgentAccounts(address agent) external view returns (uint256[] memory) {
        return agentAccounts[agent];
    }

    function getRemainingDailyLimit(uint256 accountId) external view returns (uint256) {
        AgentAccount memory account = accounts[accountId];
        if (!account.exists) revert AccountNotFound();

        (uint256 spentToday, ) = _previewDailyState(account);

        if (spentToday >= account.dailyLimit) {
            return 0;
        }

        return account.dailyLimit - spentToday;
    }

    function _getExistingAccount(uint256 accountId) internal view returns (AgentAccount storage account) {
        account = accounts[accountId];
        if (!account.exists) revert AccountNotFound();
    }

    function _refreshDailyWindow(AgentAccount storage account) internal {
        if (block.timestamp >= account.dayWindowStart + 1 days) {
            uint256 elapsedDays = (block.timestamp - account.dayWindowStart) / 1 days;
            account.spentToday = 0;
            account.dayWindowStart += 1 days * elapsedDays;
        }
    }

    function _previewDailyState(AgentAccount memory account)
        internal
        view
        returns (uint256 spentToday, uint256 dayWindowStart)
    {
        spentToday = account.spentToday;
        dayWindowStart = account.dayWindowStart;

        if (block.timestamp >= dayWindowStart + 1 days) {
            uint256 elapsedDays = (block.timestamp - dayWindowStart) / 1 days;
            spentToday = 0;
            dayWindowStart += 1 days * elapsedDays;
        }
    }

    function _isProviderAllowed(address[] storage allowlist, address provider) internal view returns (bool) {
        if (allowlist.length == 0) {
            return true;
        }

        for (uint256 i = 0; i < allowlist.length; i++) {
            if (allowlist[i] == provider) {
                return true;
            }
        }

        return false;
    }
}
