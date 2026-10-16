import { useState } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi'
import { erc20Abi } from 'viem'
import { toast } from 'sonner'
import { Plus, Play, ArrowDownToLine, ArrowUpFromLine, Settings, PauseCircle, Users, Wallet, X, ExternalLink, Bot } from 'lucide-react'
import { AGENT_TAB_ABI, PROVIDER_REGISTRY_ABI, AGENT_TAB_ADDRESS, PROVIDER_REGISTRY_ADDRESS, ARC_MAINNET_USDC, DEPLOYED } from '../contracts'
import { formatAddress, formatUsdc, parseUsdc, parseOnchainError, arcExplorerTx } from '../utils'
import { NotDeployed } from './NotDeployed'
import { ARC_MAINNET_CHAIN_ID } from '../config'

interface AgentAccount {
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

// ---------- Small reusable components ----------

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${className}`}
      style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)', backdropFilter: 'blur(12px)' }}
    >
      {children}
    </div>
  )
}

function ProgressBar({ spent, limit }: { spent: bigint; limit: bigint }) {
  const pct = limit > 0n ? Math.min(100, (Number(spent) / Number(limit)) * 100) : 0
  const color = pct >= 90 ? 'var(--danger)' : pct >= 70 ? '#d97706' : 'var(--success)'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--muted)' }}>
        <span>Spent today</span>
        <span className="tabular-nums">{formatUsdc(spent)} / {formatUsdc(limit)} USDC</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

// ---------- Account card ----------

function AccountCard({
  accountId,
  chainId,
  onRefresh,
}: {
  accountId: bigint
  chainId: number | undefined
  onRefresh: () => void
}) {
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const [showActions, setShowActions] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [newDailyLimit, setNewDailyLimit] = useState('')
  const [newMaxPer, setNewMaxPer] = useState('')
  const [actionMode, setActionMode] = useState<'topup' | 'withdraw' | 'limits' | null>(null)

  const { data: account } = useReadContract({
    address: AGENT_TAB_ADDRESS,
    abi: AGENT_TAB_ABI,
    functionName: 'getAccount',
    args: [accountId],
    chainId: ARC_MAINNET_CHAIN_ID,
  }) as { data: AgentAccount | undefined }

  const { writeContract: approveWrite, data: approveHash, isPending: approvePending } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  if (!account) {
    return (
      <div className="rounded-2xl border p-5 animate-pulse" style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}>
        <div className="h-4 rounded w-32 mb-3" style={{ background: 'var(--border)' }} />
        <div className="h-8 rounded w-24" style={{ background: 'var(--border)' }} />
      </div>
    )
  }

  const wrongChain = chainId !== ARC_MAINNET_CHAIN_ID

  function handlePause() {
    if (wrongChain) return
    try {
      writeContract({ address: AGENT_TAB_ADDRESS, abi: AGENT_TAB_ABI, functionName: account!.paused ? 'unpause' : 'pause', args: [accountId] })
      toast.success(account!.paused ? 'Account unpaused' : 'Account paused')
      onRefresh()
    } catch (e) { toast.error(parseOnchainError(e)) }
  }

  function handleTopUp() {
    const amt = parseUsdc(topUpAmount)
    if (amt === 0n) return
    try {
      approveWrite({ address: ARC_MAINNET_USDC, abi: erc20Abi, functionName: 'approve', args: [AGENT_TAB_ADDRESS, amt] })
    } catch (e) { toast.error(parseOnchainError(e)) }
  }

  if (approveSuccess && topUpAmount) {
    const amt = parseUsdc(topUpAmount)
    writeContract({ address: AGENT_TAB_ADDRESS, abi: AGENT_TAB_ABI, functionName: 'topUp', args: [accountId, amt] })
  }

  function handleWithdraw(all = false) {
    try {
      if (all) {
        writeContract({ address: AGENT_TAB_ADDRESS, abi: AGENT_TAB_ABI, functionName: 'withdrawAll', args: [accountId] })
      } else {
        const amt = parseUsdc(withdrawAmount)
        if (amt === 0n) return
        writeContract({ address: AGENT_TAB_ADDRESS, abi: AGENT_TAB_ABI, functionName: 'withdraw', args: [accountId, amt] })
      }
      toast.success('Withdrawal initiated')
      onRefresh()
    } catch (e) { toast.error(parseOnchainError(e)) }
  }

  function handleUpdateLimits() {
    const daily = parseUsdc(newDailyLimit)
    const perTx = parseUsdc(newMaxPer)
    if (daily === 0n || perTx === 0n) return
    try {
      writeContract({ address: AGENT_TAB_ADDRESS, abi: AGENT_TAB_ABI, functionName: 'updateLimits', args: [accountId, daily, perTx] })
      toast.success('Limits updated')
      onRefresh()
    } catch (e) { toast.error(parseOnchainError(e)) }
  }

  return (
    <Card className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--muted)', letterSpacing: '0.07em' }}>
              Account #{accountId.toString()}
            </span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: account.paused ? 'rgba(186,43,76,0.1)' : 'rgba(26,128,71,0.1)',
                color: account.paused ? 'var(--danger)' : 'var(--success)',
              }}
            >
              {account.paused ? 'Paused' : 'Active'}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="display text-3xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {formatUsdc(account.balance)}
            </span>
            <span className="text-base font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
          </div>
        </div>

        {/* Pause button */}
        <button
          onClick={handlePause}
          disabled={isPending || isConfirming || wrongChain}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
          style={{
            background: account.paused ? 'rgba(26,128,71,0.12)' : 'rgba(186,43,76,0.10)',
            color: account.paused ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {account.paused ? <Play className="size-3.5" /> : <PauseCircle className="size-3.5" />}
          {account.paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* Agent / daily limit info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3" style={{ background: 'var(--surface-muted)' }}>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>Agent</p>
          <p className="mono text-xs font-medium mt-0.5" style={{ color: 'var(--ink-2)' }}>
            {formatAddress(account.agent)}
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--surface-muted)' }}>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>Max / tx</p>
          <p className="tabular-nums text-sm font-semibold mt-0.5" style={{ color: 'var(--ink-2)' }}>
            {formatUsdc(account.maxPerPayment)} USDC
          </p>
        </div>
      </div>

      {/* Spending progress */}
      <ProgressBar spent={account.spentToday} limit={account.dailyLimit} />

      {/* Allowlist badge */}
      {account.allowlist.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
          <Users className="size-3" />
          <span>{account.allowlist.length} provider{account.allowlist.length !== 1 ? 's' : ''} allowlisted</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { setActionMode('topup'); setShowActions(true) }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(18,45,69,0.08)', color: 'var(--ink)' }}
        >
          <ArrowDownToLine className="size-3" /> Top Up
        </button>
        <button
          onClick={() => { setActionMode('withdraw'); setShowActions(true) }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(18,45,69,0.08)', color: 'var(--ink)' }}
        >
          <ArrowUpFromLine className="size-3" /> Withdraw
        </button>
        <button
          onClick={() => { setActionMode('limits'); setShowActions(true) }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(18,45,69,0.08)', color: 'var(--ink)' }}
        >
          <Settings className="size-3" /> Limits
        </button>
      </div>

      {/* Inline action panel */}
      {showActions && (
        <div className="rounded-xl p-4 border" style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {actionMode === 'topup' ? 'Top Up' : actionMode === 'withdraw' ? 'Withdraw' : 'Edit Limits'}
            </span>
            <button onClick={() => setShowActions(false)} style={{ color: 'var(--muted)' }}>
              <X className="size-4" />
            </button>
          </div>

          {actionMode === 'topup' && (
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Amount USDC"
                value={topUpAmount}
                onChange={e => setTopUpAmount(e.target.value)}
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none border"
                style={{ background: 'white', borderColor: 'var(--border)', color: 'var(--ink)' }}
              />
              <button
                onClick={handleTopUp}
                disabled={approvePending || approveConfirming || isPending || isConfirming || wrongChain}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all hover:scale-105"
                style={{ background: 'var(--accent)' }}
              >
                {approvePending || approveConfirming ? 'Approving…' : isPending || isConfirming ? 'Sending…' : 'Top Up'}
              </button>
            </div>
          )}

          {actionMode === 'withdraw' && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Amount USDC"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  className="flex-1 rounded-xl px-3 py-2 text-sm outline-none border"
                  style={{ background: 'white', borderColor: 'var(--border)', color: 'var(--ink)' }}
                />
                <button
                  onClick={() => handleWithdraw(false)}
                  disabled={isPending || isConfirming || wrongChain}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: 'var(--accent)' }}
                >
                  {isPending || isConfirming ? '…' : 'Withdraw'}
                </button>
              </div>
              <button
                onClick={() => handleWithdraw(true)}
                disabled={isPending || isConfirming || wrongChain}
                className="text-xs font-medium disabled:opacity-40"
                style={{ color: 'var(--muted)' }}
              >
                Withdraw all ({formatUsdc(account.balance)} USDC)
              </button>
            </div>
          )}

          {actionMode === 'limits' && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder={`Daily limit (now ${formatUsdc(account.dailyLimit)})`}
                  value={newDailyLimit}
                  onChange={e => setNewDailyLimit(e.target.value)}
                  className="flex-1 rounded-xl px-3 py-2 text-sm outline-none border"
                  style={{ background: 'white', borderColor: 'var(--border)', color: 'var(--ink)' }}
                />
                <input
                  type="number"
                  placeholder={`Max/tx (now ${formatUsdc(account.maxPerPayment)})`}
                  value={newMaxPer}
                  onChange={e => setNewMaxPer(e.target.value)}
                  className="flex-1 rounded-xl px-3 py-2 text-sm outline-none border"
                  style={{ background: 'white', borderColor: 'var(--border)', color: 'var(--ink)' }}
                />
              </div>
              <button
                onClick={handleUpdateLimits}
                disabled={isPending || isConfirming || wrongChain}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: 'var(--accent)' }}
              >
                {isPending || isConfirming ? 'Saving…' : 'Save Limits'}
              </button>
            </div>
          )}

          {isSuccess && hash && (
            <a
              href={arcExplorerTx(hash)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs mt-2"
              style={{ color: 'var(--accent-hover)' }}
            >
              View on explorer <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      )}
    </Card>
  )
}

// ---------- Create account sheet ----------

function CreateAccountModal({
  onClose,
  onCreated,
  chainId,
  providers,
}: {
  onClose: () => void
  onCreated: () => void
  chainId: number | undefined
  providers: readonly `0x${string}`[]
}) {
  const [agent, setAgent] = useState('')
  const [deposit, setDeposit] = useState('')
  const [dailyLimit, setDailyLimit] = useState('')
  const [maxPer, setMaxPer] = useState('')
  const [allowlist, setAllowlist] = useState<string[]>([])
  const [step, setStep] = useState<'approve' | 'create'>('approve')

  const { writeContract: approveWrite, data: approveHash, isPending: approvePending } = useWriteContract()
  const { isLoading: approveLoading, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  const { writeContract: createWrite, data: createHash, isPending: createPending } = useWriteContract()
  const { isLoading: createLoading, isSuccess: createSuccess } = useWaitForTransactionReceipt({ hash: createHash })

  const wrongChain = chainId !== ARC_MAINNET_CHAIN_ID
  const { data: providerInfoList } = useReadContract({
    address: PROVIDER_REGISTRY_ADDRESS,
    abi: PROVIDER_REGISTRY_ABI,
    functionName: 'getProviders',
    chainId: ARC_MAINNET_CHAIN_ID,
  }) as { data: readonly `0x${string}`[] | undefined }

  function handleApprove() {
    const amt = parseUsdc(deposit)
    if (amt === 0n) return
    approveWrite({ address: ARC_MAINNET_USDC, abi: erc20Abi, functionName: 'approve', args: [AGENT_TAB_ADDRESS, amt] })
    setStep('create')
  }

  function handleCreate() {
    const amt = parseUsdc(deposit)
    const daily = parseUsdc(dailyLimit)
    const perTx = parseUsdc(maxPer)
    if (!agent || amt === 0n || daily === 0n || perTx === 0n) return
    createWrite({
      address: AGENT_TAB_ADDRESS,
      abi: AGENT_TAB_ABI,
      functionName: 'createAccount',
      args: [agent as `0x${string}`, amt, daily, perTx, allowlist as `0x${string}`[]],
    })
  }

  if (createSuccess) {
    toast.success('Agent account created!')
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(40px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Spectral strip */}
        <div className="h-1" style={{ background: 'linear-gradient(90deg,#acc6e9,#c4b5fd,#acc6e9)' }} />
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full" style={{ background: 'var(--border-strong)' }} />
        </div>
        <div className="px-6 pb-8 pt-4">
          <div className="flex items-center justify-between mb-5">
            <h2 className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>
              Create Agent Account
            </h2>
            <button onClick={onClose} style={{ color: 'var(--muted)' }}>
              <X className="size-5" />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--muted)' }}>
                Agent wallet address
              </label>
              <input
                placeholder="0x..."
                value={agent}
                onChange={e => setAgent(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none mono"
                style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'white' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--muted)' }}>
                  Deposit (USDC)
                </label>
                <input
                  type="number"
                  placeholder="2.00"
                  value={deposit}
                  onChange={e => setDeposit(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none tabular-nums"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'white' }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--muted)' }}>
                  Daily limit (USDC)
                </label>
                <input
                  type="number"
                  placeholder="1.00"
                  value={dailyLimit}
                  onChange={e => setDailyLimit(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none tabular-nums"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'white' }}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--muted)' }}>
                Max per payment (USDC)
              </label>
              <input
                type="number"
                placeholder="0.25"
                value={maxPer}
                onChange={e => setMaxPer(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none tabular-nums"
                style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'white' }}
              />
            </div>

            {/* Provider allowlist */}
            {(providerInfoList ?? providers).length > 0 && (
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--muted)' }}>
                  Provider allowlist (optional — leave empty to allow all)
                </label>
                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                  {(providerInfoList ?? providers).map((addr) => (
                    <label key={addr} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowlist.includes(addr)}
                        onChange={e => {
                          if (e.target.checked) setAllowlist(a => [...a, addr])
                          else setAllowlist(a => a.filter(x => x !== addr))
                        }}
                        className="rounded"
                      />
                      <span className="mono" style={{ color: 'var(--ink-2)' }}>{formatAddress(addr)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {wrongChain && (
              <p className="text-xs" style={{ color: 'var(--danger)' }}>
                Switch your wallet to Arc mainnet first.
              </p>
            )}

            {/* Step 1: Approve */}
            {step === 'approve' || !approveSuccess ? (
              <button
                onClick={handleApprove}
                disabled={approvePending || approveLoading || wrongChain || !deposit}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
                style={{ background: 'var(--accent)' }}
              >
                {approvePending ? 'Confirm in wallet…' : approveLoading ? 'Approving USDC…' : 'Step 1: Approve USDC'}
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={createPending || createLoading || wrongChain || !agent || !deposit || !dailyLimit || !maxPer}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
                style={{ background: 'var(--accent)' }}
              >
                {createPending ? 'Confirm in wallet…' : createLoading ? 'Creating account…' : 'Step 2: Create Account'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Payment feed ----------

function PaymentFeed({ accountIds: _accountIds }: { accountIds: bigint[] }) {
  const { data: logs } = useReadContract({
    address: AGENT_TAB_ADDRESS,
    abi: AGENT_TAB_ABI,
    functionName: 'nextAccountId',
    chainId: ARC_MAINNET_CHAIN_ID,
  })

  // Feed is best-effort from viem getLogs via wagmi useWatchContractEvent
  // For simplicity, show a static instruction card; full event feed requires a live provider
  return (
    <div>
      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>
        Payment Feed
      </h3>
      <div
        className="rounded-xl p-4 text-sm"
        style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}
      >
        <p>Live payments appear in the Tracing panel as your agent sends transactions.</p>
        <p className="mt-1">
          Total accounts: <span className="tabular-nums font-semibold" style={{ color: 'var(--ink)' }}>
            {logs?.toString() ?? '…'}
          </span>
        </p>
      </div>
    </div>
  )
}

// ---------- Dashboard page ----------

export function Dashboard() {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const [showCreate, setShowCreate] = useState(false)
  const [_refresh2, setRefresh] = useState(0)

  const { data: accountIds } = useReadContract({
    address: AGENT_TAB_ADDRESS,
    abi: AGENT_TAB_ABI,
    functionName: 'getOwnerAccounts',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: ARC_MAINNET_CHAIN_ID,
    query: { enabled: Boolean(address && DEPLOYED) },
  }) as { data: readonly bigint[] | undefined }

  const { data: providerAddrs } = useReadContract({
    address: PROVIDER_REGISTRY_ADDRESS,
    abi: PROVIDER_REGISTRY_ABI,
    functionName: 'getProviders',
    chainId: ARC_MAINNET_CHAIN_ID,
    query: { enabled: DEPLOYED },
  }) as { data: readonly `0x${string}`[] | undefined }

  const wrongChain = isConnected && chainId !== ARC_MAINNET_CHAIN_ID

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>
            Owner Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
            Fund and manage AI agent spending accounts
          </p>
        </div>
        {isConnected && (
          <button
            onClick={() => setShowCreate(true)}
            disabled={!DEPLOYED || wrongChain}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            <Plus className="size-4" /> New Account
          </button>
        )}
      </div>

      {!DEPLOYED && <NotDeployed />}

      {wrongChain && (
        <div
          className="rounded-2xl p-4 border flex items-center justify-between"
          style={{ background: 'rgba(186,43,76,0.06)', borderColor: 'rgba(186,43,76,0.2)' }}
        >
          <span className="text-sm font-medium" style={{ color: 'var(--danger)' }}>
            Switch to Arc mainnet to continue
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

      {!isConnected && (
        <div
          className="rounded-2xl p-6 border text-center"
          style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}
        >
          <Wallet className="size-8 mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
            Connect your wallet to see your agent accounts
          </p>
        </div>
      )}

      {isConnected && DEPLOYED && (
        <>
          {/* Account cards */}
          {accountIds && accountIds.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[...accountIds].map((id) => (
                <AccountCard
                  key={id.toString()}
                  accountId={id}
                  chainId={chainId}
                  onRefresh={() => setRefresh(r => r + 1)}
                />
              ))}
            </div>
          ) : (
            <div
              className="rounded-2xl border p-8 text-center"
              style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}
            >
              <Bot className="size-10 mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                No agent accounts yet
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Create one to give an AI agent a USDC budget
              </p>
            </div>
          )}

          {accountIds && accountIds.length > 0 && (
            <PaymentFeed accountIds={[...accountIds]} />
          )}
        </>
      )}

      {showCreate && (
        <CreateAccountModal
          onClose={() => setShowCreate(false)}
          onCreated={() => setRefresh(r => r + 1)}
          chainId={chainId}
          providers={providerAddrs ?? []}
        />
      )}
    </div>
  )
}

