import { useReadContract } from 'wagmi'
import { Store, ExternalLink, Zap } from 'lucide-react'
import { PROVIDER_REGISTRY_ABI, PROVIDER_REGISTRY_ADDRESS, DEPLOYED } from '../contracts'
import { formatUsdc, arcExplorerAddress } from '../utils'
import { NotDeployed } from './NotDeployed'
import { ARC_MAINNET_CHAIN_ID } from '../config'

function ProviderCard({ address }: { address: `0x${string}` }) {
  const { data } = useReadContract({
    address: PROVIDER_REGISTRY_ADDRESS,
    abi: PROVIDER_REGISTRY_ABI,
    functionName: 'providers',
    args: [address],
    chainId: ARC_MAINNET_CHAIN_ID,
  }) as { data: [string, string, string, bigint, boolean, bigint] | undefined }

  if (!data) {
    return (
      <div
        className="rounded-2xl border p-5 animate-pulse"
        style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}
      >
        <div className="h-4 rounded w-40 mb-2" style={{ background: 'var(--border)' }} />
        <div className="h-3 rounded w-24" style={{ background: 'var(--border)' }} />
      </div>
    )
  }

  const [, name, description, pricePerCall, active, totalEarned] = data

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-3 transition-all hover:shadow-sm"
      style={{
        background: 'var(--surface-strong)',
        borderColor: active ? 'var(--border)' : 'rgba(186,43,76,0.2)',
        opacity: active ? 1 : 0.7,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{name}</span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: active ? 'rgba(26,128,71,0.1)' : 'rgba(186,43,76,0.1)',
                color: active ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{description}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="display text-xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {formatUsdc(pricePerCall)}
          </div>
          <div className="text-xs" style={{ color: 'var(--subtle)' }}>USDC / call</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
          Total earned: <span className="font-semibold" style={{ color: 'var(--ink-2)' }}>
            {formatUsdc(totalEarned)} USDC
          </span>
        </span>
        <a
          href={arcExplorerAddress(address)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs"
          style={{ color: 'var(--accent-hover)' }}
        >
          Explorer <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  )
}

export function Marketplace() {
  const { data: providerAddrs } = useReadContract({
    address: PROVIDER_REGISTRY_ADDRESS,
    abi: PROVIDER_REGISTRY_ABI,
    functionName: 'getProviders',
    chainId: ARC_MAINNET_CHAIN_ID,
    query: { enabled: DEPLOYED },
  }) as { data: readonly `0x${string}`[] | undefined }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>
          Provider Marketplace
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          Active services accepting USDC per-call payments
        </p>
      </div>

      {!DEPLOYED && <NotDeployed />}

      {DEPLOYED && (
        <>
          {!providerAddrs || providerAddrs.length === 0 ? (
            <div
              className="rounded-2xl border p-8 text-center"
              style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}
            >
              <Store className="size-10 mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                No providers registered yet
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Go to the Provider page to register your service
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {providerAddrs.map((addr) => (
                <ProviderCard key={addr} address={addr} />
              ))}
            </div>
          )}

          <div
            className="rounded-2xl border p-4 flex items-start gap-3"
            style={{ background: 'rgba(18,45,69,0.04)', borderColor: 'var(--border)' }}
          >
            <Zap className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Providers listed here accept USDC payments from agent accounts. Copy a provider address into your allowlist when creating an account to restrict your agent to specific services.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
