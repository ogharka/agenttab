import { useState } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi'
import { toast } from 'sonner'
import { Bot, CheckCircle2, XCircle, ExternalLink, Wallet, AlertTriangle } from 'lucide-react'
import { AGENT_TAB_ABI, PROVIDER_REGISTRY_ABI, AGENT_TAB_ADDRESS, PROVIDER_REGISTRY_ADDRESS, DEPLOYED } from '../contracts'
import { formatUsdc, parseUsdc, formatAddress, arcExplorerTx, parseOnchainError } from '../utils'
import { NotDeployed } from './NotDeployed'
import { ARC_MAINNET_CHAIN_ID } from '../config'

interface SimResult {
  success: boolean
  message: string
  hash?: string
}

export function Simulator() {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const [accountId, setAccountId] = useState('')
  const [providerAddr, setProviderAddr] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [result, setResult] = useState<SimResult | null>(null)

  const wrongChain = isConnected && chainId !== ARC_MAINNET_CHAIN_ID

  // Load agent's accounts
  const { data: agentAccountIds } = useReadContract({
    address: AGENT_TAB_ADDRESS,
    abi: AGENT_TAB_ABI,
    functionName: 'getAgentAccounts',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: ARC_MAINNET_CHAIN_ID,
    query: { enabled: Boolean(address && DEPLOYED) },
  }) as { data: readonly bigint[] | undefined }

  // Load selected account info
  const accountIdBig = accountId ? BigInt(accountId) : undefined
  const { data: accountData } = useReadContract({
    address: AGENT_TAB_ADDRESS,
    abi: AGENT_TAB_ABI,
    functionName: 'getAccount',
    args: [accountIdBig ?? 0n],
    chainId: ARC_MAINNET_CHAIN_ID,
    query: { enabled: Boolean(accountIdBig !== undefined && DEPLOYED) },
  }) as {
    data:
      | {
          owner: `0x${string}`
          agent: `0x${string}`
          balance: bigint
          dailyLimit: bigint
          spentToday: bigint
          dayWindowStart: bigint
          maxPerPayment: bigint
          paused: boolean
          exists: boolean
          allowlist: readonly `0x${string}`[]
        }
      | undefined
  }

  const { data: remainingLimit } = useReadContract({
    address: AGENT_TAB_ADDRESS,
    abi: AGENT_TAB_ABI,
    functionName: 'getRemainingDailyLimit',
    args: [accountIdBig ?? 0n],
    chainId: ARC_MAINNET_CHAIN_ID,
    query: { enabled: Boolean(accountIdBig !== undefined && DEPLOYED) },
  }) as { data: bigint | undefined }

  // Load providers
  const { data: providerAddrs } = useReadContract({
    address: PROVIDER_REGISTRY_ADDRESS,
    abi: PROVIDER_REGISTRY_ABI,
    functionName: 'getProviders',
    chainId: ARC_MAINNET_CHAIN_ID,
    query: { enabled: DEPLOYED },
  }) as { data: readonly `0x${string}`[] | undefined }

  // Provider info for selected provider
  const { data: selectedProviderData } = useReadContract({
    address: PROVIDER_REGISTRY_ADDRESS,
    abi: PROVIDER_REGISTRY_ABI,
    functionName: 'providers',
    args: [providerAddr as `0x${string}`],
    chainId: ARC_MAINNET_CHAIN_ID,
    query: { enabled: Boolean(providerAddr && providerAddr.startsWith('0x') && DEPLOYED) },
  }) as { data: [string, string, string, bigint, boolean, bigint] | undefined }

  const { writeContract: payWrite, data: payHash, isPending: payPending } = useWriteContract()
  const { isLoading: payLoading, isSuccess: paySuccess } = useWaitForTransactionReceipt({ hash: payHash })

  if (paySuccess && payHash && !result) {
    setResult({ success: true, message: 'Payment sent successfully!', hash: payHash })
    toast.success('Payment confirmed onchain')
  }

  // Pre-flight check
  function preflightCheck(): string | null {
    if (!accountData) return 'Account not found'
    if (accountData.paused) return 'Account is paused'
    const amt = parseUsdc(amount)
    if (amt === 0n) return 'Enter a valid amount'
    if (amt > accountData.maxPerPayment) return `Exceeds per-payment cap (max ${formatUsdc(accountData.maxPerPayment)} USDC)`
    if (remainingLimit !== undefined && amt > remainingLimit) return `Exceeds daily limit (${formatUsdc(remainingLimit ?? 0n)} USDC remaining)`
    if (amt > accountData.balance) return `Insufficient balance (${formatUsdc(accountData.balance)} USDC available)`
    if (!selectedProviderData?.[4]) return 'Provider is not active'
    if (accountData.allowlist.length > 0 && !accountData.allowlist.includes(providerAddr as `0x${string}`)) {
      return 'Provider not in account allowlist'
    }
    return null
  }

  function handlePay() {
    setResult(null)
    const check = preflightCheck()
    if (check) {
      setResult({ success: false, message: check })
      return
    }
    const amt = parseUsdc(amount)
    try {
      payWrite({
        address: AGENT_TAB_ADDRESS,
        abi: AGENT_TAB_ABI,
        functionName: 'pay',
        args: [accountIdBig!, providerAddr as `0x${string}`, amt, memo],
      })
    } catch (e) {
      setResult({ success: false, message: parseOnchainError(e) })
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>
          Agent Simulator
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          Act as an agent wallet and test payments — see exactly why a payment succeeds or fails
        </p>
      </div>

      {!DEPLOYED && <NotDeployed />}

      {!isConnected && (
        <div
          className="rounded-2xl p-6 border text-center"
          style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}
        >
          <Wallet className="size-8 mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
            Connect the agent wallet to simulate payments
          </p>
        </div>
      )}

      {wrongChain && (
        <div
          className="rounded-2xl p-4 border flex items-center justify-between"
          style={{ background: 'rgba(186,43,76,0.06)', borderColor: 'rgba(186,43,76,0.2)' }}
        >
          <span className="text-sm font-medium" style={{ color: 'var(--danger)' }}>
            Switch to Arc mainnet
          </span>
          <button
            onClick={() => switchChain({ chainId: ARC_MAINNET_CHAIN_ID })}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            Switch Network
          </button>
        </div>
      )}

      {isConnected && DEPLOYED && (
        <>
          {/* Agent identity */}
          <div
            className="rounded-2xl border p-4 flex items-center gap-3"
            style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}
          >
            <div
              className="size-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(18,45,69,0.08)' }}
            >
              <Bot className="size-5" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Acting as agent</p>
              <p className="mono text-sm font-medium" style={{ color: 'var(--ink)' }}>{address ? formatAddress(address) : '—'}</p>
            </div>
          </div>

          {/* Form */}
          <div
            className="rounded-2xl border p-5 flex flex-col gap-4"
            style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}
          >
            {/* Account selection */}
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--muted)' }}>
                Account ID
              </label>
              {agentAccountIds && agentAccountIds.length > 0 ? (
                <select
                  value={accountId}
                  onChange={e => { setAccountId(e.target.value); setResult(null) }}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'white' }}
                >
                  <option value="">Select an account…</option>
                  {agentAccountIds.map(id => (
                    <option key={id.toString()} value={id.toString()}>Account #{id.toString()}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  placeholder="e.g. 0"
                  value={accountId}
                  onChange={e => { setAccountId(e.target.value); setResult(null) }}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none tabular-nums"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'white' }}
                />
              )}
            </div>

            {/* Account status snapshot */}
            {accountData && accountId && (
              <div
                className="rounded-xl p-3 grid grid-cols-3 gap-2"
                style={{ background: 'var(--surface-muted)' }}
              >
                <div>
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>Balance</p>
                  <p className="tabular-nums text-xs font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                    {formatUsdc(accountData.balance)} USDC
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>Remaining daily</p>
                  <p className="tabular-nums text-xs font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                    {formatUsdc(remainingLimit ?? 0n)} USDC
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>Max/tx</p>
                  <p className="tabular-nums text-xs font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                    {formatUsdc(accountData.maxPerPayment)} USDC
                  </p>
                </div>
                {accountData.paused && (
                  <div className="col-span-3 flex items-center gap-1.5 mt-1">
                    <AlertTriangle className="size-3.5" style={{ color: 'var(--danger)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
                      Account is paused
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Provider selection */}
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--muted)' }}>
                Provider
              </label>
              {providerAddrs && providerAddrs.length > 0 ? (
                <select
                  value={providerAddr}
                  onChange={e => { setProviderAddr(e.target.value); setResult(null) }}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'white' }}
                >
                  <option value="">Select a provider…</option>
                  {providerAddrs.map(addr => (
                    <option key={addr} value={addr}>{formatAddress(addr)}</option>
                  ))}
                </select>
              ) : (
                <input
                  placeholder="0x..."
                  value={providerAddr}
                  onChange={e => { setProviderAddr(e.target.value); setResult(null) }}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none mono"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'white' }}
                />
              )}
              {selectedProviderData && (
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  {selectedProviderData[1]} — suggested price:{' '}
                  <button
                    className="font-semibold underline"
                    style={{ color: 'var(--accent-hover)' }}
                    onClick={() => setAmount((Number(selectedProviderData[3]) / 1_000_000).toString())}
                  >
                    {formatUsdc(selectedProviderData[3])} USDC
                  </button>
                </p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--muted)' }}>
                Amount (USDC)
              </label>
              <input
                type="number"
                placeholder="0.10"
                value={amount}
                onChange={e => { setAmount(e.target.value); setResult(null) }}
                className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none tabular-nums"
                style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'white' }}
              />
            </div>

            {/* Memo */}
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--muted)' }}>
                Memo (optional)
              </label>
              <input
                placeholder="e.g. search query for user request #42"
                value={memo}
                onChange={e => setMemo(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none"
                style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'white' }}
              />
            </div>

            <button
              onClick={handlePay}
              disabled={payPending || payLoading || wrongChain || !accountId || !providerAddr || !amount}
              className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
              style={{ background: 'var(--accent)' }}
            >
              {payPending ? 'Confirm in wallet…' : payLoading ? 'Confirming…' : 'Send Payment'}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div
              className="rounded-2xl border p-5 flex gap-3"
              style={{
                background: result.success ? 'rgba(26,128,71,0.06)' : 'rgba(186,43,76,0.06)',
                borderColor: result.success ? 'rgba(26,128,71,0.2)' : 'rgba(186,43,76,0.2)',
              }}
            >
              {result.success ? (
                <CheckCircle2 className="size-5 shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
              ) : (
                <XCircle className="size-5 shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
              )}
              <div>
                <p className="text-sm font-semibold" style={{ color: result.success ? 'var(--success)' : 'var(--danger)' }}>
                  {result.success ? 'Payment Successful' : 'Payment Blocked'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ink-2)' }}>
                  {result.message}
                </p>
                {result.hash && (
                  <a
                    href={arcExplorerTx(result.hash)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs mt-2"
                    style={{ color: 'var(--accent-hover)' }}
                  >
                    View on explorer.arc.io <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
