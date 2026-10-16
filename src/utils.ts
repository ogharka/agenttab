/**
 * Shared utilities for AgentTab
 */

export function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function formatUsdc(raw: bigint): string {
  const n = Number(raw) / 1_000_000
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

export function parseUsdc(val: string): bigint {
  const n = parseFloat(val)
  if (isNaN(n) || n < 0) return 0n
  return BigInt(Math.round(n * 1_000_000))
}

export function arcExplorerTx(hash: string): string {
  return `https://explorer.arc.io/tx/${hash}`
}

export function arcExplorerAddress(addr: string): string {
  return `https://explorer.arc.io/address/${addr}`
}

export function parseOnchainError(error: unknown): string {
  const msg = (error as { message?: string })?.message?.toLowerCase() ?? ''
  const shortMsg = (error as { shortMessage?: string })?.shortMessage ?? ''

  if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('4001')) {
    return 'Transaction cancelled.'
  }
  if (msg.includes('accountpaused') || shortMsg.includes('AccountPaused')) return 'Account is paused.'
  if (msg.includes('exceedsperpaymentcap') || shortMsg.includes('ExceedsPerPaymentCap')) return 'Exceeds per-payment cap.'
  if (msg.includes('exceedsdailylimit') || shortMsg.includes('ExceedsDailyLimit')) return 'Daily spending limit reached.'
  if (msg.includes('providernotallowlisted') || shortMsg.includes('ProviderNotAllowlisted')) return 'Provider not in allowlist.'
  if (msg.includes('providernotactive') || shortMsg.includes('ProviderNotActive')) return 'Provider is not active.'
  if (msg.includes('insufficientbalance') || shortMsg.includes('InsufficientBalance')) return 'Insufficient account balance.'
  if (msg.includes('notaccountagent') || shortMsg.includes('NotAccountAgent')) return 'You are not the authorized agent for this account.'
  if (msg.includes('notaccountowner') || shortMsg.includes('NotAccountOwner')) return 'Only the account owner can do this.'
  if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) return 'Insufficient USDC balance.'
  if (msg.includes('reverted')) {
    const match = msg.match(/reason="([^"]+)"/)
    return match ? `Failed: ${match[1]}` : 'Transaction failed.'
  }
  return 'Something went wrong. Please try again.'
}
