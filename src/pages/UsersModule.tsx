import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import {
  fetchBusinessUsers, createBusinessUser, updateBusinessUserRole, deleteBusinessUser,
  getRoleLabel, MODULE_LABELS, type UserWithAccess,
} from '../lib/users'
import { getAllRoles, getRoleDescription } from '../lib/permissions'
import type { Role } from '../lib/supabase'

export default function UsersModule() {
  const { business, canEdit } = useAuth()
  const [users, setUsers] = useState<UserWithAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const readOnly = !canEdit('usuarios')

  const load = () => {
    if (!business) return
    setLoading(true)
    fetchBusinessUsers(business.id).then(setUsers).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }
  useEffect(load, [business])

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span className="badge">Gestión de usuarios</span>
          <h1 style={{ fontSize: 26, marginTop: 8 }}>Usuarios y permisos</h1>
          <p className="muted" style={{ fontSize: 14 }}>Administra quién tiene acceso al sistema y qué módulos puede ver o editar.</p>
        </div>
        {!readOnly && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Añadir persona</button>
        )}
      </div>

      {readOnly && (
        <div className="card" style={{ padding: 14, marginBottom: 16, fontSize: 13, color: 'var(--text-dim)' }}>
          Tienes acceso de solo lectura a este módulo.
        </div>
      )}
      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
      {loading && <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>Cargando usuarios…</div>}

      {!loading && users.length === 0 && (
        <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>No hay usuarios registrados.</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {users.map((u) => (
          <UserCard key={u.id} user={u} readOnly={readOnly} onChanged={load} />
        ))}
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

function UserCard({ user, readOnly, onChanged }: { user: UserWithAccess; readOnly: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [selRole, setSelRole] = useState<Role>(user.role)
  const [busy, setBusy] = useState(false)

  const saveRole = async () => {
    setBusy(true)
    try {
      await updateBusinessUserRole(user.id, selRole)
      setEditing(false)
      onChanged()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  const status = user.auth_user_id ? 'Conectado' : 'Pendiente'
  const statusColor = user.auth_user_id ? 'var(--success)' : 'var(--warning)'

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', background: 'rgba(34,208,247,0.15)', color: '#2198C1',
          display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 700,
        }}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{user.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{user.email}</div>
        </div>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, color: statusColor, background: statusColor === 'var(--success)' ? 'rgba(22,163,74,0.12)' : 'rgba(245,158,11,0.12)', border: `1px solid ${statusColor}33` }}>
          {status}
        </span>
      </div>

      <div style={{ marginBottom: 14 }}>
        {editing ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1, margin: 0 }}>
              <label>Rol</label>
              <select value={selRole} onChange={(e) => setSelRole(e.target.value as Role)}>
                {getAllRoles().map((r) => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" style={{ padding: '8px 16px' }} disabled={busy} onClick={saveRole}>Guardar</button>
            <button className="btn btn-ghost" style={{ padding: '8px 16px' }} onClick={() => { setEditing(false); setSelRole(user.role) }}>Cancelar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6, color: '#22D0F7', background: 'rgba(34,208,247,0.12)', border: '1px solid rgba(34,208,247,0.25)' }}>
              {getRoleLabel(user.role)}
            </span>
            {!readOnly && (
              <button className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => setEditing(true)}>Cambiar</button>
            )}
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.5 }}>
        {getRoleDescription(user.role)}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8 }}>Accesos</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {user.access_summary.map((a) => (
            <span key={a.module} style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 6,
              color: a.level === 'full' ? 'var(--success)' : a.level === 'view' ? 'var(--text-dim)' : 'var(--text-dim)',
              background: a.level === 'full' ? 'rgba(22,163,74,0.1)' : a.level === 'view' ? 'var(--surface-2)' : 'transparent',
              border: a.level ? '1px solid var(--border)' : '1px solid transparent',
              opacity: a.level ? 1 : 0.4,
            }}>
              {a.label}{a.level === 'full' ? ' ✓' : a.level === 'view' ? ' 👁' : ' ✗'}
            </span>
          ))}
        </div>
      </div>

      {!readOnly && !user.auth_user_id && (
        <button className="btn btn-ghost" style={{ marginTop: 12, width: '100%', color: 'var(--error)', fontSize: 12 }} onClick={async () => {
          if (!confirm(`¿Eliminar a ${user.name}? Esta persona perderá acceso al sistema.`)) return
          await deleteBusinessUser(user.id)
          onChanged()
        }}>Eliminar usuario</button>
      )}
    </div>
  )
}

function AddUserModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { business } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('auxiliar')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!business) return
    if (!name.trim()) return setError('Ingresa el nombre.')
    if (!email.trim()) return setError('Ingresa el correo.')
    try {
      setBusy(true)
      await createBusinessUser(business.id, { name: name.trim(), email: email.trim(), role })
      onAdded()
    } catch (e: any) {
      setError(e.message || 'No se pudo agregar el usuario.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20 }}>
      <div className="card" style={{ maxWidth: 440, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3>Añadir persona</h3>
          <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={onClose}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label>Nombre completo *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Juan Pérez" />
          </div>
          <div className="field">
            <label>Correo electrónico *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@correo.com" />
          </div>
          <div className="field">
            <label>Rol</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {getAllRoles().filter((r) => r !== 'administrador').map((r) => (
                <option key={r} value={r}>{getRoleLabel(r)}</option>
              ))}
            </select>
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>{getRoleDescription(role)}</p>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
            La persona podrá crear su cuenta usando el mismo correo. Mientras tanto, quedará como "Pendiente".
          </div>
          {error && <div className="error-text">{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Guardando…' : 'Agregar'}</button>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
