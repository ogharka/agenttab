/**
 * AgentTab contract config.
 * After deploying, update AGENT_TAB_ADDRESS and PROVIDER_REGISTRY_ADDRESS.
 * Built with Arc Studio — https://studio.arc.io
 */

// Arc mainnet — deployed 2026-10-16
export const AGENT_TAB_ADDRESS = '0x5ac7171a4fc73161FBAb4955E3aB57B89127b235' as `0x${string}`
export const PROVIDER_REGISTRY_ADDRESS = '0xdfB3A0ea416049d657791A2a0DfB6bDFf0dA71E6' as `0x${string}`

export const DEPLOYED = Boolean(AGENT_TAB_ADDRESS && PROVIDER_REGISTRY_ADDRESS)

export const ARC_MAINNET_USDC = '0x3600000000000000000000000000000000000000' as `0x${string}`

export const AGENT_TAB_ABI = [
  // Read
  {
    name: 'getAccount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'accountId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'agent', type: 'address' },
          { name: 'balance', type: 'uint256' },
          { name: 'dailyLimit', type: 'uint256' },
          { name: 'spentToday', type: 'uint256' },
          { name: 'dayWindowStart', type: 'uint256' },
          { name: 'maxPerPayment', type: 'uint256' },
          { name: 'paused', type: 'bool' },
          { name: 'exists', type: 'bool' },
          { name: 'allowlist', type: 'address[]' },
        ],
      },
    ],
  },
  {
    name: 'getOwnerAccounts',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'getAgentAccounts',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'getRemainingDailyLimit',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'accountId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'nextAccountId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Write
  {
    name: 'createAccount',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'depositAmount', type: 'uint256' },
      { name: 'dailyLimit', type: 'uint256' },
      { name: 'maxPerPayment', type: 'uint256' },
      { name: 'allowlist', type: 'address[]' },
    ],
    outputs: [],
  },
  {
    name: 'topUp',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'accountId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'accountId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'withdrawAll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'accountId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'updateLimits',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'accountId', type: 'uint256' },
      { name: 'dailyLimit', type: 'uint256' },
      { name: 'maxPerPayment', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'updateAllowlist',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'accountId', type: 'uint256' },
      { name: 'allowlist', type: 'address[]' },
    ],
    outputs: [],
  },
  {
    name: 'pause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'accountId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'unpause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'accountId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'closeAccount',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'accountId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'pay',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'accountId', type: 'uint256' },
      { name: 'provider', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'memo', type: 'string' },
    ],
    outputs: [],
  },
  // Events
  {
    name: 'AccountCreated',
    type: 'event',
    inputs: [
      { name: 'accountId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
      { name: 'depositAmount', type: 'uint256', indexed: false },
      { name: 'dailyLimit', type: 'uint256', indexed: false },
      { name: 'maxPerPayment', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'ToppedUp',
    type: 'event',
    inputs: [
      { name: 'accountId', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Paid',
    type: 'event',
    inputs: [
      { name: 'accountId', type: 'uint256', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
      { name: 'provider', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'memo', type: 'string', indexed: false },
    ],
  },
  {
    name: 'Withdrawn',
    type: 'event',
    inputs: [
      { name: 'accountId', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Paused',
    type: 'event',
    inputs: [{ name: 'accountId', type: 'uint256', indexed: true }],
  },
  {
    name: 'Unpaused',
    type: 'event',
    inputs: [{ name: 'accountId', type: 'uint256', indexed: true }],
  },
  {
    name: 'LimitsUpdated',
    type: 'event',
    inputs: [
      { name: 'accountId', type: 'uint256', indexed: true },
      { name: 'dailyLimit', type: 'uint256', indexed: false },
      { name: 'maxPerPayment', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'AccountClosed',
    type: 'event',
    inputs: [
      { name: 'accountId', type: 'uint256', indexed: true },
      { name: 'remainingBalance', type: 'uint256', indexed: false },
    ],
  },
] as const

export const PROVIDER_REGISTRY_ABI = [
  // Read
  {
    name: 'providers',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'provider', type: 'address' }],
    outputs: [
      { name: 'addr', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'pricePerCall', type: 'uint256' },
      { name: 'active', type: 'bool' },
      { name: 'totalEarned', type: 'uint256' },
    ],
  },
  {
    name: 'getProviders',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'isActive',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'provider', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'provider', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Write
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'pricePerCall', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'updatePrice',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newPrice', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'deactivate',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'activate',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  // Events
  {
    name: 'ProviderRegistered',
    type: 'event',
    inputs: [
      { name: 'provider', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'pricePerCall', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'ProviderPriceUpdated',
    type: 'event',
    inputs: [
      { name: 'provider', type: 'address', indexed: true },
      { name: 'newPrice', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'ProviderDeactivated',
    type: 'event',
    inputs: [{ name: 'provider', type: 'address', indexed: true }],
  },
  {
    name: 'ProviderActivated',
    type: 'event',
    inputs: [{ name: 'provider', type: 'address', indexed: true }],
  },
] as const
