import { AlertTriangle } from 'lucide-react'

export function NotDeployed() {
  return (
    <div
      className="rounded-2xl p-6 border flex items-start gap-3"
      style={{ background: 'rgba(186,43,76,0.06)', borderColor: 'rgba(186,43,76,0.2)' }}
    >
      <AlertTriangle className="size-5 shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          Contracts not yet deployed
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
          Deploy <strong>ProviderRegistry</strong> and <strong>AgentTab</strong> to Arc mainnet, then update
          <code className="mono mx-1 px-1 rounded text-xs" style={{ background: 'rgba(18,45,69,0.08)' }}>
            src/contracts.ts
          </code>
          with both contract addresses. Follow the deployment guide at the bottom of the chat.
        </p>
      </div>
    </div>
  )
}
