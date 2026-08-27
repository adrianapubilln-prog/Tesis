import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import { getAllRoles, getRoleLabel, getRoleDescription } from '../lib/permissions'
import type { Role } from '../lib/supabase'

type Step = 1 | 2 | 3
type BizType = 'comercial' | 'productora'

export default function Onboarding() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>(1)
  const [bizType, setBizType] = useState<BizType>('comercial')

  // Step 1 — business info
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [nit, setNit] = useState('')
  const [foundedAt, setFoundedAt] = useState('')

  // Step 2 — admin user (the owner's profile within the business)
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState(user?.email ?? '')
  const [adminPassword, setAdminPassword] = useState('')

  // Step 3 — extra users (optional)
  const [users, setUsers] = useState<{ name: string; email: string; role: Role }[]>([])

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const next = () => {
    setError(null)
    if (step === 1) {
      if (!name.trim()) return setError('Ingresa el nombre del negocio.')
      if (!phone.trim()) return setError('Ingresa un teléfono de contacto.')
      if (!address.trim()) return setError('Ingresa la dirección del negocio.')
      setStep(2)
    } else if (step === 2) {
      if (!adminName.trim()) return setError('Ingresa el nombre del administrador.')
      if (!adminEmail.trim()) return setError('Ingresa el correo del administrador.')
      setStep(3)
    }
  }
  const back = () => { setError(null); setStep((step - 1) as Step) }

  const finish = async () => {
    setError(null)
    setBusy(true)
    try {
      const ownerId = user!.id
      const { data: biz, error: bizErr } = await supabase
        .from('businesses')
        .insert({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          nit: nit.trim() || null,
          type: bizType,
          founded_at: foundedAt || null,
          owner_id: ownerId,
        })
        .select()
        .single()
      if (bizErr) throw new Error(bizErr.message)
      const businessId = (biz as any).id

      // Create the admin business_user row for the owner
      const { error: adminErr } = await supabase.from('business_users').insert({
        business_id: businessId,
        auth_user_id: ownerId,
        name: adminName.trim(),
        email: adminEmail.trim(),
        role: 'administrador',
      })
      if (adminErr) throw new Error(adminErr.message)

      // Create extra users as invited business_users (they'll create their own
      // auth account later with the same email; the row is linked at that time).
      for (const u of users) {
        if (!u.name.trim() || !u.email.trim()) continue
        const { error: buErr } = await supabase.from('business_users').insert({
          business_id: businessId,
          auth_user_id: null,
          name: u.name.trim(),
          email: u.email.trim(),
          role: u.role,
        })
        if (buErr) throw new Error(buErr.message)
      }

      await refresh()
      navigate('/dashboard')
    } catch (e: any) {
      setError(e.message || 'Ocurrió un error al registrar el negocio.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 640, padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <Logo size={44} />
        </div>
        <Stepper step={step} />
        <h1 style={{ fontSize: 22, marginTop: 18 }}>
          {step === 1 && 'Información del negocio'}
          {step === 2 && 'Usuario administrador'}
          {step === 3 && 'Otros usuarios (opcional)'}
        </h1>
        <p className="muted" style={{ fontSize: 14, marginBottom: 22 }}>
          {step === 1 && 'Cuéntanos sobre tu emprendimiento o empresa.'}
          {step === 2 && 'Define quién administrará la cuenta.'}
          {step === 3 && 'Agrega empleados o contador. Puedes saltar este paso.'}
        </p>

        {step === 1 && (
          <div>
            <div className="field">
              <label>Nombre del negocio *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Mi Tienda SV" />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Teléfono *</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0000-0000" />
              </div>
              <div className="field">
                <label>NIT / Documento fiscal</label>
                <input value={nit} onChange={(e) => setNit(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <div className="field">
              <label>Dirección *</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Departamento, municipio, calle" />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Fecha de creación del emprendimiento</label>
                <input type="date" value={foundedAt} onChange={(e) => setFoundedAt(e.target.value)} />
              </div>
              <div className="field">
                <label>Tipo de negocio</label>
                <select value={bizType} onChange={(e) => setBizType(e.target.value as BizType)}>
                  <option value="comercial">Comercial (revende productos)</option>
                  <option value="productora">Productora (fabrica con materias primas)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="field">
              <label>Nombre completo del administrador *</label>
              <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Tu nombre" />
            </div>
            <div className="field">
              <label>Correo del administrador *</label>
              <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Contraseña de acceso</label>
              <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="La que usarás para iniciar sesión" />
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Tu cuenta ya fue creada al registrarte. Esta contraseña es solo para confirmar el acceso del administrador.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            {users.length === 0 && (
              <div className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
                No has agregado usuarios adicionales. Puedes continuar o agregar uno.
              </div>
            )}
            {users.map((u, i) => (
              <div key={i} className="card" style={{ padding: 14, marginBottom: 12 }}>
                <div className="field-row">
                  <div className="field">
                    <label>Nombre</label>
                    <input value={u.name} onChange={(e) => updateUser(i, 'name', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Correo</label>
                    <input type="email" value={u.email} onChange={(e) => updateUser(i, 'email', e.target.value)} />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Rol</label>
                    <select value={u.role} onChange={(e) => updateUser(i, 'role', e.target.value)}>
                      {getAllRoles().filter(r => r !== 'administrador').map(r => (
                        <option key={r} value={r}>{getRoleLabel(r)}</option>
                      ))}
                    </select>
                    <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>{getRoleDescription(u.role as Role)}</p>
                  </div>
                  <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => removeUser(i)}>Eliminar</button>
                  </div>
                </div>
              </div>
            ))}
            <button className="btn btn-ghost" onClick={addUser}>+ Agregar usuario</button>
          </div>
        )}

        {error && <div className="error-text" style={{ marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26 }}>
          {step > 1 ? (
            <button className="btn btn-ghost" onClick={back} disabled={busy}>Atrás</button>
          ) : <span />}
          {step < 3 ? (
            <button className="btn btn-primary" onClick={next}>Continuar</button>
          ) : (
            <button className="btn btn-primary" onClick={finish} disabled={busy}>
              {busy ? 'Guardando…' : 'Finalizar y entrar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )

  function addUser() {
    setUsers([...users, { name: '', email: '', role: 'auxiliar' }])
  }
  function updateUser(i: number, key: string, value: string) {
    setUsers(users.map((u, idx) => (idx === i ? { ...u, [key]: value } : u)))
  }
  function removeUser(i: number) {
    setUsers(users.filter((_, idx) => idx !== i))
  }
}

function Stepper({ step }: { step: Step }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          style={{
            flex: 1,
            height: 6,
            borderRadius: 999,
            background: n <= step ? 'var(--accent)' : 'var(--border)',
            transition: 'background .2s',
          }}
        />
      ))}
    </div>
  )
}
