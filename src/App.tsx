import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Landing from './pages/Landing'
import AuthPage from './pages/AuthPage'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import AppShell from './components/AppShell'
import SalesModule from './pages/SalesModule'
import PurchasesModule from './pages/PurchasesModule'
import ExpensesModule from './pages/ExpensesModule'
import InventoryModule from './pages/InventoryModule'
import ClientsSuppliersModule from './pages/ClientsSuppliersModule'
import type { ModuleKey } from './lib/supabase'

function Guard({ module, children }: { module: ModuleKey; children: React.ReactNode }) {
  const { canAccess } = useAuth()
  if (!canAccess(module)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function Protected() {
  const { user, business, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/auth" replace />
  if (!business) return <Navigate to="/onboarding" replace />
  return (
    <AppShell>
      <Routes>
        <Route path="/dashboard" element={<Guard module="dashboard"><Dashboard /></Guard>} />
        <Route path="/ventas" element={<Guard module="ventas"><SalesModule /></Guard>} />
        <Route path="/compras" element={<Guard module="compras"><PurchasesModule /></Guard>} />
        <Route path="/gastos" element={<Guard module="gastos"><ExpensesModule /></Guard>} />
        <Route path="/inventario" element={<Guard module="inventario"><InventoryModule /></Guard>} />
        <Route path="/clientes-proveedores" element={<Guard module="clientes_proveedores"><ClientsSuppliersModule /></Guard>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  )
}

function OnboardingGate() {
  const { user, business, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/auth" replace />
  if (business) return <Navigate to="/dashboard" replace />
  return <Onboarding />
}

function Public() {
  const { user, business, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (user && business) return <Navigate to="/dashboard" replace />
  if (user && !business) return <Navigate to="/onboarding" replace />
  return <Landing />
}

function FullScreenLoader() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="logo-mark" style={{ margin: '0 auto 16px' }}>P</div>
        <p className="muted">Cargando PYMESV…</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Public />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/onboarding" element={<OnboardingGate />} />
        <Route path="/*" element={<Protected />} />
      </Routes>
    </AuthProvider>
  )
}
