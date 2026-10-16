import { useState } from 'react'
import { Layout } from './components/Layout'
import { Dashboard } from './components/Dashboard'
import { Marketplace } from './components/Marketplace'
import { Provider } from './components/Provider'
import { Simulator } from './components/Simulator'

type Page = 'dashboard' | 'marketplace' | 'provider' | 'simulator'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')

  return (
    <Layout page={page} onNavigate={setPage}>
      {page === 'dashboard' && <Dashboard />}
      {page === 'marketplace' && <Marketplace />}
      {page === 'provider' && <Provider />}
      {page === 'simulator' && <Simulator />}
    </Layout>
  )
}
