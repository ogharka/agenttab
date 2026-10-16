import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { LayoutDashboard, Store, Bot, Zap, Menu, X } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'

type Page = 'dashboard' | 'marketplace' | 'provider' | 'simulator'

interface LayoutProps {
  page: Page
  onNavigate: (page: Page) => void
  children: React.ReactNode
}

const nav = [
  { id: 'dashboard' as Page, label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'marketplace' as Page, label: 'Marketplace', Icon: Store },
  { id: 'provider' as Page, label: 'Provider', Icon: Zap },
  { id: 'simulator' as Page, label: 'Simulator', Icon: Bot },
]

export function Layout({ page, onNavigate, children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg-gradient)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(24px) saturate(200%)',
          WebkitBackdropFilter: 'blur(24px) saturate(200%)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 shrink-0"
          >
            <div
              className="size-8 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent)' }}
            >
              <TokenUSDC variant="branded" size={18} />
            </div>
            <span
              className="display text-base font-700 hidden sm:block"
              style={{ color: 'var(--ink)', letterSpacing: '-0.02em', fontWeight: 700 }}
            >
              AgentTab
            </span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {nav.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: page === id ? 'rgba(18,45,69,0.08)' : 'transparent',
                  color: page === id ? 'var(--ink)' : 'var(--muted)',
                }}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ConnectKitButton />
            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg"
              style={{ color: 'var(--muted)' }}
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div
            className="md:hidden border-t px-4 py-3 flex flex-col gap-1"
            style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.95)' }}
          >
            {nav.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => { onNavigate(id); setMobileOpen(false) }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all"
                style={{
                  background: page === id ? 'rgba(18,45,69,0.08)' : 'transparent',
                  color: page === id ? 'var(--ink)' : 'var(--muted)',
                }}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  )
}
