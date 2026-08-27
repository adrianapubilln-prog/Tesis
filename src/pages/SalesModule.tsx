import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import {
  fetchClients, createClient, fetchProducts, fetchSales, fetchSaleItems,
  createSale, createReturn, updateSaleStatus, type Client, type Product,
  type Sale, type SaleItem,
} from '../lib/sales'

type Tab = 'new' | 'history' | 'returns' | 'reports'

export default function SalesModule() {
  const [tab, setTab] = useState<Tab>('new')
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <span className="badge">Módulo de Ventas</span>
        <h1 style={{ fontSize: 26, marginTop: 8 }}>Ventas</h1>
        <p className="muted" style={{ fontSize: 14 }}>Registra lo que vendes, consulta historial, gestiona devoluciones y reportes.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <TabBtn active={tab === 'new'} onClick={() => setTab('new')}>Nueva venta</TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>Historial</TabBtn>
        <TabBtn active={tab === 'returns'} onClick={() => setTab('returns')}>Devoluciones</TabBtn>
        <TabBtn active={tab === 'reports'} onClick={() => setTab('reports')}>Reportes IA</TabBtn>
      </div>
      {tab === 'new' && <NewSale />}
      {tab === 'history' && <History />}
      {tab === 'returns' && <Returns />}
      {tab === 'reports' && <Reports />}
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

/* ---------- Nueva venta ---------- */
function NewSale() {
  const { business, user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [clientId, setClientId] = useState<string>('')
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [paymentType, setPaymentType] = useState<'efectivo' | 'credito'>('efectivo')
  const [tax, setTax] = useState(0)
  const [observations, setObservations] = useState('')
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10))
  const [items, setItems] = useState<SaleItem[]>([])
  const [selProduct, setSelProduct] = useState<string>('')
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!business) return
    fetchClients(business.id).then(setClients).catch(() => {})
    fetchProducts(business.id).then(setProducts).catch(() => {})
  }, [business])

  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const total = subtotal + tax
  const profit = items.reduce((s, i) => s + i.profit, 0)

  const addItem = () => {
    setError(null)
    if (!selProduct) return setError('Selecciona un producto.')
    const p = products.find((x) => x.id === selProduct)
    if (!p) return setError('Producto no encontrado.')
    const q = Number(qty)
    if (!q || q <= 0) return setError('Cantidad inválida.')
    if (q > p.stock) return setError(`Stock insuficiente. Disponible: ${p.stock} ${p.unit}.`)
    setItems([
      ...items,
      {
        product_id: p.id,
        name: p.name,
        quantity: q,
        unit_price: p.sale_price,
        unit_cost: p.cost,
        profit: (p.sale_price - p.cost) * q,
        total: p.sale_price * q,
      },
    ])
    setSelProduct('')
    setQty(1)
  }

  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))

  const submit = async () => {
    setError(null)
    setSuccess(null)
    if (!business || !user) return
    if (items.length === 0) return setError('Agrega al menos un producto.')
    let finalClientId: string | null = clientId || null
    try {
      setBusy(true)
      // If a new client name was typed, create the client first
      if (!finalClientId && newClientName.trim()) {
        const c = await createClient(business.id, {
          name: newClientName.trim(),
          phone: newClientPhone.trim() || null,
        } as any)
        finalClientId = c.id
      }
      const res = await createSale(business.id, user.id, {
        client_id: finalClientId,
        client_name: newClientName.trim() || undefined,
        payment_type: paymentType,
        tax: Number(tax) || 0,
        observations,
        sale_date: saleDate,
        items,
      })
      setSuccess(`Venta registrada. Factura ${res.invoiceNumber}`)
      // Reset
      setItems([])
      setClientId('')
      setNewClientName('')
      setNewClientPhone('')
      setObservations('')
      setTax(0)
      // Refresh products (stock changed)
      fetchProducts(business.id).then(setProducts).catch(() => {})
      fetchClients(business.id).then(setClients).catch(() => {})
    } catch (e: any) {
      setError(e.message || 'No se pudo registrar la venta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 14 }}>Datos de la venta</h3>
        <div className="field-row">
          <div className="field">
            <label>Cliente existente</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— Sin cliente / nuevo —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Tipo de pago</label>
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as any)}>
              <option value="efectivo">Efectivo</option>
              <option value="credito">Crédito</option>
            </select>
          </div>
        </div>
        {!clientId && (
          <div className="field-row">
            <div className="field">
              <label>Nombre del nuevo cliente</label>
              <input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="field">
              <label>Teléfono</label>
              <input value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
        )}
        <div className="field-row">
          <div className="field">
            <label>Fecha de venta</label>
            <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Impuestos ($)</label>
            <input type="number" min={0} step="0.01" value={tax} onChange={(e) => setTax(Number(e.target.value))} />
          </div>
        </div>
        <div className="field">
          <label>Observaciones / notas</label>
          <textarea rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} />
        </div>

        <h3 style={{ marginTop: 18, marginBottom: 12 }}>Agregar producto</h3>
        <div className="field-row">
          <div className="field" style={{ flex: 2 }}>
            <label>Producto</label>
            <select value={selProduct} onChange={(e) => setSelProduct(e.target.value)}>
              <option value="">— Selecciona —</option>
              {products.filter((p) => p.active && p.stock > 0).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ${p.sale_price} ({p.stock} {p.unit})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Cantidad</label>
            <input type="number" min={1} step="1" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
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
                <th style={{ padding: '8px 6px' }}>Ganancia</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 6px' }}>{it.name}</td>
                  <td style={{ padding: '8px 6px' }}>{it.quantity}</td>
                  <td style={{ padding: '8px 6px' }}>${it.unit_price.toFixed(2)}</td>
                  <td style={{ padding: '8px 6px' }}>${it.total.toFixed(2)}</td>
                  <td style={{ padding: '8px 6px', color: 'var(--accent)' }}>${it.profit.toFixed(2)}</td>
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
        <Row label="Ganancia" value={`$${profit.toFixed(2)}`} accent />
        <Row label="Pago" value={paymentType === 'efectivo' ? 'Efectivo' : 'Crédito'} />
        {error && <div className="error-text" style={{ marginTop: 10 }}>{error}</div>}
        {success && <div style={{ color: 'var(--success)', fontSize: 13, marginTop: 10 }}>{success}</div>}
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={busy || items.length === 0} onClick={submit}>
          {busy ? 'Guardando…' : 'Registrar venta'}
        </button>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Se genera automáticamente la factura con número correlativo. Las ventas a crédito quedan como pendientes de pago.
        </p>
      </div>
    </div>
  )
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: strong ? 700 : 500, color: accent ? 'var(--accent)' : 'var(--text)' }}>{value}</span>
    </div>
  )
}

/* ---------- Historial ---------- */
function History() {
  const { business } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'efectivo' | 'credito'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, SaleItem[]>>({})

  useEffect(() => {
    if (!business) return
    fetchSales(business.id).then(setSales).catch(() => {})
  }, [business])

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      if (filterType !== 'all' && s.payment_type !== filterType) return false
      if (from && s.sale_date < from) return false
      if (to && s.sale_date > to) return false
      if (search) {
        const q = search.toLowerCase()
        const clientName = s.client?.name || ''
        const invoice = s.invoice_number || ''
        if (!clientName.toLowerCase().includes(q) && !invoice.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [sales, search, filterType, from, to])

  const toggle = async (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!items[id]) {
      const its = await fetchSaleItems(id)
      setItems({ ...items, [id]: its })
    }
  }

  const totalSales = filtered.reduce((s, x) => s + Number(x.total), 0)
  const totalProfit = filtered.reduce((s, x) => s + Number(x.profit), 0)

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Buscar por cliente o factura</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre o FAC-…" />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Tipo</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
            <option value="all">Todos</option>
            <option value="efectivo">Efectivo</option>
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
        <span className="muted">Total: <strong style={{ color: 'var(--text)' }}>${totalSales.toFixed(2)}</strong></span>
        <span className="muted">Ganancia: <strong style={{ color: 'var(--accent)' }}>${totalProfit.toFixed(2)}</strong></span>
      </div>

      {filtered.length === 0 ? (
        <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>
          No hay ventas que coincidan con los filtros.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-dim)' }}>
              <th style={{ padding: '10px 8px' }}>Factura</th>
              <th style={{ padding: '10px 8px' }}>Fecha</th>
              <th style={{ padding: '10px 8px' }}>Cliente</th>
              <th style={{ padding: '10px 8px' }}>Tipo</th>
              <th style={{ padding: '10px 8px' }}>Total</th>
              <th style={{ padding: '10px 8px' }}>Ganancia</th>
              <th style={{ padding: '10px 8px' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <>
                <tr
                  key={s.id}
                  style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => toggle(s.id)}
                >
                  <td style={{ padding: '10px 8px' }}>{s.invoice_number || '—'}</td>
                  <td style={{ padding: '10px 8px' }}>{s.sale_date}</td>
                  <td style={{ padding: '10px 8px' }}>{s.client?.name || 'Consumidor final'}</td>
                  <td style={{ padding: '10px 8px' }}>{s.payment_type === 'efectivo' ? 'Efectivo' : 'Crédito'}</td>
                  <td style={{ padding: '10px 8px' }}>${Number(s.total).toFixed(2)}</td>
                  <td style={{ padding: '10px 8px', color: 'var(--accent)' }}>${Number(s.profit).toFixed(2)}</td>
                  <td style={{ padding: '10px 8px' }}><StatusBadge status={s.status} /></td>
                </tr>
                {expanded === s.id && (
                  <tr>
                    <td colSpan={7} style={{ padding: '12px 16px', background: 'var(--surface-2)' }}>
                      <div style={{ fontSize: 13 }}>
                        <strong>Detalle:</strong>
                        <table style={{ width: '100%', marginTop: 8 }}>
                          <thead><tr><th align="left">Producto</th><th>Cant.</th><th>P. unit.</th><th>Total</th><th>Ganancia</th></tr></thead>
                          <tbody>
                            {(items[s.id] || []).map((it, i) => (
                              <tr key={i}>
                                <td>{it.name}</td><td align="center">{it.quantity}</td>
                                <td align="right">${it.unit_price.toFixed(2)}</td>
                                <td align="right">${it.total.toFixed(2)}</td>
                                <td align="right">${it.profit.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {s.observations && <p style={{ marginTop: 8 }} className="muted">Observaciones: {s.observations}</p>}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { c: string; bg: string }> = {
    pagada: { c: 'var(--success)', bg: 'rgba(22,163,74,0.15)' },
    pendiente: { c: 'var(--warning)', bg: 'rgba(245,158,11,0.15)' },
    anulada: { c: 'var(--error)', bg: 'rgba(239,68,68,0.15)' },
  }
  const s = map[status] || map.pagada
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: s.c, background: s.bg }}>
      {status}
    </span>
  )
}

/* ---------- Devoluciones ---------- */
function Returns() {
  const { business, user } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [selSale, setSelSale] = useState<string>('')
  const [items, setItems] = useState<SaleItem[]>([])
  const [selItem, setSelItem] = useState<string>('')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')
  const [refund, setRefund] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!business) return
    fetchSales(business.id).then(setSales).catch(() => {})
  }, [business])

  useEffect(() => {
    if (!selSale) { setItems([]); return }
    fetchSaleItems(selSale).then(setItems).catch(() => {})
  }, [selSale])

  useEffect(() => {
    const it = items.find((i) => i.id === selItem)
    if (it) {
      setQty(it.quantity)
      setRefund(it.total)
    }
  }, [selItem, items])

  const submit = async () => {
    setErr(null); setMsg(null)
    if (!business || !user) return
    if (!selSale) return setErr('Selecciona una venta.')
    if (!selItem) return setErr('Selecciona un producto a devolver.')
    const it = items.find((i) => i.id === selItem)
    if (!it) return setErr('Producto no encontrado.')
    if (qty > it.quantity) return setErr(`La cantidad excede lo vendido (${it.quantity}).`)
    try {
      setBusy(true)
      await createReturn(business.id, user.id, {
        sale_id: selSale,
        sale_item_id: it.id || null,
        product_id: it.product_id,
        name: it.name,
        quantity: qty,
        reason,
        refund_amount: refund,
      })
      setMsg('Devolución registrada. Inventario actualizado y reembolso registrado.')
      setSelSale(''); setSelItem(''); setQty(1); setReason(''); setRefund(0)
    } catch (e: any) {
      setErr(e.message || 'No se pudo registrar la devolución.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: 20, maxWidth: 640 }}>
      <h3 style={{ marginBottom: 14 }}>Registrar devolución / reembolso</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
        Selecciona la venta y el producto a devolver. El inventario se restaura y se registra el reembolso al cliente.
      </p>
      <div className="field">
        <label>Venta</label>
        <select value={selSale} onChange={(e) => setSelSale(e.target.value)}>
          <option value="">— Selecciona —</option>
          {sales.map((s) => (
            <option key={s.id} value={s.id}>
              {s.invoice_number || s.id.slice(0, 8)} · {s.sale_date} · ${Number(s.total).toFixed(2)}
            </option>
          ))}
        </select>
      </div>
      {selSale && (
        <div className="field">
          <label>Producto a devolver</label>
          <select value={selItem} onChange={(e) => setSelItem(e.target.value)}>
            <option value="">— Selecciona —</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{it.name} (vendió {it.quantity})</option>
            ))}
          </select>
        </div>
      )}
      <div className="field-row">
        <div className="field">
          <label>Cantidad a devolver</label>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Monto a reembolsar ($)</label>
          <input type="number" min={0} step="0.01" value={refund} onChange={(e) => setRefund(Number(e.target.value))} />
        </div>
      </div>
      <div className="field">
        <label>Motivo</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Producto defectuoso, error, etc." />
      </div>
      {err && <div className="error-text" style={{ marginBottom: 10 }}>{err}</div>}
      {msg && <div style={{ color: 'var(--success)', fontSize: 13, marginBottom: 10 }}>{msg}</div>}
      <button className="btn btn-primary" disabled={busy} onClick={submit}>
        {busy ? 'Procesando…' : 'Registrar devolución'}
      </button>
    </div>
  )
}

/* ---------- Reportes IA ---------- */
function Reports() {
  const { business } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [period, setPeriod] = useState<'week' | 'month'>('month')
  const [analysis, setAnalysis] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!business) return
    fetchSales(business.id).then(setSales).catch(() => {})
  }, [business])

  const generate = () => {
    setLoading(true)
    // Local "IA" analysis based on the sales data
    const now = new Date()
    const cutoff = new Date()
    if (period === 'week') cutoff.setDate(now.getDate() - 7)
    else cutoff.setMonth(now.getMonth() - 1)

    const periodSales = sales.filter((s) => new Date(s.sale_date) >= cutoff && s.status !== 'anulada')
    const total = periodSales.reduce((s, x) => s + Number(x.total), 0)
    const profit = periodSales.reduce((s, x) => s + Number(x.profit), 0)
    const cash = periodSales.filter((s) => s.payment_type === 'efectivo').reduce((s, x) => s + Number(x.total), 0)
    const credit = periodSales.filter((s) => s.payment_type === 'credito').reduce((s, x) => s + Number(x.total), 0)
    const avg = periodSales.length ? total / periodSales.length : 0

    // Product ranking
    const prodMap: Record<string, { qty: number; total: number; profit: number }> = {}
    periodSales.forEach((s) => {
      ;(s.items || []).forEach((it) => {
        const key = it.name
        if (!prodMap[key]) prodMap[key] = { qty: 0, total: 0, profit: 0 }
        prodMap[key].qty += it.quantity
        prodMap[key].total += it.total
        prodMap[key].profit += it.profit
      })
    })
    const ranking = Object.entries(prodMap).sort((a, b) => b[1].total - a[1].total).slice(0, 5)

    const lines: string[] = []
    lines.push(`📊 Análisis ${period === 'week' ? 'semanal' : 'mensual'} — ${business?.name}`)
    lines.push(`• Ventas registradas: ${periodSales.length}`)
    lines.push(`• Ingresos totales: $${total.toFixed(2)}`)
    lines.push(`• Ganancia neta: $${profit.toFixed(2)} (${total ? ((profit / total) * 100).toFixed(1) : 0}% de margen)`)
    lines.push(`• Promedio por venta: $${avg.toFixed(2)}`)
    lines.push(`• Ventas al contado: $${cash.toFixed(2)} · Ventas a crédito: $${credit.toFixed(2)}`)
    lines.push('')
    lines.push('🏆 Productos más rentables:')
    if (ranking.length === 0) lines.push('   Aún no hay datos suficientes.')
    ranking.forEach(([name, d], i) => {
      lines.push(`   ${i + 1}. ${name} — ${d.qty} u. · $${d.total.toFixed(2)} · ganancia $${d.profit.toFixed(2)}`)
    })
    lines.push('')
    // Recommendations
    lines.push('💡 Recomendaciones automáticas:')
    if (credit > cash * 0.5) lines.push('   • Tienes una proporción alta de ventas a crédito. Considera cobrar saldos pendientes para mejorar tu flujo de caja.')
    if (profit / (total || 1) < 0.2) lines.push('   • Tu margen de ganancia es bajo. Revisa tus costos o ajusta precios.')
    if (periodSales.length === 0) lines.push('   • No hay ventas en el período. Registra tu primera venta para ver análisis.')
    if (periodSales.length > 0 && profit / (total || 1) >= 0.3) lines.push('   • Buen margen de ganancia. Sigue así y considera reinvertir en inventario de tus productos más rentables.')
    lines.push('')
    lines.push(`Generado el ${now.toLocaleString('es-SV')}.`)

    setAnalysis(lines.join('\n'))
    setLoading(false)
  }

  return (
    <div>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 10 }}>Reporte con análisis IA</h3>
        <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>
          Genera un reporte semanal o mensual con análisis automático de tus ventas, ganancias y recomendaciones.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Período</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value as any)}>
              <option value="week">Semanal (últimos 7 días)</option>
              <option value="month">Mensual (últimos 30 días)</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={generate} disabled={loading}>
            {loading ? 'Analizando…' : 'Generar reporte'}
          </button>
        </div>
      </div>
      {analysis && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 12 }}>Resultado del análisis</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font)', fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>
            {analysis}
          </pre>
        </div>
      )}
    </div>
  )
}
