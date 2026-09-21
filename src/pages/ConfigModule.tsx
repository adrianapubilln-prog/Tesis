import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { Business } from '../lib/supabase'

export default function ConfigModule() {
  const { business, membership, canEdit, refresh } = useAuth()
  const readOnly = !canEdit('configuracion')
  const [tab, setTab] = useState<'empresa' | 'sistema'>('empresa')

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <span className="badge">Configuración</span>
        <h1 style={{ fontSize: 26, marginTop: 8 }}>Configuración del sistema</h1>
        <p className="muted" style={{ fontSize: 14 }}>Administra la información de tu empresa y los parámetros del sistema.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <TabBtn active={tab === 'empresa'} onClick={() => setTab('empresa')}>Datos de la empresa</TabBtn>
        <TabBtn active={tab === 'sistema'} onClick={() => setTab('sistema')}>Parámetros del sistema</TabBtn>
      </div>

      {readOnly && (
        <div className="card" style={{ padding: 14, marginBottom: 16, fontSize: 13, color: 'var(--text-dim)' }}>
          Tienes acceso de solo lectura a este módulo.
        </div>
      )}

      {tab === 'empresa' && business && <CompanyTab business={business} readOnly={readOnly} onSaved={refresh} />}
      {tab === 'sistema' && business && <SystemTab business={business} readOnly={readOnly} />}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 16px', background: 'transparent', border: 'none',
      borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
      color: active ? 'var(--text)' : 'var(--text-dim)', fontWeight: active ? 600 : 500, cursor: 'pointer',
    }}>{children}</button>
  )
}

function CompanyTab({ business, readOnly, onSaved }: { business: Business; readOnly: boolean; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(business.name)
  const [phone, setPhone] = useState(business.phone || '')
  const [address, setAddress] = useState(business.address || '')
  const [nit, setNit] = useState(business.nit || '')
  const [foundedAt, setFoundedAt] = useState(business.founded_at || '')
  const [type, setType] = useState(business.type)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    setErr(null); setMsg(null)
    if (!name.trim()) return setErr('El nombre es obligatorio.')
    setBusy(true)
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          nit: nit.trim() || null,
          founded_at: foundedAt || null,
          type,
        })
        .eq('id', business.id)
      if (error) throw error
      await onSaved()
      setMsg('Datos guardados correctamente.')
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: 24, maxWidth: 640 }}>
      <div className="field">
        <label>Nombre del negocio *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Teléfono</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={readOnly} placeholder="0000-0000" />
        </div>
        <div className="field">
          <label>NIT / Documento fiscal</label>
          <input value={nit} onChange={(e) => setNit(e.target.value)} disabled={readOnly} />
        </div>
      </div>
      <div className="field">
        <label>Dirección</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} disabled={readOnly} />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Fecha de creación</label>
          <input type="date" value={foundedAt} onChange={(e) => setFoundedAt(e.target.value)} disabled={readOnly} />
        </div>
        <div className="field">
          <label>Tipo de negocio</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)} disabled={readOnly}>
            <option value="comercial">Comercial (revende productos)</option>
            <option value="productora">Productora (fabrica con materias primas)</option>
          </select>
        </div>
      </div>
      {err && <div className="error-text" style={{ marginBottom: 10 }}>{err}</div>}
      {msg && <div style={{ color: 'var(--success)', fontSize: 13, marginBottom: 10 }}>{msg}</div>}
      {!readOnly && (
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
      )}
    </div>
  )
}

function SystemTab({ business, readOnly }: { business: Business; readOnly: boolean }) {
  const [taxRate, setTaxRate] = useState(0)
  const [currency, setCurrency] = useState('USD')
  const [lowStockAlerts, setLowStockAlerts] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('business_settings').select('*').eq('business_id', business.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTaxRate(Number(data.tax_rate) || 0)
          setCurrency(data.currency || 'USD')
          setLowStockAlerts(data.low_stock_alerts !== false)
        }
      })
  }, [business.id])

  const save = async () => {
    setBusy(true)
    try {
      const { error } = await supabase.from('business_settings').upsert({
        business_id: business.id,
        tax_rate: taxRate,
        currency,
        low_stock_alerts: lowStockAlerts,
      })
      if (error) throw error
      setMsg('Parámetros guardados.')
    } catch (e: any) {
      setMsg('Error: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: 24, maxWidth: 560 }}>
      <div className="field">
        <label>Tasa de impuesto (%)</label>
        <input type="number" min={0} max={100} step="0.01" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} disabled={readOnly} />
        <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>Porcentaje de impuesto aplicado a ventas y compras.</p>
      </div>
      <div className="field">
        <label>Moneda</label>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={readOnly}>
          <option value="USD">USD - Dólar estadounidense</option>
          <option value="SVC">SVC - Colón salvadoreño</option>
          <option value="GTQ">GTQ - Quetzal guatemalteco</option>
          <option value="HNL">HNL - Lempira hondureño</option>
          <option value="NIO">NIO - Córdoba nicaragüense</option>
        </select>
      </div>
      <div className="field">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={lowStockAlerts} onChange={(e) => setLowStockAlerts(e.target.checked)} disabled={readOnly} />
          Alertas de stock bajo activadas
        </label>
      </div>
      {msg && <div style={{ color: msg.startsWith('Error') ? 'var(--error)' : 'var(--success)', fontSize: 13, marginBottom: 10 }}>{msg}</div>}
      {!readOnly && (
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar parámetros'}</button>
      )}
    </div>
  )
}
