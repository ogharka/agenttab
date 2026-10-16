# AgentTab — Arc Mainnet Deployment

## Live Contracts (Arc Mainnet, deployed 2026-10-16)

| Contract | Address | Explorer |
|---|---|---|
| ProviderRegistry | `0xdfB3A0ea416049d657791A2a0DfB6bDFf0dA71E6` | https://explorer.arc.io/address/0xdfB3A0ea416049d657791A2a0DfB6bDFf0dA71E6 |
| AgentTab | `0x5ac7171a4fc73161FBAb4955E3aB57B89127b235` | https://explorer.arc.io/address/0x5ac7171a4fc73161FBAb4955E3aB57B89127b235 |

## Deployer Wallet
- Wallet ID: `8637a885-2d64-5e45-9cf0-8eb4ff6ecfcb`
- Address: `0xa37a7b0f5c442ad85369f22a38780a9dc64230bc`
- This wallet is the `Ownable` owner of ProviderRegistry and can call `setAgentTabContract` (already done).

## USDC (Arc Mainnet)
- Address: `0x3600000000000000000000000000000000000000`

## Wiring
- `ProviderRegistry.agentTabContract` = `0x5ac7171a4fc73161FBAb4955E3aB57B89127b235` (confirmed onchain)
- Wire tx: `0xad7ee7dfca9740111fe40a703c5b0f71721243ef541af92a8417943a2a0f688c`

## Deploy Transactions
| Step | Tx Hash |
|---|---|
| ProviderRegistry deploy | `0x05cfa29acf3ff5e1e36ec7e6aaa26e2d3424a5da6c2547ceecdab1e79c49250e` |
| AgentTab deploy | `0xb8afca48fbba821bbad07e9283ac1a4e64bc051c80645c1c52d3b6cc13785fed` |
| setAgentTabContract | `0xad7ee7dfca9740111fe40a703c5b0f71721243ef541af92a8417943a2a0f688c` |

## Notes
- Both contracts deployed via Compass CREATE2 engine with Circle developer-controlled wallet custody.
- 95 Foundry tests passed before deploy; balanced security audit showed no findings.
- Test with: deposit 2 USDC, daily limit 1 USDC, max per payment 0.25 USDC, provider price 0.1 USDC.
