import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import Logo from './Logo'
import { getRoleLabel } from '../lib/permissions'
import type { ModuleKey } from '../lib/supabase'

type NavDef = { to?: string; label: string; module: ModuleKey; disabled?: boolean }

const NAV_ITEMS: NavDef[] = [
  { to: '/dashboard', label: 'Dashboard', module: 'dashboard' },
  { to: '/ventas', label: 'Ventas', module: 'ventas' },
  { to: '/compras', label: 'Compras', module: 'compras' },
  { to: '/gastos', label: 'Gastos', module: 'gastos' },
  { to: '/inventario', label: 'Inventario', module: 'inventario' },
  { to: '/clientes-proveedores', label: 'Clientes y Proveedores', module: 'clientes_proveedores' },
  { to: '/usuarios', label: 'Usuarios', module: 'usuarios' },
  { to: '/configuracion', label: 'Configuración', module: 'configuracion' },
  { label: 'Reportes', module: 'reportes', disabled: true },
  { label: 'Módulo IA', module: 'reportes', disabled: true },
]

export default function AppShell({ children }: { children: ReactNode }) {
  const { business, user, membership, role, signOut, canAccess } = useAuth()
  const items = NAV_ITEMS.filter((n) => n.disabled || canAccess(n.module))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: '100vh' }}>
      <aside
        style={{
          background: '#1C2A38',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <Logo />
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {items.map((n) => (
            <NavItem key={n.label} to={n.to} label={n.label} disabled={n.disabled} />
          ))}
        </nav>
        <div style={{ marginTop: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
          <div style={{ fontWeight: 600, color: '#fff' }}>{business?.name}</div>
          <div>{user?.email}</div>
          {role && (
            <div style={{ marginTop: 4, display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: '#22D0F7', background: 'rgba(34,208,247,0.12)', border: '1px solid rgba(34,208,247,0.25)' }}>
              {getRoleLabel(role)}
            </div>
          )}
          <button className="btn btn-ghost" style={{ marginTop: 10, width: '100%', color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.15)' }} onClick={() => signOut()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main style={{ padding: '28px 32px', overflowY: 'auto' }}>{children}</main>
    </div>
  )
}

function NavItem({ to, label, disabled }: { to?: string; label: string; disabled?: boolean }) {
  const loc = useLocation()
  const active = to && loc.pathname.startsWith(to)
  const style: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: 8,
    fontSize: 14,
    color: disabled ? 'rgba(255,255,255,0.3)' : active ? '#22D0F7' : 'rgba(255,255,255,0.65)',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'default' : 'pointer',
    background: active ? 'rgba(34,208,247,0.12)' : 'transparent',
    border: active ? '1px solid rgba(34,208,247,0.25)' : '1px solid transparent',
    fontWeight: active ? 600 : 500,
  }
  if (disabled) return <div style={style} title="Próximamente">{label}</div>
  return <Link to={to!} style={style}>{label}</Link>
}
