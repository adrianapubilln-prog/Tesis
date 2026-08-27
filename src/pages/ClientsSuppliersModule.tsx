import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import {
  fetchClients, createClient, updateClient, deleteClient,
  fetchClientSales, fetchClientPayments, payClient,
  fetchClientReminders, createClientReminder, updateReminderStatus, deleteReminder,
  type Client, type Sale, type ClientPayment, type ClientReminder,
} from '../lib/sales'
import {
  fetchSuppliers, createSupplier, updateSupplier, deleteSupplier,
  fetchSupplierPurchases, fetchSupplierPayments, paySupplier,
  fetchProductPriceHistory,
  type Supplier, type SupplierPayment, type PriceHistoryEntry,
} from '../lib/purchases'

type Tab = 'clients' | 'suppliers'

export default function ClientsSuppliersModule() {
  const [tab, setTab] = useState<Tab>('clients')
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <span className="badge">Clientes y Proveedores</span>
        <h1 style={{ fontSize: 26, marginTop: 8 }}>Clientes y Proveedores</h1>
        <p className="muted" style={{ fontSize: 14 }}>Gestiona tus clientes, historial de compras, deudas y recordatorios. Controla proveedores, pagos pendientes e historial de precios.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <TabBtn active={tab === 'clients'} onClick={() => setTab('clients')}>Clientes</TabBtn>
        <TabBtn active={tab === 'suppliers'} onClick={() => setTab('suppliers')}>Proveedores</TabBtn>
      </div>
      {tab === 'clients' && <Clients />}
      {tab === 'suppliers' && <Suppliers />}
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

/* ============== CLIENTES ============== */
function Clients() {
  const { business, user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [selected, setSelected] = useState<Client | null>(null)
  const [view, setView] = useState<'list' | 'frequent' | 'debts' | 'reminders'>('list')

  const load = () => { if (business) fetchClients(business.id).then(setClients).catch(() => {}) }
  useEffect(load, [business])

  const filtered = useMemo(() => {
    if (!search) return clients
    const q = search.toLowerCase()
    return clients.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    )
  }, [clients, search])

  const withDebt = clients.filter((c) => Number(c.balance) > 0)
  const frequent = useMemo(() => {
    return [...clients].sort((a, b) => {
      // frequent = those with most recent activity; we approximate by created_at recency + balance activity
      return Number(b.balance) - Number(a.balance)
    })
  }, [clients])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <SubTab active={view === 'list'} onClick={() => setView('list')}>Todos ({clients.length})</SubTab>
        <SubTab active={view === 'frequent'} onClick={() => setView('frequent')}>Frecuentes</SubTab>
        <SubTab active={view === 'debts'} onClick={() => setView('debts')}>Deudas ({withDebt.length})</SubTab>
        <SubTab active={view === 'reminders'} onClick={() => setView('reminders')}>Recordatorios</SubTab>
      </div>

      {view === 'reminders' ? (
        <Reminders onReload={load} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end' }}>
            <div className="field" style={{ margin: 0, flex: 1 }}>
              <label>Buscar por nombre, teléfono o correo</label>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" />
            </div>
            <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>+ Nuevo cliente</button>
          </div>

          {showForm && (
            <ClientForm
              existing={editing}
              onCancel={() => { setShowForm(false); setEditing(null) }}
              onSaved={() => { setShowForm(false); setEditing(null); load() }}
              businessId={business?.id || ''}
            />
          )}

          {selected && (
            <ClientDetail
              client={selected}
              onClose={() => setSelected(null)}
              onReload={load}
            />
          )}

          {view === 'debts' && withDebt.length > 0 && (
            <div className="card" style={{ padding: 16, marginBottom: 16, borderColor: 'var(--warning)' }}>
              <h3 style={{ color: 'var(--warning)', marginBottom: 8 }}>Deudas pendientes</h3>
              <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>
                Total por cobrar: <strong style={{ color: 'var(--warning)' }}>${withDebt.reduce((s, c) => s + Number(c.balance), 0).toFixed(2)}</strong> · {withDebt.length} clientes con saldo pendiente.
              </p>
            </div>
          )}

          {filtered.length === 0 && !showForm ? (
            <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>
              No hay clientes. {view === 'debts' ? 'Ningún cliente tiene deudas pendientes.' : 'Agrega tu primer cliente.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-dim)' }}>
                  <th style={{ padding: '10px 8px' }}>Nombre</th>
                  <th style={{ padding: '10px 8px' }}>Teléfono</th>
                  <th style={{ padding: '10px 8px' }}>Correo</th>
                  <th style={{ padding: '10px 8px' }}>Saldo</th>
                  <th style={{ padding: '10px 8px' }}>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(view === 'debts' ? withDebt : filtered).map((c) => (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setSelected(c)}>
                    <td style={{ padding: '10px 8px' }}>{c.name}</td>
                    <td style={{ padding: '10px 8px' }}>{c.phone || '—'}</td>
                    <td style={{ padding: '10px 8px' }}>{c.email || '—'}</td>
                    <td style={{ padding: '10px 8px', color: Number(c.balance) > 0 ? 'var(--warning)' : 'var(--text)' }}>
                      ${Number(c.balance).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, color: Number(c.balance) > 0 ? 'var(--warning)' : 'var(--success)' }}>
                        {Number(c.balance) > 0 ? 'Debe' : 'Al día'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px' }} onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setEditing(c); setShowForm(true) }}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}

function SubTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="btn btn-ghost" style={{
      padding: '6px 14px', fontSize: 13,
      background: active ? 'var(--primary-soft)' : 'transparent',
      borderColor: active ? 'var(--accent)' : 'var(--border)',
    }}>{children}</button>
  )
}

function ClientForm({ existing, onCancel, onSaved, businessId }: { existing: Client | null; onCancel: () => void; onSaved: () => void; businessId: string }) {
  const [name, setName] = useState(existing?.name || '')
  const [phone, setPhone] = useState(existing?.phone || '')
  const [email, setEmail] = useState(existing?.email || '')
  const [address, setAddress] = useState(existing?.address || '')
  const [creditLimit, setCreditLimit] = useState(existing?.credit_limit || 0)
  const [observations, setObservations] = useState(existing?.observations || '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setErr(null)
    if (!name.trim()) return setErr('Nombre obligatorio.')
    setBusy(true)
    try {
      const data = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        credit_limit: Number(creditLimit) || 0,
        observations: observations.trim() || null,
      }
      if (existing) await updateClient(existing.id, data)
      else await createClient(businessId, data)
      onSaved()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: 20, marginBottom: 16, maxWidth: 560 }}>
      <h3 style={{ marginBottom: 14 }}>{existing ? 'Editar cliente' : 'Nuevo cliente'}</h3>
      <div className="field-row">
        <div className="field">
          <label>Nombre *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Teléfono</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Correo electrónico</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Dirección</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Límite de crédito ($)</label>
          <input type="number" min={0} step="0.01" value={creditLimit} onChange={(e) => setCreditLimit(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Observaciones / preferencias</label>
          <input value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Preferencias del cliente" />
        </div>
      </div>
      {err && <div className="error-text" style={{ marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        {existing && (
          <button className="btn btn-ghost" style={{ color: 'var(--error)', marginLeft: 'auto' }} onClick={async () => {
            if (!confirm(`¿Eliminar a "${existing.name}"?`)) return
            await deleteClient(existing.id); onSaved()
          }}>Eliminar</button>
        )}
      </div>
    </div>
  )
}

function ClientDetail({ client, onClose, onReload }: { client: Client; onClose: () => void; onReload: () => void }) {
  const { business, user } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [payments, setPayments] = useState<ClientPayment[]>([])
  const [payAmount, setPayAmount] = useState(0)
  const [payMethod, setPayMethod] = useState<'efectivo' | 'transferencia' | 'credito'>('efectivo')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!business) return
    fetchClientSales(business.id, client.id).then(setSales).catch(() => {})
    fetchClientPayments(business.id, client.id).then(setPayments).catch(() => {})
  }, [business, client.id])

  const totalBought = sales.reduce((s, x) => s + Number(x.total), 0)

  const doPay = async () => {
    if (!business || !user) return
    if (!payAmount || payAmount <= 0) return
    setBusy(true); setMsg(null)
    try {
      await payClient(business.id, user.id, client.id, Number(payAmount), payMethod)
      setMsg(`Pago de $${Number(payAmount).toFixed(2)} registrado.`)
      setPayAmount(0)
      fetchClientPayments(business.id, client.id).then(setPayments).catch(() => {})
      onReload()
    } catch (e: any) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} title={client.name}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: 13 }}>
        <Info label="Teléfono" value={client.phone || '—'} />
        <Info label="Correo" value={client.email || '—'} />
        <Info label="Dirección" value={client.address || '—'} />
        <Info label="Fecha registro" value={new Date(client.created_at || Date.now()).toLocaleDateString('es-SV')} />
        <Info label="Límite crédito" value={`$${Number(client.credit_limit).toFixed(2)}`} />
        <Info label="Saldo pendiente" value={`$${Number(client.balance).toFixed(2)}`} highlight={Number(client.balance) > 0} />
      </div>
      {client.observations && (
        <div style={{ fontSize: 13, marginBottom: 14, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
          <strong>Observaciones:</strong> {client.observations}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
        <Stat label="Compras totales" value={`$${totalBought.toFixed(2)}`} />
        <Stat label="N° de compras" value={String(sales.length)} />
      </div>

      {Number(client.balance) > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 14, borderColor: 'var(--warning)' }}>
          <h4 style={{ marginBottom: 10, color: 'var(--warning)' }}>Registrar pago</h4>
          <div className="field-row">
            <div className="field">
              <label>Monto ($)</label>
              <input type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Método</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as any)}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
          </div>
          {msg && <div style={{ color: 'var(--success)', fontSize: 13, marginBottom: 8 }}>{msg}</div>}
          <button className="btn btn-primary" disabled={busy} onClick={doPay}>{busy ? 'Procesando…' : 'Registrar pago'}</button>
        </div>
      )}

      <h4 style={{ marginBottom: 8 }}>Historial de compras</h4>
      {sales.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Sin compras registradas.</p>
      ) : (
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginBottom: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-dim)' }}>
              <th style={{ padding: '6px' }}>Factura</th>
              <th style={{ padding: '6px' }}>Fecha</th>
              <th style={{ padding: '6px' }}>Total</th>
              <th style={{ padding: '6px' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '6px' }}>{s.invoice_number || '—'}</td>
                <td style={{ padding: '6px' }}>{s.sale_date}</td>
                <td style={{ padding: '6px' }}>${Number(s.total).toFixed(2)}</td>
                <td style={{ padding: '6px' }}>{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {payments.length > 0 && (
        <>
          <h4 style={{ marginBottom: 8 }}>Pagos recibidos</h4>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-dim)' }}>
                <th style={{ padding: '6px' }}>Fecha</th>
                <th style={{ padding: '6px' }}>Monto</th>
                <th style={{ padding: '6px' }}>Método</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px' }}>{new Date(p.created_at).toLocaleDateString('es-SV')}</td>
                  <td style={{ padding: '6px', color: 'var(--success)' }}>${Number(p.amount).toFixed(2)}</td>
                  <td style={{ padding: '6px' }}>{p.payment_method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  )
}

function Reminders({ onReload }: { onReload: () => void }) {
  const { business, user } = useAuth()
  const [reminders, setReminders] = useState<(ClientReminder & { client?: Client | null })[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selClient, setSelClient] = useState('')
  const [message, setMessage] = useState('')
  const [dueDate, setDueDate] = useState('')

  const load = () => {
    if (!business) return
    fetchClientReminders(business.id).then(setReminders).catch(() => {})
    fetchClients(business.id).then(setClients).catch(() => {})
  }
  useEffect(load, [business])

  const add = async () => {
    if (!business || !user || !selClient || !message.trim()) return
    await createClientReminder(business.id, user.id, selClient, message.trim(), dueDate || undefined)
    setMessage(''); setSelClient(''); setDueDate('')
    load(); onReload()
  }

  return (
    <div>
      <div className="card" style={{ padding: 20, marginBottom: 16, maxWidth: 560 }}>
        <h3 style={{ marginBottom: 14 }}>Crear recordatorio</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Recordatorios para cobrar saldos pendientes o seguir up con clientes.</p>
        <div className="field">
          <label>Cliente *</label>
          <select value={selClient} onChange={(e) => setSelClient(e.target.value)}>
            <option value="">— Selecciona —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name} {Number(c.balance) > 0 ? `· debe $${Number(c.balance).toFixed(2)}` : ''}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Mensaje</label>
          <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ej. Recordatorio de pago pendiente" />
        </div>
        <div className="field">
          <label>Fecha límite</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={add}>+ Crear recordatorio</button>
      </div>

      {reminders.length === 0 ? (
        <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>No hay recordatorios.</div>
      ) : (
        reminders.map((r) => (
          <div key={r.id} className="card" style={{ padding: 14, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{r.client?.name || 'Cliente'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{r.message}</div>
              {r.due_date && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>Vence: {r.due_date}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={r.status} onChange={async (e) => { await updateReminderStatus(r.id, e.target.value as any); load() }} style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}>
                <option value="pendiente">Pendiente</option>
                <option value="enviado">Enviado</option>
                <option value="pagado">Pagado</option>
              </select>
              <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12, color: 'var(--error)' }} onClick={async () => { await deleteReminder(r.id); load() }}>×</button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

/* ============== PROVEEDORES ============== */
function Suppliers() {
  const { business, user } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [selected, setSelected] = useState<Supplier | null>(null)
  const [view, setView] = useState<'list' | 'debts' | 'prices'>('list')

  const load = () => { if (business) fetchSuppliers(business.id).then(setSuppliers).catch(() => {}) }
  useEffect(load, [business])

  const filtered = useMemo(() => {
    if (!search) return suppliers
    const q = search.toLowerCase()
    return suppliers.filter((s) =>
      s.contact_name.toLowerCase().includes(q) ||
      (s.company_name || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    )
  }, [suppliers, search])

  const withDebt = suppliers.filter((s) => Number(s.balance) > 0)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <SubTab active={view === 'list'} onClick={() => setView('list')}>Todos ({suppliers.length})</SubTab>
        <SubTab active={view === 'debts'} onClick={() => setView('debts')}>Pagos pendientes ({withDebt.length})</SubTab>
        <SubTab active={view === 'prices'} onClick={() => setView('prices')}>Historial de precios</SubTab>
      </div>

      {view === 'prices' ? (
        <PriceHistory />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end' }}>
            <div className="field" style={{ margin: 0, flex: 1 }}>
              <label>Buscar proveedor</label>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, empresa, teléfono…" />
            </div>
            <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>+ Nuevo proveedor</button>
          </div>

          {showForm && (
            <SupplierForm
              existing={editing}
              onCancel={() => { setShowForm(false); setEditing(null) }}
              onSaved={() => { setShowForm(false); setEditing(null); load() }}
              businessId={business?.id || ''}
            />
          )}

          {selected && (
            <SupplierDetail
              supplier={selected}
              onClose={() => setSelected(null)}
              onReload={load}
            />
          )}

          {view === 'debts' && withDebt.length > 0 && (
            <div className="card" style={{ padding: 16, marginBottom: 16, borderColor: 'var(--warning)' }}>
              <h3 style={{ color: 'var(--warning)', marginBottom: 8 }}>Pagos pendientes a proveedores</h3>
              <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>
                Total por pagar: <strong style={{ color: 'var(--warning)' }}>${withDebt.reduce((s, x) => s + Number(x.balance), 0).toFixed(2)}</strong> · {withDebt.length} proveedores con saldo pendiente.
              </p>
            </div>
          )}

          {filtered.length === 0 && !showForm ? (
            <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>
              No hay proveedores. {view === 'debts' ? 'No tienes pagos pendientes.' : 'Agrega tu primer proveedor.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-dim)' }}>
                  <th style={{ padding: '10px 8px' }}>Contacto</th>
                  <th style={{ padding: '10px 8px' }}>Empresa</th>
                  <th style={{ padding: '10px 8px' }}>Teléfono</th>
                  <th style={{ padding: '10px 8px' }}>Productos</th>
                  <th style={{ padding: '10px 8px' }}>Saldo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(view === 'debts' ? withDebt : filtered).map((s) => (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setSelected(s)}>
                    <td style={{ padding: '10px 8px' }}>{s.contact_name}</td>
                    <td style={{ padding: '10px 8px' }}>{s.company_name || '—'}</td>
                    <td style={{ padding: '10px 8px' }}>{s.phone || '—'}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-dim)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.products_supplied || '—'}</td>
                    <td style={{ padding: '10px 8px', color: Number(s.balance) > 0 ? 'var(--warning)' : 'var(--text)' }}>${Number(s.balance).toFixed(2)}</td>
                    <td style={{ padding: '10px 8px' }} onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setEditing(s); setShowForm(true) }}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}

function SupplierForm({ existing, onCancel, onSaved, businessId }: { existing: Supplier | null; onCancel: () => void; onSaved: () => void; businessId: string }) {
  const [contactName, setContactName] = useState(existing?.contact_name || '')
  const [companyName, setCompanyName] = useState(existing?.company_name || '')
  const [phone, setPhone] = useState(existing?.phone || '')
  const [email, setEmail] = useState(existing?.email || '')
  const [address, setAddress] = useState(existing?.address || '')
  const [productsSupplied, setProductsSupplied] = useState(existing?.products_supplied || '')
  const [observations, setObservations] = useState(existing?.observations || '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setErr(null)
    if (!contactName.trim()) return setErr('Nombre del contacto obligatorio.')
    setBusy(true)
    try {
      const data = {
        contact_name: contactName.trim(),
        company_name: companyName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        products_supplied: productsSupplied.trim() || null,
        observations: observations.trim() || null,
      }
      if (existing) await updateSupplier(existing.id, data)
      else await createSupplier(businessId, data)
      onSaved()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: 20, marginBottom: 16, maxWidth: 560 }}>
      <h3 style={{ marginBottom: 14 }}>{existing ? 'Editar proveedor' : 'Nuevo proveedor'}</h3>
      <div className="field-row">
        <div className="field">
          <label>Nombre del contacto *</label>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div className="field">
          <label>Empresa</label>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Teléfono</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label>Correo</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Dirección</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="field">
        <label>Productos que suministra</label>
        <input value={productsSupplied} onChange={(e) => setProductsSupplied(e.target.value)} placeholder="Ej. Harina, azúcar, leche" />
      </div>
      <div className="field">
        <label>Observaciones</label>
        <input value={observations} onChange={(e) => setObservations(e.target.value)} />
      </div>
      {err && <div className="error-text" style={{ marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        {existing && (
          <button className="btn btn-ghost" style={{ color: 'var(--error)', marginLeft: 'auto' }} onClick={async () => {
            if (!confirm(`¿Eliminar a "${existing.contact_name}"?`)) return
            await deleteSupplier(existing.id); onSaved()
          }}>Eliminar</button>
        )}
      </div>
    </div>
  )
}

function SupplierDetail({ supplier, onClose, onReload }: { supplier: Supplier; onClose: () => void; onReload: () => void }) {
  const { business, user } = useAuth()
  const [purchases, setPurchases] = useState<any[]>([])
  const [payments, setPayments] = useState<SupplierPayment[]>([])
  const [payAmount, setPayAmount] = useState(0)
  const [payMethod, setPayMethod] = useState<'efectivo' | 'transferencia' | 'credito'>('efectivo')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!business) return
    fetchSupplierPurchases(business.id, supplier.id).then(setPurchases).catch(() => {})
    fetchSupplierPayments(business.id, supplier.id).then(setPayments).catch(() => {})
  }, [business, supplier.id])

  const totalPurchased = purchases.reduce((s, x) => s + Number(x.total), 0)

  const doPay = async () => {
    if (!business || !user) return
    if (!payAmount || payAmount <= 0) return
    setBusy(true); setMsg(null)
    try {
      await paySupplier(business.id, user.id, supplier.id, Number(payAmount), payMethod)
      setMsg(`Pago de $${Number(payAmount).toFixed(2)} registrado.`)
      setPayAmount(0)
      fetchSupplierPayments(business.id, supplier.id).then(setPayments).catch(() => {})
      onReload()
    } catch (e: any) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} title={supplier.contact_name}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: 13 }}>
        <Info label="Empresa" value={supplier.company_name || '—'} />
        <Info label="Teléfono" value={supplier.phone || '—'} />
        <Info label="Correo" value={supplier.email || '—'} />
        <Info label="Dirección" value={supplier.address || '—'} />
        <Info label="Productos" value={supplier.products_supplied || '—'} />
        <Info label="Saldo pendiente" value={`$${Number(supplier.balance).toFixed(2)}`} highlight={Number(supplier.balance) > 0} />
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
        <Stat label="Compras totales" value={`$${totalPurchased.toFixed(2)}`} />
        <Stat label="N° de compras" value={String(purchases.length)} />
      </div>

      {Number(supplier.balance) > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 14, borderColor: 'var(--warning)' }}>
          <h4 style={{ marginBottom: 10, color: 'var(--warning)' }}>Registrar pago a proveedor</h4>
          <div className="field-row">
            <div className="field">
              <label>Monto ($)</label>
              <input type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Método</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as any)}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
          </div>
          {msg && <div style={{ color: 'var(--success)', fontSize: 13, marginBottom: 8 }}>{msg}</div>}
          <button className="btn btn-primary" disabled={busy} onClick={doPay}>{busy ? 'Procesando…' : 'Registrar pago'}</button>
        </div>
      )}

      <h4 style={{ marginBottom: 8 }}>Historial de compras</h4>
      {purchases.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Sin compras registradas con este proveedor.</p>
      ) : (
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginBottom: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-dim)' }}>
              <th style={{ padding: '6px' }}>Factura</th>
              <th style={{ padding: '6px' }}>Fecha</th>
              <th style={{ padding: '6px' }}>Total</th>
              <th style={{ padding: '6px' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '6px' }}>{p.invoice_number || '—'}</td>
                <td style={{ padding: '6px' }}>{p.purchase_date}</td>
                <td style={{ padding: '6px' }}>${Number(p.total).toFixed(2)}</td>
                <td style={{ padding: '6px' }}>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {payments.length > 0 && (
        <>
          <h4 style={{ marginBottom: 8 }}>Pagos realizados</h4>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-dim)' }}>
                <th style={{ padding: '6px' }}>Fecha</th>
                <th style={{ padding: '6px' }}>Monto</th>
                <th style={{ padding: '6px' }}>Método</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px' }}>{new Date(p.created_at).toLocaleDateString('es-SV')}</td>
                  <td style={{ padding: '6px', color: 'var(--success)' }}>${Number(p.amount).toFixed(2)}</td>
                  <td style={{ padding: '6px' }}>{p.payment_method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  )
}

function PriceHistory() {
  const { business } = useAuth()
  const [history, setHistory] = useState<PriceHistoryEntry[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!business) return
    fetchProductPriceHistory(business.id).then(setHistory).catch(() => {})
  }, [business])

  const filtered = useMemo(() => {
    if (!search) return history
    const q = search.toLowerCase()
    return history.filter((h) => h.product_name.toLowerCase().includes(q) || (h.supplier_name || '').toLowerCase().includes(q))
  }, [history, search])

  return (
    <div>
      <div className="field" style={{ maxWidth: 360, marginBottom: 16 }}>
        <label>Buscar por producto o proveedor</label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" />
      </div>
      {filtered.length === 0 ? (
        <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>Sin historial de precios. Registra compras para ver la evolución de precios.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-dim)' }}>
              <th style={{ padding: '10px 8px' }}>Producto</th>
              <th style={{ padding: '10px 8px' }}>Proveedor</th>
              <th style={{ padding: '10px 8px' }}>Fecha</th>
              <th style={{ padding: '10px 8px' }}>Factura</th>
              <th style={{ padding: '10px 8px' }}>Costo unit.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((h, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 8px' }}>{h.product_name}</td>
                <td style={{ padding: '10px 8px' }}>{h.supplier_name || '—'}</td>
                <td style={{ padding: '10px 8px' }}>{h.purchase_date}</td>
                <td style={{ padding: '10px 8px', color: 'var(--text-dim)' }}>{h.invoice_number || '—'}</td>
                <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--accent)' }}>${Number(h.unit_cost).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/* ============== Shared ============== */
function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontWeight: 600, color: highlight ? 'var(--warning)' : 'var(--text)' }}>{value}</div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8 }}>
      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20, overflowY: 'auto' }}>
      <div className="card" style={{ maxWidth: 640, width: '100%', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)' }}>
          <h3>{title}</h3>
          <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={onClose}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}
