import { useState } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi'
import { Zap, ExternalLink, Wallet } from 'lucide-react'
import { PROVIDER_REGISTRY_ABI, PROVIDER_REGISTRY_ADDRESS, DEPLOYED } from '../contracts'
import { formatUsdc, parseUsdc, arcExplorerTx } from '../utils'
import { NotDeployed } from './NotDeployed'
import { ARC_MAINNET_CHAIN_ID } from '../config'

export function Provider() {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [newPrice, setNewPrice] = useState('')

  const wrongChain = isConnected && chainId !== ARC_MAINNET_CHAIN_ID

  const { data: providerData, refetch } = useReadContract({
    address: PROVIDER_REGISTRY_ADDRESS,
    abi: PROVIDER_REGISTRY_ABI,
    functionName: 'providers',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: ARC_MAINNET_CHAIN_ID,
    query: { enabled: Boolean(address && DEPLOYED) },
  }) as { data: [string, string, string, bigint, boolean, bigint] | undefined; refetch: () => void }

  const isRegistered = providerData && providerData[0] !== '0x0000000000000000000000000000000000000000'
  const providerActive = providerData?.[4] ?? false
  const totalEarned = providerData?.[5] ?? 0n
  const currentPrice = providerData?.[3] ?? 0n
  const providerName = providerData?.[1] ?? ''

  const { writeContract: regWrite, data: regHash, isPending: regPending } = useWriteContract()
  const { isLoading: regLoading, isSuccess: regSuccess } = useWaitForTransactionReceipt({ hash: regHash })

  const { writeContract: priceWrite, data: priceHash, isPending: pricePending } = useWriteContract()
  const { isLoading: priceLoading, isSuccess: priceSuccess } = useWaitForTransactionReceipt({ hash: priceHash })

  const { writeContract: toggleWrite, data: toggleHash, isPending: togglePending } = useWriteContract()
  const { isLoading: toggleLoading, isSuccess: toggleSuccess } = useWaitForTransactionReceipt({ hash: toggleHash })

  if (regSuccess || priceSuccess || toggleSuccess) {
    refetch()
  }

  function handleRegister() {
    const p = parseUsdc(price)
    if (!name || p === 0n) return
    regWrite({
      address: PROVIDER_REGISTRY_ADDRESS,
      abi: PROVIDER_REGISTRY_ABI,
      functionName: 'register',
      args: [name, description, p],
    })
  }

  function handleUpdatePrice() {
    const p = parseUsdc(newPrice)
    if (p === 0n) return
    priceWrite({
      address: PROVIDER_REGISTRY_ADDRESS,
      abi: PROVIDER_REGISTRY_ABI,
      functionName: 'updatePrice',
      args: [p],
    })
  }

  function handleToggle() {
    toggleWrite({
      address: PROVIDER_REGISTRY_ADDRESS,
      abi: PROVIDER_REGISTRY_ABI,
      functionName: providerActive ? 'deactivate' : 'activate',
      args: [],
    })
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>
          Provider Portal
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          Register your service and accept USDC per-call payments
        </p>
      </div>

      {!DEPLOYED && <NotDeployed />}

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

      {!isConnected && (
        <div
          className="rounded-2xl p-6 border text-center"
          style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}
        >
          <Wallet className="size-8 mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
            Connect your wallet to register as a provider
          </p>
        </div>
      )}

      {isConnected && DEPLOYED && (
        <>
          {/* Stats card if registered */}
          {isRegistered && (
            <div
              className="rounded-2xl border p-5"
              style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--muted)', letterSpacing: '0.07em' }}>
                    Your Service
                  </span>
                  <h2 className="display text-xl font-bold mt-0.5" style={{ color: 'var(--ink)' }}>
                    {providerName}
                  </h2>
                </div>
                <div className="text-right">
                  <div className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                    {formatUsdc(totalEarned)}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--subtle)' }}>USDC earned</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl p-3" style={{ background: 'var(--surface-muted)' }}>
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>Price per call</p>
                  <p className="tabular-nums text-sm font-semibold mt-0.5" style={{ color: 'var(--ink-2)' }}>
                    {formatUsdc(currentPrice)} USDC
                  </p>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'var(--surface-muted)' }}>
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>Status</p>
                  <p
                    className="text-sm font-semibold mt-0.5"
                    style={{ color: providerActive ? 'var(--success)' : 'var(--danger)' }}
                  >
                    {providerActive ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>

              {/* Update price */}
              <div className="flex flex-col gap-2 mb-3">
                <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                  Update price (USDC)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder={`${formatUsdc(currentPrice)}`}
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    className="flex-1 rounded-xl px-3 py-2 text-sm border outline-none tabular-nums"
                    style={{ background: 'white', borderColor: 'var(--border)', color: 'var(--ink)' }}
                  />
                  <button
                    onClick={handleUpdatePrice}
                    disabled={pricePending || priceLoading || wrongChain}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: 'var(--accent)' }}
                  >
                    {pricePending || priceLoading ? '…' : 'Update'}
                  </button>
                </div>
                {priceSuccess && priceHash && (
                  <a href={arcExplorerTx(priceHash)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--accent-hover)' }}>
                    View <ExternalLink className="size-3" />
                  </a>
                )}
              </div>

              {/* Toggle active */}
              <button
                onClick={handleToggle}
                disabled={togglePending || toggleLoading || wrongChain}
                className="w-full py-2.5 rounded-2xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{
                  background: providerActive ? 'rgba(186,43,76,0.1)' : 'rgba(26,128,71,0.1)',
                  color: providerActive ? 'var(--danger)' : 'var(--success)',
                }}
              >
                {togglePending || toggleLoading ? '…' : providerActive ? 'Deactivate Service' : 'Activate Service'}
              </button>
            </div>
          )}

          {/* Registration form */}
          {!isRegistered && (
            <div
              className="rounded-2xl border p-5"
              style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Zap className="size-4" style={{ color: 'var(--accent)' }} />
                <h2 className="text-base font-bold" style={{ color: 'var(--ink)' }}>Register Service</h2>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--muted)' }}>
                    Service name
                  </label>
                  <input
                    placeholder="e.g. Web Search API"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'white' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--muted)' }}>
                    Description
                  </label>
                  <input
                    placeholder="What does your service do?"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'white' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--muted)' }}>
                    Price per call (USDC)
                  </label>
                  <input
                    type="number"
                    placeholder="0.10"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none tabular-nums"
                    style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'white' }}
                  />
                </div>

                {wrongChain && (
                  <p className="text-xs" style={{ color: 'var(--danger)' }}>
                    Switch to Arc mainnet first.
                  </p>
                )}

                <button
                  onClick={handleRegister}
                  disabled={regPending || regLoading || wrongChain || !name || !price}
                  className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
                  style={{ background: 'var(--accent)' }}
                >
                  {regPending ? 'Confirm in wallet…' : regLoading ? 'Registering…' : 'Register Service'}
                </button>

                {regSuccess && regHash && (
                  <a href={arcExplorerTx(regHash)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs mx-auto" style={{ color: 'var(--accent-hover)' }}>
                    View on explorer <ExternalLink className="size-3" />
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
