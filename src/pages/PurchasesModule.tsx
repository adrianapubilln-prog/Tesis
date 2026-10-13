import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { fetchProducts, type Product } from '../lib/sales'
import {
  fetchSuppliers, createSupplier, updateSupplier, deleteSupplier,
  fetchPurchases, fetchPurchaseItems, fetchSupplierPurchases,
  createPurchase, createPurchaseReturn, paySupplierLegacy,
  type Supplier, type Purchase, type PurchaseItem,
} from '../lib/purchases'

type Tab = 'new' | 'history' | 'returns' | 'suppliers' | 'alerts'

export default function PurchasesModule() {
  const [tab, setTab] = useState<Tab>('new')
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <span className="badge">Módulo de Compras</span>
        <h1 style={{ fontSize: 26, marginTop: 8 }}>Compras</h1>
        <p className="muted" style={{ fontSize: 14 }}>Registra lo que compras, controla proveedores, pagos pendientes e inventario.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginBottom: 20, flexWrap: 'wrap' }}>
        <TabBtn active={tab === 'new'} onClick={() => setTab('new')}>Nueva compra</TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>Historial</TabBtn>
        <TabBtn active={tab === 'returns'} onClick={() => setTab('returns')}>Devoluciones</TabBtn>
        <TabBtn active={tab === 'suppliers'} onClick={() => setTab('suppliers')}>Proveedores</TabBtn>
        <TabBtn active={tab === 'alerts'} onClick={() => setTab('alerts')}>Alertas</TabBtn>
      </div>
      {tab === 'new' && <NewPurchase />}
      {tab === 'history' && <History />}
      {tab === 'returns' && <Returns />}
      {tab === 'suppliers' && <Suppliers />}
      {tab === 'alerts' && <Alerts />}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 16px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        color: active ? 'var(--text)' : 'var(--text-dim)',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

/* ---------- Nueva compra ---------- */
function NewPurchase() {
  const { business, user } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [newContact, setNewContact] = useState('')
  const [newCompany, setNewCompany] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'transferencia' | 'credito'>('efectivo')
  const [tax, setTax] = useState(0)
  const [observations, setObservations] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10))
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [selProduct, setSelProduct] = useState('')
  const [manualName, setManualName] = useState('')
  const [qty, setQty] = useState(1)
  const [unitCost, setUnitCost] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!business) return
    fetchSuppliers(business.id).then(setSuppliers).catch(() => {})
    fetchProducts(business.id).then(setProducts).catch(() => {})
  }, [business])

  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const total = subtotal + tax

  const addItem = () => {
    setError(null)
    const q = Number(qty)
    const uc = Number(unitCost)
    if (!q || q <= 0) return setError('Cantidad inválida.')
    if (!uc || uc < 0) return setError('Precio unitario inválido.')
    let name = manualName.trim()
    let productId: string | null = null
    if (selProduct) {
      const p = products.find((x) => x.id === selProduct)
      if (!p) return setError('Producto no encontrado.')
      name = p.name
      productId = p.id
    }
    if (!name) return setError('Selecciona un producto o escribe su nombre.')
    setItems([...items, { product_id: productId, name, quantity: q, unit_cost: uc, total: q * uc }])
    setSelProduct(''); setManualName(''); setQty(1); setUnitCost(0)
  }

  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))

  const submit = async () => {
    setError(null); setSuccess(null)
    if (!business || !user) return
    if (items.length === 0) return setError('Agrega al menos un producto.')
    if (!supplierId && !newContact.trim()) return setError('Selecciona un proveedor o ingresa su nombre.')
    try {
      setBusy(true)
      await createPurchase(business.id, user.id, {
        supplier_id: supplierId || null,
        supplier_data: !supplierId ? {
          contact_name: newContact.trim(),
          company_name: newCompany.trim() || null,
          phone: newPhone.trim() || null,
        } : undefined,
        payment_method: paymentMethod,
        tax: Number(tax) || 0,
        observations,
        purchase_date: purchaseDate,
        items,
      })
      setSuccess('Compra registrada. Inventario actualizado.')
      setItems([]); setSupplierId(''); setNewContact(''); setNewCompany(''); setNewPhone('')
      setObservations(''); setTax(0)
      fetchProducts(business.id).then(setProducts).catch(() => {})
      fetchSuppliers(business.id).then(setSuppliers).catch(() => {})
    } catch (e: any) {
      setError(e.message || 'No se pudo registrar la compra.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 14 }}>Datos de la compra</h3>
        <div className="field-row">
          <div className="field">
            <label>Proveedor existente</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">— Nuevo proveedor —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.contact_name} {s.company_name ? `· ${s.company_name}` : ''}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Método de pago</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="credito">Crédito (pendiente)</option>
            </select>
          </div>
        </div>
        {!supplierId && (
          <div className="field-row">
            <div className="field">
              <label>Nombre del contacto *</label>
              <input value={newContact} onChange={(e) => setNewContact(e.target.value)} placeholder="Nombre del proveedor" />
            </div>
            <div className="field">
              <label>Empresa</label>
              <input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="field">
              <label>Teléfono</label>
              <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
        )}
        <div className="field-row">
          <div className="field">
            <label>Fecha de compra</label>
            <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Impuestos ($)</label>
            <input type="number" min={0} step="0.01" value={tax} onChange={(e) => setTax(Number(e.target.value))} />
          </div>
        </div>
        <div className="field">
          <label>Observaciones</label>
          <textarea rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} />
        </div>

        <h3 style={{ marginTop: 18, marginBottom: 12 }}>Agregar producto</h3>
        <div className="field-row">
          <div className="field">
            <label>Producto del inventario</label>
            <select value={selProduct} onChange={(e) => { setSelProduct(e.target.value); if (e.target.value) setManualName('') }}>
              <option value="">— Escribir manualmente —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Nombre del producto *</label>
            <input value={manualName} onChange={(e) => { setManualName(e.target.value); if (e.target.value) setSelProduct('') }} placeholder="Nombre" disabled={!!selProduct} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Cantidad</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Precio unitario ($)</label>
            <input type="number" min={0} step="0.01" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} />
          </div>
          <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={addItem}>+ Agregar</button>
          </div>
        </div>

        {items.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-dim)' }}>
                <th style={{ padding: '8px 6px' }}>Producto</th>
                <th style={{ padding: '8px 6px' }}>Cant.</th>
                <th style={{ padding: '8px 6px' }}>P. unit.</th>
                <th style={{ padding: '8px 6px' }}>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 6px' }}>{it.name}</td>
                  <td style={{ padding: '8px 6px' }}>{it.quantity}</td>
                  <td style={{ padding: '8px 6px' }}>${it.unit_cost.toFixed(2)}</td>
                  <td style={{ padding: '8px 6px' }}>${it.total.toFixed(2)}</td>
                  <td style={{ padding: '8px 6px' }}>
                    <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={() => removeItem(i)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ padding: 20, height: 'fit-content' }}>
        <h3 style={{ marginBottom: 14 }}>Resumen</h3>
        <Row label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
        <Row label="Impuestos" value={`$${(Number(tax) || 0).toFixed(2)}`} />
        <Row label="Total" value={`$${total.toFixed(2)}`} strong />
        <Row label="Pago" value={paymentMethod === 'credito' ? 'Crédito (pendiente)' : paymentMethod} />
        {error && <div className="error-text" style={{ marginTop: 10 }}>{error}</div>}
        {success && <div style={{ color: 'var(--success)', fontSize: 13, marginTop: 10 }}>{success}</div>}
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={busy || items.length === 0} onClick={submit}>
          {busy ? 'Guardando…' : 'Registrar compra'}
        </button>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Al registrar, el inventario aumenta y el costo del producto se actualiza al último precio de compra.
        </p>
      </div>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: strong ? 700 : 500 }}>{value}</span>
    </div>
  )
}

/* ---------- Historial ---------- */
function History() {
  const { business } = useAuth()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState<'all' | 'efectivo' | 'transferencia' | 'credito'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, PurchaseItem[]>>({})

  useEffect(() => {
    if (!business) return
    fetchPurchases(business.id).then(setPurchases).catch(() => {})
  }, [business])

  const filtered = useMemo(() => {
    return purchases.filter((p) => {
      if (method !== 'all' && p.payment_method !== method) return false
      if (from && p.purchase_date < from) return false
      if (to && p.purchase_date > to) return false
      if (search) {
        const q = search.toLowerCase()
        const sn = p.supplier?.contact_name || ''
        const co = p.supplier?.company_name || ''
        if (!sn.toLowerCase().includes(q) && !co.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [purchases, search, method, from, to])

  const toggle = async (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!items[id]) {
      const its = await fetchPurchaseItems(id)
      setItems({ ...items, [id]: its })
    }
  }

  const totalSpent = filtered.reduce((s, x) => s + Number(x.total), 0)

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Buscar por proveedor</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre o empresa" />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Método</label>
          <select value={method} onChange={(e) => setMethod(e.target.value as any)}>
            <option value="all">Todos</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="credito">Crédito</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 14 }}>
        <span className="muted">Resultados: <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong></span>
        <span className="muted">Total gastado: <strong style={{ color: 'var(--text)' }}>${totalSpent.toFixed(2)}</strong></span>
      </div>

      {filtered.length === 0 ? (
        <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>No hay compras que coincidan.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-dim)' }}>
              <th style={{ padding: '10px 8px' }}>Fecha</th>
              <th style={{ padding: '10px 8px' }}>Proveedor</th>
              <th style={{ padding: '10px 8px' }}>Método</th>
              <th style={{ padding: '10px 8px' }}>Total</th>
              <th style={{ padding: '10px 8px' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <PurchaseRow key={p.id} p={p} expanded={expanded} toggle={toggle} items={items} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function PurchaseRow({ p, expanded, toggle, items }: { p: Purchase; expanded: string | null; toggle: (id: string) => void; items: Record<string, PurchaseItem[]> }) {
  return (
    <>
      <tr style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => toggle(p.id)}>
        <td style={{ padding: '10px 8px' }}>{p.purchase_date}</td>
        <td style={{ padding: '10px 8px' }}>{p.supplier?.contact_name || 'Sin proveedor'}</td>
        <td style={{ padding: '10px 8px' }}>{p.payment_method}</td>
        <td style={{ padding: '10px 8px' }}>${Number(p.total).toFixed(2)}</td>
        <td style={{ padding: '10px 8px' }}><StatusBadge status={p.status} /></td>
      </tr>
      {expanded === p.id && (
        <tr>
          <td colSpan={5} style={{ padding: '12px 16px', background: 'var(--surface-2)' }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead><tr><th align="left">Producto</th><th>Cant.</th><th>P. unit.</th><th>Total</th></tr></thead>
              <tbody>
                {(items[p.id] || []).map((it, i) => (
                  <tr key={i}>
                    <td>{it.name}</td><td align="center">{it.quantity}</td>
                    <td align="right">${it.unit_cost.toFixed(2)}</td>
                    <td align="right">${it.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {p.observations && <p style={{ marginTop: 8 }} className="muted">Observaciones: {p.observations}</p>}
          </td>
        </tr>
      )}
    </>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { c: string; bg: string }> = {
    pagada: { c: 'var(--success)', bg: 'rgba(22,163,74,0.15)' },
    pendiente: { c: 'var(--warning)', bg: 'rgba(245,158,11,0.15)' },
    anulada: { c: 'var(--error)', bg: 'rgba(239,68,68,0.15)' },
  }
  const s = map[status] || map.pagada
  return <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: s.c, background: s.bg }}>{status}</span>
}

/* ---------- Devoluciones ---------- */
function Returns() {
  const { business, user } = useAuth()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [selPurchase, setSelPurchase] = useState('')
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [selItem, setSelItem] = useState('')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')
  const [refund, setRefund] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!business) return
    fetchPurchases(business.id).then(setPurchases).catch(() => {})
  }, [business])

  useEffect(() => {
    if (!selPurchase) { setItems([]); return }
    fetchPurchaseItems(selPurchase).then(setItems).catch(() => {})
  }, [selPurchase])

  useEffect(() => {
    const it = items.find((i) => i.id === selItem)
    if (it) { setQty(it.quantity); setRefund(it.total) }
  }, [selItem, items])

  const submit = async () => {
    setErr(null); setMsg(null)
    if (!business || !user) return
    if (!selPurchase) return setErr('Selecciona una compra.')
    if (!selItem) return setErr('Selecciona un producto a devolver.')
    const it = items.find((i) => i.id === selItem)
    if (!it) return setErr('Producto no encontrado.')
    if (qty > it.quantity) return setErr(`La cantidad excede lo comprado (${it.quantity}).`)
    try {
      setBusy(true)
      await createPurchaseReturn(business.id, user.id, {
        purchase_id: selPurchase,
        purchase_item_id: it.id || null,
        product_id: it.product_id,
        name: it.name,
        quantity: qty,
        reason,
        refund_amount: refund,
      })
      setMsg('Devolución registrada. Inventario ajustado.')
      setSelPurchase(''); setSelItem(''); setQty(1); setReason(''); setRefund(0)
    } catch (e: any) {
      setErr(e.message || 'No se pudo registrar la devolución.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: 20, maxWidth: 640 }}>
      <h3 style={{ marginBottom: 14 }}>Devolución de compra</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
        Selecciona la compra y el producto a devolver al proveedor. El inventario se reduce.
      </p>
      <div className="field">
        <label>Compra</label>
        <select value={selPurchase} onChange={(e) => setSelPurchase(e.target.value)}>
          <option value="">— Selecciona —</option>
          {purchases.map((p) => (
            <option key={p.id} value={p.id}>{p.purchase_date} · {p.supplier?.contact_name || 'Sin proveedor'} · ${Number(p.total).toFixed(2)}</option>
          ))}
        </select>
      </div>
      {selPurchase && (
        <div className="field">
          <label>Producto a devolver</label>
          <select value={selItem} onChange={(e) => setSelItem(e.target.value)}>
            <option value="">— Selecciona —</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{it.name} (compró {it.quantity})</option>
            ))}
          </select>
        </div>
      )}
      <div className="field-row">
        <div className="field">
          <label>Cantidad</label>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Monto a reembolsar ($)</label>
          <input type="number" min={0} step="0.01" value={refund} onChange={(e) => setRefund(Number(e.target.value))} />
        </div>
      </div>
      <div className="field">
        <label>Motivo</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Defecto, error, etc." />
      </div>
      {err && <div className="error-text" style={{ marginBottom: 10 }}>{err}</div>}
      {msg && <div style={{ color: 'var(--success)', fontSize: 13, marginBottom: 10 }}>{msg}</div>}
      <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Procesando…' : 'Registrar devolución'}</button>
    </div>
  )
}

/* ---------- Proveedores ---------- */
function Suppliers() {
  const { business } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState<Supplier | null>(null)
  const [detailPurchases, setDetailPurchases] = useState<Purchase[]>([])
  const [payAmount, setPayAmount] = useState(0)
  const [err, setErr] = useState<string | null>(null)

  const load = () => { if (business) fetchSuppliers(business.id).then(setSuppliers).catch(() => {}) }
  useEffect(load, [business])

  const openDetail = async (s: Supplier) => {
    setDetail(s)
    if (business) {
      const ps = await fetchSupplierPurchases(business.id, s.id)
      setDetailPurchases(ps)
    }
  }

  const doPay = async () => {
    setErr(null)
    if (!business || !detail) return
    if (payAmount <= 0) return setErr('Ingresa un monto válido.')
    try {
      await paySupplierLegacy(business.id, detail.id, payAmount)
      setPayAmount(0)
      load()
      if (business) {
        const ps = await fetchSupplierPurchases(business.id, detail.id)
        setDetailPurchases(ps)
        const updated = (await fetchSuppliers(business.id)).find((x) => x.id === detail.id) || null
        setDetail(updated)
      }
    } catch (e: any) {
      setErr(e.message)
    }
  }

  const doDelete = async (id: string) => {
    if (!confirm('¿Eliminar este proveedor?')) return
    await deleteSupplier(id)
    load()
  }

  const totalOwed = suppliers.reduce((s, x) => s + Number(x.balance), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <span className="muted" style={{ fontSize: 14 }}>Total pendiente a proveedores: </span>
          <strong style={{ color: 'var(--warning)' }}>${totalOwed.toFixed(2)}</strong>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>+ Nuevo proveedor</button>
      </div>

      {showForm && (
        <SupplierForm
          existing={editing}
          onCancel={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); load() }}
        />
      )}

      {suppliers.length === 0 && !showForm ? (
        <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>No hay proveedores registrados.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {suppliers.map((s) => (
            <div key={s.id} className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{s.contact_name}</div>
              {s.company_name && <div className="muted" style={{ fontSize: 13 }}>{s.company_name}</div>}
              {s.phone && <div style={{ fontSize: 13, marginTop: 6 }}>Tel: {s.phone}</div>}
              {s.email && <div style={{ fontSize: 13 }}>{s.email}</div>}
              {s.products_supplied && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Suministra: {s.products_supplied}</div>}
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>
                  Saldo: <strong style={{ color: Number(s.balance) > 0 ? 'var(--warning)' : 'var(--success)' }}>${Number(s.balance).toFixed(2)}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={() => openDetail(s)}>Detalle</button>
                <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => { setEditing(s); setShowForm(true) }}>Editar</button>
                <button className="btn btn-ghost" style={{ fontSize: 13, color: 'var(--error)' }} onClick={() => doDelete(s.id)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <Modal onClose={() => setDetail(null)} title={`Detalle — ${detail.contact_name}`}>
          <div style={{ fontSize: 14, marginBottom: 16 }}>
            {detail.company_name && <div><strong>Empresa:</strong> {detail.company_name}</div>}
            {detail.phone && <div><strong>Teléfono:</strong> {detail.phone}</div>}
            {detail.email && <div><strong>Correo:</strong> {detail.email}</div>}
            {detail.address && <div><strong>Dirección:</strong> {detail.address}</div>}
            {detail.products_supplied && <div><strong>Suministra:</strong> {detail.products_supplied}</div>}
            {detail.observations && <div className="muted" style={{ marginTop: 6 }}><strong>Notas:</strong> {detail.observations}</div>}
            <div style={{ marginTop: 10 }}><strong>Saldo pendiente:</strong> <span style={{ color: Number(detail.balance) > 0 ? 'var(--warning)' : 'var(--success)' }}>${Number(detail.balance).toFixed(2)}</span></div>
          </div>

          {Number(detail.balance) > 0 && (
            <div className="card" style={{ padding: 14, marginBottom: 16 }}>
              <label>Registrar pago</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} placeholder="Monto $" />
                <button className="btn btn-primary" onClick={doPay}>Pagar</button>
              </div>
              {err && <div className="error-text" style={{ marginTop: 6 }}>{err}</div>}
            </div>
          )}

          <h4 style={{ marginBottom: 8 }}>Historial de compras</h4>
          {detailPurchases.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Sin compras registradas.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--text-dim)' }}><th style={{ padding: 6 }}>Fecha</th><th style={{ padding: 6 }}>Método</th><th style={{ padding: 6 }}>Total</th><th style={{ padding: 6 }}>Estado</th></tr></thead>
              <tbody>
                {detailPurchases.map((p) => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: 6 }}>{p.purchase_date}</td>
                    <td style={{ padding: 6 }}>{p.payment_method}</td>
                    <td style={{ padding: 6 }}>${Number(p.total).toFixed(2)}</td>
                    <td style={{ padding: 6 }}>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  )
}

function SupplierForm({ existing, onCancel, onSaved }: { existing: Supplier | null; onCancel: () => void; onSaved: () => void }) {
  const { business } = useAuth()
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
    if (!business) return
    if (!contactName.trim()) return setErr('El nombre del contacto es obligatorio.')
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
      else await createSupplier(business.id, data)
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
          <label>Correo electrónico</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Dirección</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="field">
        <label>Productos que suministra</label>
        <input value={productsSupplied} onChange={(e) => setProductsSupplied(e.target.value)} placeholder="Ej. Harina, azúcar, aceite" />
      </div>
      <div className="field">
        <label>Observaciones</label>
        <textarea rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} />
      </div>
      {err && <div className="error-text" style={{ marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

/* ---------- Alertas ---------- */
function Alerts() {
  const { business } = useAuth()
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    if (!business) return
    fetchProducts(business.id).then(setProducts).catch(() => {})
  }, [business])

  const lowStock = products.filter((p) => p.stock <= p.min_stock)
  const outOfStock = products.filter((p) => p.stock <= 0)

  return (
    <div>
      {outOfStock.length > 0 && (
        <div className="card" style={{ padding: 18, marginBottom: 16, borderColor: 'var(--error)' }}>
          <h3 style={{ color: 'var(--error)', marginBottom: 10 }}>Agotados</h3>
          {outOfStock.map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
              <span>{p.name}</span>
              <span style={{ color: 'var(--error)' }}>Stock: {p.stock} {p.unit}</span>
            </div>
          ))}
        </div>
      )}
      {lowStock.length > 0 && (
        <div className="card" style={{ padding: 18, marginBottom: 16, borderColor: 'var(--warning)' }}>
          <h3 style={{ color: 'var(--warning)', marginBottom: 10 }}>Por agotarse</h3>
          {lowStock.filter((p) => p.stock > 0).map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
              <span>{p.name}</span>
              <span style={{ color: 'var(--warning)' }}>Stock: {p.stock} {p.unit} (mín: {p.min_stock})</span>
            </div>
          ))}
        </div>
      )}
      {lowStock.length === 0 && outOfStock.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p className="muted">No hay alertas. Todos los productos tienen stock suficiente.</p>
        </div>
      )}
    </div>
  )
}

/* ---------- Modal ---------- */
function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20 }}
    >
      <div className="card" style={{ maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3>{title}</h3>
          <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={onClose}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}
