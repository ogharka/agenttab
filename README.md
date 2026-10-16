# AgentTab

**A USDC spending-account system on Arc mainnet that lets humans safely give AI agents a budget to pay for services, and lets service providers get paid per request.**

Built with [Arc Studio](https://studio.arc.io) by Circle.

---

## What it does

AgentTab lets you:

- **Create agent accounts** — deposit USDC, set an agent wallet address, configure a daily spending limit, a per-payment cap, and an optional allowlist of approved providers
- **Let agents pay autonomously** — the agent wallet calls `pay(accountId, provider, amount, memo)` and the contract enforces every rule automatically
- **Register as a provider** — any service can register a name, description, and USDC price per call; gets paid directly and instantly on each request
- **Stay in control** — one-tap pause/unpause, top-up, withdraw, and limit updates at any time

## Live Contracts (Arc Mainnet)

| Contract | Address | Explorer |
|---|---|---|
| **AgentTab** | `0x5ac7171a4fc73161FBAb4955E3aB57B89127b235` | [View on explorer.arc.io](https://explorer.arc.io/address/0x5ac7171a4fc73161FBAb4955E3aB57B89127b235) |
| **ProviderRegistry** | `0xdfB3A0ea416049d657791A2a0DfB6bDFf0dA71E6` | [View on explorer.arc.io](https://explorer.arc.io/address/0xdfB3A0ea416049d657791A2a0DfB6bDFf0dA71E6) |

**USDC (Arc Mainnet):** `0x3600000000000000000000000000000000000000`

### Example mainnet payment transaction

[`0x93af2da63bb4190c17ce5e48a6bf9dfd36f35bb70432e743902d6d21e3caf944`](https://explorer.arc.io/tx/0x93af2da63bb4190c17ce5e48a6bf9dfd36f35bb70432e743902d6d21e3caf944)

---

## Roles

| Role | Description |
|---|---|
| **Owner** | Human who funds and controls agent accounts. Sets limits, pauses, withdraws. |
| **Agent** | Wallet address of an AI agent or bot. Calls `pay()` within its budget. |
| **Provider** | Service that registers a USDC price per call and receives payments. |

## Contracts

### AgentTab.sol

Core spending-account logic. Key functions:

- `createAccount(agent, depositAmount, dailyLimit, maxPerPayment, allowlist)` — owner creates an account
- `topUp(accountId, amount)` — add more USDC to an account
- `withdraw(accountId, amount)` — withdraw unused USDC
- `pay(accountId, provider, amount, memo)` — agent pays a provider (enforces all limits)
- `pause(accountId)` / `unpause(accountId)` — instant kill switch
- `updateLimits(accountId, dailyLimit, maxPerPayment)` — change limits any time
- `updateAllowlist(accountId, allowlist)` — change approved providers
- `closeAccount(accountId)` — withdraw all and close

Reverts with specific custom errors: `AccountPaused`, `ExceedsPerPaymentCap`, `ExceedsDailyLimit`, `ProviderNotAllowlisted`, `ProviderNotActive`, `InsufficientBalance`.

Daily limits reset every 24 hours automatically.

### ProviderRegistry.sol

Provider directory. Key functions:

- `register(name, description, pricePerCall)` — register your service
- `updatePrice(newPrice)` — update your price
- `deactivate()` / `activate()` — toggle availability
- `recordPayment(provider, amount)` — called by AgentTab only; tracks total earned

---

## App (4 pages)

- **Owner Dashboard** — create accounts, monitor balance and daily spend, pause agents, top up/withdraw
- **Marketplace** — browse all registered providers and their prices
- **Provider Portal** — register your service, track earnings
- **Agent Simulator** — connect as the agent wallet, send test payments, see exact success or failure reasons

---

## Security

- ReentrancyGuard + SafeERC20 on all USDC-moving functions
- Custom errors for precise revert reasons
- 95 Foundry unit tests (daily limit reset, per-payment cap, allowlist, pause, withdrawal, fuzz invariants)
- Balanced security audit — no findings
- Deployed via Compass CREATE2 engine with Circle developer-controlled wallet custody

---

## Tech stack

- **Contracts:** Solidity 0.8.20, OpenZeppelin 5.x, Foundry
- **Frontend:** React + TypeScript + Vite + Tailwind CSS + wagmi v2 + ConnectKit
- **Chain:** [Arc](https://arc.io) — Circle's blockchain where USDC is the native gas token
- **Built with:** [Arc Studio](https://studio.arc.io)

---

## Development

```bash
# Install dependencies
bun install

# Run dev server
bun run dev

# Build contracts
forge build

# Run tests
forge test

# Lint + typecheck
bun run check
```

After deploying contracts, update `src/contracts.ts` with the live addresses.

---

## Configuration

Copy `.env.example` to `.env` and fill in your values. Never commit `.env` or `.circle/`.

---

## License

MIT
