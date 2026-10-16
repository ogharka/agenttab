// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AgentTab} from "../AgentTab.sol";
import {ProviderRegistry} from "../ProviderRegistry.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  Shared fixture base
// ─────────────────────────────────────────────────────────────────────────────
contract Base is Test {
    MockERC20    internal usdc;
    ProviderRegistry internal registry;
    AgentTab     internal agentTab;

    // Named participants
    address internal registryOwner = makeAddr("registryOwner");
    address internal alice         = makeAddr("alice");   // account owner
    address internal agent         = makeAddr("agent");
    address internal provider1     = makeAddr("provider1");
    address internal provider2     = makeAddr("provider2");
    address internal stranger      = makeAddr("stranger");

    // USDC amounts (6-decimal)
    uint256 internal constant DEPOSIT         = 1_000e6;
    uint256 internal constant DAILY_LIMIT     = 500e6;
    uint256 internal constant MAX_PER_PAYMENT = 100e6;

    function setUp() public virtual {
        // 1. Mock USDC (passed as constructor arg — no vm.etch needed)
        usdc = new MockERC20("Mock USDC", "mUSDC", 6);

        // 2. ProviderRegistry: pass registryOwner as initialOwner_ so setAgentTabContract can be called
        vm.prank(registryOwner);
        registry = new ProviderRegistry(registryOwner, address(0));

        // 3. AgentTab
        agentTab = new AgentTab(address(usdc), address(registry));

        // 4. Wire registry → agentTab
        vm.prank(registryOwner);
        registry.setAgentTabContract(address(agentTab));

        // 5. Register provider1 as active
        vm.prank(provider1);
        registry.register("Provider1", "Test provider 1", 10e6);

        // 6. Mint USDC to alice and approve agentTab
        usdc.mint(alice, 10_000e6);
        vm.prank(alice);
        usdc.approve(address(agentTab), type(uint256).max);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// Create an account with defaults (no allowlist).
    function _createAccount() internal returns (uint256 accountId) {
        vm.prank(alice);
        agentTab.createAccount(agent, DEPOSIT, DAILY_LIMIT, MAX_PER_PAYMENT, new address[](0));
        accountId = agentTab.nextAccountId() - 1;
    }

    /// Create an account WITH an allowlist containing only provider1.
    function _createAccountWithAllowlist() internal returns (uint256 accountId) {
        address[] memory al = new address[](1);
        al[0] = provider1;
        vm.prank(alice);
        agentTab.createAccount(agent, DEPOSIT, DAILY_LIMIT, MAX_PER_PAYMENT, al);
        accountId = agentTab.nextAccountId() - 1;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  1.  Deployment & initialisation
// ─────────────────────────────────────────────────────────────────────────────
contract DeploymentTest is Base {

    function test_AgentTabStoresUsdcAndRegistry() public view {
        assertEq(address(agentTab.usdc()),     address(usdc));
        assertEq(address(agentTab.registry()), address(registry));
    }

    function test_AgentTabConstructorRevertsOnZeroUsdc() public {
        vm.expectRevert(AgentTab.ZeroAddress.selector);
        new AgentTab(address(0), address(registry));
    }

    function test_AgentTabConstructorRevertsOnZeroRegistry() public {
        vm.expectRevert(AgentTab.ZeroAddress.selector);
        new AgentTab(address(usdc), address(0));
    }

    function test_RegistryOwnerIsRegistryOwner() public view {
        assertEq(registry.owner(), registryOwner);
    }

    function test_RegistryAgentTabContractSet() public view {
        assertEq(registry.agentTabContract(), address(agentTab));
    }

    function test_RegistrySetAgentTabRevertsAlreadySet() public {
        vm.prank(registryOwner);
        vm.expectRevert(ProviderRegistry.AlreadySet.selector);
        registry.setAgentTabContract(address(agentTab));
    }

    function test_RegistrySetAgentTabRevertsIfNotOwner() public {
        // Deploy a fresh registry with address(0) to test onlyOwner guard
        vm.prank(registryOwner);
        ProviderRegistry freshReg = new ProviderRegistry(address(this), address(0));

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        freshReg.setAgentTabContract(address(agentTab));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  2.  createAccount happy path + event
// ─────────────────────────────────────────────────────────────────────────────
contract CreateAccountTest is Base {

    function test_CreateAccountStoresFields() public {
        uint256 id = _createAccount();
        AgentTab.AgentAccount memory acc = agentTab.getAccount(id);

        assertEq(acc.owner,         alice);
        assertEq(acc.agent,         agent);
        assertEq(acc.balance,       DEPOSIT);
        assertEq(acc.dailyLimit,    DAILY_LIMIT);
        assertEq(acc.maxPerPayment, MAX_PER_PAYMENT);
        assertFalse(acc.paused);
        assertTrue(acc.exists);
        assertEq(acc.spentToday,    0);
    }

    function test_CreateAccountTransfersUsdcToContract() public {
        uint256 id = _createAccount();
        assertEq(usdc.balanceOf(address(agentTab)), DEPOSIT);
        // id is used only to anchor this test to the created account
        assertEq(agentTab.getAccount(id).balance, DEPOSIT);
    }

    function test_CreateAccountEmitsAccountCreated() public {
        vm.prank(alice);
        vm.expectEmit(true, true, true, true, address(agentTab));
        emit AgentTab.AccountCreated(0, alice, agent, DEPOSIT, DAILY_LIMIT, MAX_PER_PAYMENT);
        agentTab.createAccount(agent, DEPOSIT, DAILY_LIMIT, MAX_PER_PAYMENT, new address[](0));
    }

    function test_CreateAccountIncrementsNextAccountId() public {
        assertEq(agentTab.nextAccountId(), 0);
        _createAccount();
        assertEq(agentTab.nextAccountId(), 1);
        _createAccount();
        assertEq(agentTab.nextAccountId(), 2);
    }

    function test_CreateAccountIndexedInOwnerAndAgentMaps() public {
        uint256 id = _createAccount();
        uint256[] memory ownedIds = agentTab.getOwnerAccounts(alice);
        uint256[] memory agentIds = agentTab.getAgentAccounts(agent);
        assertEq(ownedIds.length, 1);
        assertEq(ownedIds[0],     id);
        assertEq(agentIds.length, 1);
        assertEq(agentIds[0],     id);
    }

    // ── Revert paths ──────────────────────────────────────────────────────────

    function test_CreateAccountRevertsOnZeroAgent() public {
        vm.prank(alice);
        vm.expectRevert(AgentTab.ZeroAddress.selector);
        agentTab.createAccount(address(0), DEPOSIT, DAILY_LIMIT, MAX_PER_PAYMENT, new address[](0));
    }

    function test_CreateAccountRevertsOnZeroDeposit() public {
        vm.prank(alice);
        vm.expectRevert(AgentTab.ZeroAmount.selector);
        agentTab.createAccount(agent, 0, DAILY_LIMIT, MAX_PER_PAYMENT, new address[](0));
    }

    function test_CreateAccountRevertsOnZeroDailyLimit() public {
        vm.prank(alice);
        vm.expectRevert(AgentTab.InvalidLimits.selector);
        agentTab.createAccount(agent, DEPOSIT, 0, MAX_PER_PAYMENT, new address[](0));
    }

    function test_CreateAccountRevertsOnZeroMaxPerPayment() public {
        vm.prank(alice);
        vm.expectRevert(AgentTab.InvalidLimits.selector);
        agentTab.createAccount(agent, DEPOSIT, DAILY_LIMIT, 0, new address[](0));
    }

    function test_CreateAccountRevertsWhenMaxPerPaymentExceedsDailyLimit() public {
        vm.prank(alice);
        vm.expectRevert(AgentTab.InvalidLimits.selector);
        // maxPerPayment > dailyLimit
        agentTab.createAccount(agent, DEPOSIT, 50e6, 100e6, new address[](0));
    }

    function test_CreateAccountRevertsWhenDepositLessThanMaxPerPayment() public {
        vm.prank(alice);
        // deposit (5e6) < maxPerPayment (100e6)
        vm.expectRevert(AgentTab.InvalidLimits.selector);
        agentTab.createAccount(agent, 5e6, DAILY_LIMIT, MAX_PER_PAYMENT, new address[](0));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  3.  Normal payment flow
// ─────────────────────────────────────────────────────────────────────────────
contract PayTest is Base {

    function test_PayHappyPath() public {
        uint256 id = _createAccount();
        uint256 payAmount = 50e6;

        vm.prank(agent);
        agentTab.pay(id, provider1, payAmount, "test memo");

        AgentTab.AgentAccount memory acc = agentTab.getAccount(id);
        assertEq(acc.balance,    DEPOSIT - payAmount);
        assertEq(acc.spentToday, payAmount);
        assertEq(usdc.balanceOf(provider1), payAmount);
    }

    function test_PayEmitsPaidEvent() public {
        uint256 id = _createAccount();
        uint256 payAmount = 50e6;

        vm.prank(agent);
        vm.expectEmit(true, true, true, true, address(agentTab));
        emit AgentTab.Paid(id, agent, provider1, payAmount, "hello");
        agentTab.pay(id, provider1, payAmount, "hello");
    }

    function test_PayRecordsInRegistry() public {
        uint256 id = _createAccount();
        uint256 payAmount = 50e6;

        vm.prank(agent);
        agentTab.pay(id, provider1, payAmount, "memo");

        (,,,, bool active, uint256 earned) = registry.providers(provider1);
        assertEq(earned, payAmount);
        assertTrue(active);
    }

    function test_PayRevertsIfNotAgent() public {
        uint256 id = _createAccount();
        vm.prank(stranger);
        vm.expectRevert(AgentTab.NotAccountAgent.selector);
        agentTab.pay(id, provider1, 50e6, "");
    }

    function test_PayRevertsOnZeroAmount() public {
        uint256 id = _createAccount();
        vm.prank(agent);
        vm.expectRevert(AgentTab.ZeroAmount.selector);
        agentTab.pay(id, provider1, 0, "");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  4.  Daily limit enforcement
// ─────────────────────────────────────────────────────────────────────────────
contract DailyLimitTest is Base {

    function test_PaymentsUpToDailyLimitSucceed() public {
        uint256 id = _createAccount();
        // 5 × 100e6 == 500e6 == DAILY_LIMIT
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(agent);
            agentTab.pay(id, provider1, MAX_PER_PAYMENT, "");
        }
        AgentTab.AgentAccount memory acc = agentTab.getAccount(id);
        assertEq(acc.spentToday, DAILY_LIMIT);
    }

    function test_PaymentOverDailyLimitReverts() public {
        uint256 id = _createAccount();
        // Exhaust the daily limit
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(agent);
            agentTab.pay(id, provider1, MAX_PER_PAYMENT, "");
        }
        // Next payment should exceed daily limit
        vm.prank(agent);
        vm.expectRevert(AgentTab.ExceedsDailyLimit.selector);
        agentTab.pay(id, provider1, 1e6, "");
    }

    function test_DailyLimitResetAfterOneDay() public {
        uint256 id = _createAccount();
        // Exhaust limit
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(agent);
            agentTab.pay(id, provider1, MAX_PER_PAYMENT, "");
        }
        // Warp forward 1 day
        skip(1 days);

        // Top up so balance isn't a bottleneck
        usdc.mint(alice, 500e6);
        vm.prank(alice);
        agentTab.topUp(id, 500e6);

        // Should succeed again
        vm.prank(agent);
        agentTab.pay(id, provider1, MAX_PER_PAYMENT, "");

        AgentTab.AgentAccount memory acc = agentTab.getAccount(id);
        // spentToday reset and now equals the single payment
        assertEq(acc.spentToday, MAX_PER_PAYMENT);
    }

    function test_GetRemainingDailyLimitBeforeAnySpend() public {
        uint256 id = _createAccount();
        assertEq(agentTab.getRemainingDailyLimit(id), DAILY_LIMIT);
    }

    function test_GetRemainingDailyLimitDecreasesAfterPayment() public {
        uint256 id = _createAccount();
        vm.prank(agent);
        agentTab.pay(id, provider1, 50e6, "");
        assertEq(agentTab.getRemainingDailyLimit(id), DAILY_LIMIT - 50e6);
    }

    function test_GetRemainingDailyLimitReturnsZeroWhenExhausted() public {
        uint256 id = _createAccount();
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(agent);
            agentTab.pay(id, provider1, MAX_PER_PAYMENT, "");
        }
        assertEq(agentTab.getRemainingDailyLimit(id), 0);
    }

    function test_GetRemainingDailyLimitResetsAfterOneDay() public {
        uint256 id = _createAccount();
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(agent);
            agentTab.pay(id, provider1, MAX_PER_PAYMENT, "");
        }
        skip(1 days);
        assertEq(agentTab.getRemainingDailyLimit(id), DAILY_LIMIT);
    }

    function test_GetRemainingDailyLimitRevertsOnUnknownAccount() public {
        vm.expectRevert(AgentTab.AccountNotFound.selector);
        agentTab.getRemainingDailyLimit(999);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  5.  Per-payment cap
// ─────────────────────────────────────────────────────────────────────────────
contract PerPaymentCapTest is Base {

    function test_PaymentExceedingCapReverts() public {
        uint256 id = _createAccount();
        vm.prank(agent);
        vm.expectRevert(AgentTab.ExceedsPerPaymentCap.selector);
        agentTab.pay(id, provider1, MAX_PER_PAYMENT + 1, "");
    }

    function test_PaymentExactlyAtCapSucceeds() public {
        uint256 id = _createAccount();
        vm.prank(agent);
        agentTab.pay(id, provider1, MAX_PER_PAYMENT, "");
        assertEq(agentTab.getAccount(id).spentToday, MAX_PER_PAYMENT);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  6.  Allowlist enforcement
// ─────────────────────────────────────────────────────────────────────────────
contract AllowlistTest is Base {

    function setUp() public override {
        super.setUp();
        // Register provider2 as well
        vm.prank(provider2);
        registry.register("Provider2", "Test provider 2", 5e6);
    }

    function test_NoAllowlistAllowsAnyActiveProvider() public {
        uint256 id = _createAccount(); // no allowlist
        // payment to provider2 should work
        vm.prank(agent);
        agentTab.pay(id, provider2, 50e6, "");
        assertEq(usdc.balanceOf(provider2), 50e6);
    }

    function test_WithAllowlistPaymentToAllowlistedProviderSucceeds() public {
        uint256 id = _createAccountWithAllowlist(); // only provider1
        vm.prank(agent);
        agentTab.pay(id, provider1, 50e6, "");
        assertEq(usdc.balanceOf(provider1), 50e6);
    }

    function test_WithAllowlistPaymentToNonAllowlistedProviderReverts() public {
        uint256 id = _createAccountWithAllowlist(); // only provider1
        vm.prank(agent);
        vm.expectRevert(AgentTab.ProviderNotAllowlisted.selector);
        agentTab.pay(id, provider2, 50e6, "");
    }

    function test_UpdateAllowlistChangesAllowedProviders() public {
        uint256 id = _createAccountWithAllowlist(); // only provider1

        // Switch allowlist to only provider2
        address[] memory newAl = new address[](1);
        newAl[0] = provider2;
        vm.prank(alice);
        agentTab.updateAllowlist(id, newAl);

        // provider1 now rejected
        vm.prank(agent);
        vm.expectRevert(AgentTab.ProviderNotAllowlisted.selector);
        agentTab.pay(id, provider1, 50e6, "");

        // provider2 now accepted
        vm.prank(agent);
        agentTab.pay(id, provider2, 50e6, "");
        assertEq(usdc.balanceOf(provider2), 50e6);
    }

    function test_UpdateAllowlistEmitsEvent() public {
        uint256 id = _createAccount();
        address[] memory newAl = new address[](1);
        newAl[0] = provider1;

        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(agentTab));
        emit AgentTab.AllowlistUpdated(id, newAl);
        agentTab.updateAllowlist(id, newAl);
    }

    function test_UpdateAllowlistRevertsIfNotOwner() public {
        uint256 id = _createAccount();
        address[] memory newAl = new address[](0);
        vm.prank(stranger);
        vm.expectRevert(AgentTab.NotAccountOwner.selector);
        agentTab.updateAllowlist(id, newAl);
    }

    function test_ClearAllowlistAllowsAllActiveProviders() public {
        uint256 id = _createAccountWithAllowlist(); // only provider1
        // Clear allowlist
        vm.prank(alice);
        agentTab.updateAllowlist(id, new address[](0));

        // provider2 now works
        vm.prank(agent);
        agentTab.pay(id, provider2, 50e6, "");
        assertEq(usdc.balanceOf(provider2), 50e6);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  7.  Pause / unpause
// ─────────────────────────────────────────────────────────────────────────────
contract PauseTest is Base {

    function test_PauseBlocksPayment() public {
        uint256 id = _createAccount();
        vm.prank(alice);
        agentTab.pause(id);

        vm.prank(agent);
        vm.expectRevert(AgentTab.AccountPaused.selector);
        agentTab.pay(id, provider1, 50e6, "");
    }

    function test_UnpauseAllowsPayment() public {
        uint256 id = _createAccount();
        vm.prank(alice);
        agentTab.pause(id);
        vm.prank(alice);
        agentTab.unpause(id);

        vm.prank(agent);
        agentTab.pay(id, provider1, 50e6, "");
        assertEq(agentTab.getAccount(id).spentToday, 50e6);
    }

    function test_PauseEmitsPausedEvent() public {
        uint256 id = _createAccount();
        vm.prank(alice);
        vm.expectEmit(true, false, false, false, address(agentTab));
        emit AgentTab.Paused(id);
        agentTab.pause(id);
    }

    function test_UnpauseEmitsUnpausedEvent() public {
        uint256 id = _createAccount();
        vm.prank(alice);
        agentTab.pause(id);

        vm.prank(alice);
        vm.expectEmit(true, false, false, false, address(agentTab));
        emit AgentTab.Unpaused(id);
        agentTab.unpause(id);
    }

    function test_PauseRevertsIfNotOwner() public {
        uint256 id = _createAccount();
        vm.prank(stranger);
        vm.expectRevert(AgentTab.NotAccountOwner.selector);
        agentTab.pause(id);
    }

    function test_UnpauseRevertsIfNotOwner() public {
        uint256 id = _createAccount();
        vm.prank(alice);
        agentTab.pause(id);

        vm.prank(stranger);
        vm.expectRevert(AgentTab.NotAccountOwner.selector);
        agentTab.unpause(id);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  8.  topUp
// ─────────────────────────────────────────────────────────────────────────────
contract TopUpTest is Base {

    function test_TopUpIncreasesBalance() public {
        uint256 id = _createAccount();
        uint256 extra = 200e6;
        usdc.mint(alice, extra);
        vm.prank(alice);
        agentTab.topUp(id, extra);

        assertEq(agentTab.getAccount(id).balance, DEPOSIT + extra);
    }

    function test_TopUpEmitsToppedUpEvent() public {
        uint256 id = _createAccount();
        uint256 extra = 100e6;
        usdc.mint(alice, extra);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(agentTab));
        emit AgentTab.ToppedUp(id, extra);
        agentTab.topUp(id, extra);
    }

    function test_TopUpRevertsIfNotOwner() public {
        uint256 id = _createAccount();
        usdc.mint(stranger, 100e6);
        vm.prank(stranger);
        usdc.approve(address(agentTab), type(uint256).max);

        vm.prank(stranger);
        vm.expectRevert(AgentTab.NotAccountOwner.selector);
        agentTab.topUp(id, 100e6);
    }

    function test_TopUpRevertsOnZeroAmount() public {
        uint256 id = _createAccount();
        vm.prank(alice);
        vm.expectRevert(AgentTab.ZeroAmount.selector);
        agentTab.topUp(id, 0);
    }

    function test_TopUpRevertsOnUnknownAccount() public {
        vm.expectRevert(AgentTab.AccountNotFound.selector);
        agentTab.topUp(999, 100e6);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  9.  withdraw / withdrawAll
// ─────────────────────────────────────────────────────────────────────────────
contract WithdrawTest is Base {

    function test_WithdrawPartialAmount() public {
        uint256 id = _createAccount();
        uint256 withdrawAmt = 300e6;

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        agentTab.withdraw(id, withdrawAmt);

        assertEq(agentTab.getAccount(id).balance, DEPOSIT - withdrawAmt);
        assertEq(usdc.balanceOf(alice), balBefore + withdrawAmt);
    }

    function test_WithdrawEmitsWithdrawnEvent() public {
        uint256 id = _createAccount();
        uint256 amt = 100e6;

        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(agentTab));
        emit AgentTab.Withdrawn(id, amt);
        agentTab.withdraw(id, amt);
    }

    function test_WithdrawRevertsOnExcessAmount() public {
        uint256 id = _createAccount();
        vm.prank(alice);
        vm.expectRevert(AgentTab.InsufficientBalance.selector);
        agentTab.withdraw(id, DEPOSIT + 1);
    }

    function test_WithdrawRevertsOnZeroAmount() public {
        uint256 id = _createAccount();
        vm.prank(alice);
        vm.expectRevert(AgentTab.ZeroAmount.selector);
        agentTab.withdraw(id, 0);
    }

    function test_WithdrawRevertsIfNotOwner() public {
        uint256 id = _createAccount();
        vm.prank(stranger);
        vm.expectRevert(AgentTab.NotAccountOwner.selector);
        agentTab.withdraw(id, 100e6);
    }

    function test_WithdrawAllSendsFullBalance() public {
        uint256 id = _createAccount();
        uint256 balBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        agentTab.withdrawAll(id);

        assertEq(agentTab.getAccount(id).balance, 0);
        assertEq(usdc.balanceOf(alice), balBefore + DEPOSIT);
    }

    function test_WithdrawAllEmitsWithdrawnEvent() public {
        uint256 id = _createAccount();

        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(agentTab));
        emit AgentTab.Withdrawn(id, DEPOSIT);
        agentTab.withdrawAll(id);
    }

    function test_WithdrawAllRevertsIfNotOwner() public {
        uint256 id = _createAccount();
        vm.prank(stranger);
        vm.expectRevert(AgentTab.NotAccountOwner.selector);
        agentTab.withdrawAll(id);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  10.  Insufficient balance for payment
// ─────────────────────────────────────────────────────────────────────────────
contract InsufficientBalanceTest is Base {

    function test_PayRevertsWhenBalanceBelowPayment() public {
        // Create an account where deposit == maxPerPayment so one payment drains it
        uint256 smallDeposit = MAX_PER_PAYMENT;
        vm.prank(alice);
        agentTab.createAccount(agent, smallDeposit, DAILY_LIMIT, MAX_PER_PAYMENT, new address[](0));
        uint256 id = agentTab.nextAccountId() - 1;

        // First payment drains balance
        vm.prank(agent);
        agentTab.pay(id, provider1, MAX_PER_PAYMENT, "");

        // Top up with less than maxPerPayment so the second payment would exceed balance
        // But that's tricky — instead just try to pay again immediately with zero balance
        vm.prank(agent);
        vm.expectRevert(AgentTab.InsufficientBalance.selector);
        agentTab.pay(id, provider1, MAX_PER_PAYMENT, "");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  11.  updateLimits
// ─────────────────────────────────────────────────────────────────────────────
contract UpdateLimitsTest is Base {

    function test_UpdateLimitsChangesValues() public {
        uint256 id = _createAccount();
        vm.prank(alice);
        agentTab.updateLimits(id, 200e6, 50e6);

        AgentTab.AgentAccount memory acc = agentTab.getAccount(id);
        assertEq(acc.dailyLimit,    200e6);
        assertEq(acc.maxPerPayment, 50e6);
    }

    function test_UpdateLimitsEmitsEvent() public {
        uint256 id = _createAccount();
        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(agentTab));
        emit AgentTab.LimitsUpdated(id, 200e6, 50e6);
        agentTab.updateLimits(id, 200e6, 50e6);
    }

    function test_UpdateLimitsRevertsIfNotOwner() public {
        uint256 id = _createAccount();
        vm.prank(stranger);
        vm.expectRevert(AgentTab.NotAccountOwner.selector);
        agentTab.updateLimits(id, 200e6, 50e6);
    }

    function test_UpdateLimitsRevertsWhenMaxExceedsDailyLimit() public {
        uint256 id = _createAccount();
        vm.prank(alice);
        vm.expectRevert(AgentTab.InvalidLimits.selector);
        agentTab.updateLimits(id, 50e6, 100e6);
    }

    function test_UpdateLimitsRevertsOnZeroValues() public {
        uint256 id = _createAccount();
        vm.prank(alice);
        vm.expectRevert(AgentTab.InvalidLimits.selector);
        agentTab.updateLimits(id, 0, 50e6);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  12.  closeAccount
// ─────────────────────────────────────────────────────────────────────────────
contract CloseAccountTest is Base {

    function test_CloseAccountTransfersBalanceToOwner() public {
        uint256 id = _createAccount();
        uint256 balBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        agentTab.closeAccount(id);

        assertEq(usdc.balanceOf(alice), balBefore + DEPOSIT);
    }

    function test_CloseAccountSetsExistsFalse() public {
        uint256 id = _createAccount();
        vm.prank(alice);
        agentTab.closeAccount(id);

        vm.expectRevert(AgentTab.AccountNotFound.selector);
        agentTab.getAccount(id);
    }

    function test_CloseAccountEmitsAccountClosedEvent() public {
        uint256 id = _createAccount();
        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(agentTab));
        emit AgentTab.AccountClosed(id, DEPOSIT);
        agentTab.closeAccount(id);
    }

    function test_CloseAccountRevertsIfNotOwner() public {
        uint256 id = _createAccount();
        vm.prank(stranger);
        vm.expectRevert(AgentTab.NotAccountOwner.selector);
        agentTab.closeAccount(id);
    }

    function test_CloseAccountWorksWithZeroBalance() public {
        uint256 id = _createAccount();
        // Drain balance first
        vm.prank(alice);
        agentTab.withdrawAll(id);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        agentTab.closeAccount(id); // Should not revert

        assertEq(usdc.balanceOf(alice), balBefore); // No extra transfer
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  13.  ProviderRegistry CRUD
// ─────────────────────────────────────────────────────────────────────────────
contract ProviderRegistryTest is Base {

    function test_RegisterStoresProviderInfo() public {
        (address addr, string memory name,, uint256 price, bool active, uint256 earned) =
            registry.providers(provider1);
        assertEq(addr,   provider1);
        assertEq(name,   "Provider1");
        assertEq(price,  10e6);
        assertTrue(active);
        assertEq(earned, 0);
    }

    function test_RegisterEmitsEvent() public {
        vm.prank(provider2);
        vm.expectEmit(true, false, false, true, address(registry));
        emit ProviderRegistry.ProviderRegistered(provider2, "P2", 5e6);
        registry.register("P2", "desc", 5e6);
    }

    function test_RegisterRevertsIfAlreadyRegistered() public {
        vm.prank(provider1);
        vm.expectRevert(ProviderRegistry.AlreadyRegistered.selector);
        registry.register("Provider1", "desc", 10e6);
    }

    function test_RegisterRevertsOnZeroPrice() public {
        vm.prank(provider2);
        vm.expectRevert(ProviderRegistry.ZeroPrice.selector);
        registry.register("P2", "desc", 0);
    }

    function test_UpdatePriceChangesPrice() public {
        vm.prank(provider1);
        agentTab; // suppress compiler warning
        registry.updatePrice(20e6);
        assertEq(registry.getPrice(provider1), 20e6);
    }

    function test_UpdatePriceEmitsEvent() public {
        vm.prank(provider1);
        vm.expectEmit(true, false, false, true, address(registry));
        emit ProviderRegistry.ProviderPriceUpdated(provider1, 20e6);
        registry.updatePrice(20e6);
    }

    function test_UpdatePriceRevertsIfNotRegistered() public {
        vm.prank(stranger);
        vm.expectRevert(ProviderRegistry.NotRegistered.selector);
        registry.updatePrice(20e6);
    }

    function test_UpdatePriceRevertsOnZeroPrice() public {
        vm.prank(provider1);
        vm.expectRevert(ProviderRegistry.ZeroPrice.selector);
        registry.updatePrice(0);
    }

    function test_DeactivateSetsFlagFalse() public {
        vm.prank(provider1);
        registry.deactivate();
        assertFalse(registry.isActive(provider1));
    }

    function test_DeactivateEmitsEvent() public {
        vm.prank(provider1);
        vm.expectEmit(true, false, false, false, address(registry));
        emit ProviderRegistry.ProviderDeactivated(provider1);
        registry.deactivate();
    }

    function test_DeactivateRevertsIfNotRegistered() public {
        vm.prank(stranger);
        vm.expectRevert(ProviderRegistry.NotRegistered.selector);
        registry.deactivate();
    }

    function test_ActivateSetsActiveFlagTrue() public {
        vm.prank(provider1);
        registry.deactivate();
        vm.prank(provider1);
        registry.activate();
        assertTrue(registry.isActive(provider1));
    }

    function test_ActivateEmitsEvent() public {
        vm.prank(provider1);
        registry.deactivate();
        vm.prank(provider1);
        vm.expectEmit(true, false, false, false, address(registry));
        emit ProviderRegistry.ProviderActivated(provider1);
        registry.activate();
    }

    function test_ActivateRevertsIfNotRegistered() public {
        vm.prank(stranger);
        vm.expectRevert(ProviderRegistry.NotRegistered.selector);
        registry.activate();
    }

    function test_GetProviders() public view {
        address[] memory list = registry.getProviders();
        assertEq(list.length, 1);
        assertEq(list[0], provider1);
    }

    function test_IsActiveReturnsFalseForUnknownProvider() public view {
        assertFalse(registry.isActive(stranger));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  14.  recordPayment — only callable by AgentTab
// ─────────────────────────────────────────────────────────────────────────────
contract RecordPaymentAccessTest is Base {

    function test_RecordPaymentRevertsIfNotAgentTab() public {
        vm.prank(stranger);
        vm.expectRevert(ProviderRegistry.OnlyAgentTab.selector);
        registry.recordPayment(provider1, 100e6);
    }

    function test_RecordPaymentUpdatesTotalEarned() public {
        uint256 id = _createAccount();
        vm.prank(agent);
        agentTab.pay(id, provider1, 50e6, "");

        (,,,,, uint256 earned) = registry.providers(provider1);
        assertEq(earned, 50e6);
    }

    function test_RecordPaymentEmitsPaymentRecordedEvent() public {
        uint256 id = _createAccount();
        // We expect PaymentRecorded to be emitted on the registry during pay()
        vm.prank(agent);
        vm.expectEmit(true, false, false, true, address(registry));
        emit ProviderRegistry.PaymentRecorded(provider1, 50e6);
        agentTab.pay(id, provider1, 50e6, "");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  15.  Deactivated provider rejects payment
// ─────────────────────────────────────────────────────────────────────────────
contract DeactivatedProviderPaymentTest is Base {

    function test_PaymentRevertsWhenProviderDeactivated() public {
        uint256 id = _createAccount();
        vm.prank(provider1);
        registry.deactivate();

        vm.prank(agent);
        vm.expectRevert(AgentTab.ProviderNotActive.selector);
        agentTab.pay(id, provider1, 50e6, "");
    }

    function test_PaymentSucceedsAfterProviderReactivated() public {
        uint256 id = _createAccount();
        vm.prank(provider1);
        registry.deactivate();
        vm.prank(provider1);
        registry.activate();

        vm.prank(agent);
        agentTab.pay(id, provider1, 50e6, "");
        assertEq(agentTab.getAccount(id).spentToday, 50e6);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  16.  Fuzz — topUp round-trip and daily limit arithmetic
// ─────────────────────────────────────────────────────────────────────────────
contract FuzzTest is Base {

    function testFuzz_TopUpRoundTrip(uint256 extra) public {
        extra = bound(extra, 1, 1_000_000e6);
        uint256 id = _createAccount();

        usdc.mint(alice, extra);
        vm.prank(alice);
        agentTab.topUp(id, extra);

        assertEq(agentTab.getAccount(id).balance, DEPOSIT + extra);
    }

    function testFuzz_WithdrawCannotExceedBalance(uint256 over) public {
        over = bound(over, 1, type(uint128).max);
        uint256 id = _createAccount();

        vm.prank(agent);
        agentTab.pay(id, provider1, 1e6, ""); // consume some balance

        uint256 bal = agentTab.getAccount(id).balance;
        vm.prank(alice);
        vm.expectRevert(AgentTab.InsufficientBalance.selector);
        agentTab.withdraw(id, bal + over);
    }

    function testFuzz_SpentTodayNeverExceedsDailyLimit(uint256 amount) public {
        // Bound to a value that both fits within maxPerPayment AND is at most
        // DEPOSIT so the test can actually execute at least one payment.
        amount = bound(amount, 1, MAX_PER_PAYMENT);
        uint256 id = _createAccount();

        // Keep paying until the daily limit or balance would be exhausted
        for (uint256 i = 0; i < 1000; i++) {
            uint256 remaining = agentTab.getRemainingDailyLimit(id);
            uint256 bal       = agentTab.getAccount(id).balance;
            // Stop when the next payment would exceed either constraint
            if (remaining < amount || bal < amount) break;

            vm.prank(agent);
            agentTab.pay(id, provider1, amount, "");
        }

        AgentTab.AgentAccount memory acc = agentTab.getAccount(id);
        assertLe(acc.spentToday, acc.dailyLimit);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  17.  Invariant — contract USDC balance >= sum of all account balances
// ─────────────────────────────────────────────────────────────────────────────
contract AgentTabHandler is Test {
    AgentTab     internal agentTab;
    MockERC20    internal usdc;
    ProviderRegistry internal registry;
    address      internal owner;
    address      internal agent;
    address      internal provider;
    uint256      internal accountId;
    uint256      public  ghostTotalBalance;

    constructor(
        AgentTab _agentTab,
        MockERC20 _usdc,
        ProviderRegistry _registry,
        address _owner,
        address _agent,
        address _provider,
        uint256 _accountId
    ) {
        agentTab   = _agentTab;
        usdc       = _usdc;
        registry   = _registry;
        owner      = _owner;
        agent      = _agent;
        provider   = _provider;
        accountId  = _accountId;
        // Initial balance
        ghostTotalBalance = _agentTab.getAccount(_accountId).balance;
    }

    function topUp(uint256 amount) external {
        amount = bound(amount, 1, 10_000e6);
        usdc.mint(owner, amount);
        vm.prank(owner);
        usdc.approve(address(agentTab), amount);
        vm.prank(owner);
        agentTab.topUp(accountId, amount);
        ghostTotalBalance += amount;
    }

    function withdraw(uint256 amount) external {
        uint256 bal = agentTab.getAccount(accountId).balance;
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        vm.prank(owner);
        agentTab.withdraw(accountId, amount);
        ghostTotalBalance -= amount;
    }

    function pay(uint256 amount) external {
        // Stay within cap and daily limit
        uint256 cap       = agentTab.getAccount(accountId).maxPerPayment;
        uint256 remaining = agentTab.getRemainingDailyLimit(accountId);
        uint256 bal       = agentTab.getAccount(accountId).balance;
        uint256 maxPay    = cap < remaining ? cap : remaining;
        maxPay            = maxPay < bal    ? maxPay : bal;
        if (maxPay == 0) return;
        amount = bound(amount, 1, maxPay);
        vm.prank(agent);
        agentTab.pay(accountId, provider, amount, "inv");
        ghostTotalBalance -= amount;
    }
}

contract AgentTabInvariantTest is Base {
    AgentTabHandler internal handler;

    function setUp() public override {
        super.setUp();
        uint256 id = _createAccount();
        handler = new AgentTabHandler(
            agentTab, usdc, registry,
            alice, agent, provider1, id
        );
        targetContract(address(handler));
    }

    /// INVARIANT: contract USDC balance >= sum of all tracked account balances
    function invariant_ContractBalanceCoversTotalAccountBalances() public view {
        assertGe(
            usdc.balanceOf(address(agentTab)),
            handler.ghostTotalBalance(),
            "Contract USDC balance fell below tracked account balances"
        );
    }
}
