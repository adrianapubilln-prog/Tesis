import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts'
import { useAuth } from '../lib/auth'
import {
  fetchDashboardKPIs, fetchCashflow, fetchTopProducts, fetchRecentActivity,
  type DashboardKPIs, type CashflowPoint, type TopProduct, type ActivityItem,
} from '../lib/dashboard'
import { fetchProducts, type Product } from '../lib/sales'
import { createSale } from '../lib/sales'
import { createExpense } from '../lib/expenses'
import { createPurchase } from '../lib/purchases'
import { adjustStock } from '../lib/inventory'

const PIE_COLORS = ['#22D0F7', '#2198C1', '#1C2A38', '#4A4A4A', '#8B9197', '#16A34A', '#F59E0B', '#EF4444']

export default function Dashboard() {
  const { business, membership, user } = useAuth()
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null)
  const [cashflow, setCashflow] = useState<CashflowPoint[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [lowStock, setLowStock] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [quickOpen, setQuickOpen] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!business) return
    setLoading(true)
    Promise.all([
      fetchDashboardKPIs(business.id),
      fetchCashflow(business.id),
      fetchTopProducts(business.id, 5),
      fetchRecentActivity(business.id, 8),
      fetchProducts(business.id),
    ]).then(([k, cf, tp, act, prods]) => {
      setKpis(k)
      setCashflow(cf)
      setTopProducts(tp)
      setActivity(act)
      setLowStock(prods.filter((p) => p.stock <= p.min_stock))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [business])

  useEffect(load, [load])

  const monthLabel = new Date().toLocaleDateString('es-SV', { month: 'long', year: 'numeric' })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>Hola, {membership?.name || user?.email}</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            {business?.name} · {business?.type === 'productora' ? 'Productora' : 'Comercial'} · <span style={{ textTransform: 'capitalize' }}>{monthLabel}</span>
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setQuickOpen('sale')} style={{ padding: '10px 20px', fontSize: 14 }}>
          + Acción rápida
        </button>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="card muted" style={{ padding: 32, textAlign: 'center' }}>Cargando resumen…</div>
      ) : (
        <>
          <div className="dash-grid dash-4" style={{ marginBottom: 16 }}>
            <KPICard
              label="Ventas de hoy"
              value={`$${(kpis?.today_sales || 0).toFixed(2)}`}
              hint={`${kpis?.sales_this_month || 0} ventas este mes`}
              icon="💰"
              iconBg="rgba(34,208,247,0.15)"
              iconColor="#2198C1"
            />
            <KPICard
              label="Ingresos del mes"
              value={`$${(kpis?.month_sales || 0).toFixed(2)}`}
              hint={`Utilidad: $${(kpis?.month_profit || 0).toFixed(2)}`}
              icon="📈"
              iconBg="rgba(33,152,193,0.15)"
              iconColor="#2198C1"
            />
            <KPICard
              label="Gastos del mes"
              value={`$${(kpis?.month_expenses || 0).toFixed(2)}`}
              hint={`${kpis?.expenses_this_month || 0} gastos registrados`}
              icon="📉"
              iconBg="rgba(245,158,11,0.15)"
              iconColor="#F59E0B"
            />
            <KPICard
              label="Ganancia neta"
              value={`$${(kpis?.net_profit || 0).toFixed(2)}`}
              hint={kpis && kpis.month_sales > 0 ? `${((kpis.net_profit / kpis.month_sales) * 100).toFixed(1)}% margen` : 'Sin ventas aún'}
              icon="🏦"
              iconBg={kpis && kpis.net_profit >= 0 ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.15)'}
              iconColor={kpis && kpis.net_profit >= 0 ? '#16A34A' : '#EF4444'}
            />
          </div>

          {/* Secondary KPIs */}
          <div className="dash-grid dash-4" style={{ marginBottom: 16 }}>
            <MiniStat label="Por cobrar (clientes)" value={`${(kpis?.pending_client_balance || 0).toFixed(2)}`} color="#F59E0B" />
            <MiniStat label="Por pagar (proveedores)" value={`${(kpis?.pending_supplier_balance || 0).toFixed(2)}`} color="#EF4444" />
            <MiniStat label="Valor de inventario" value={`${(kpis?.inventory_value || 0).toFixed(2)}`} color="#2198C1" />
            <MiniStat label="Alertas de stock" value={String(kpis?.low_stock_count || 0)} color={kpis && kpis.low_stock_count > 0 ? '#EF4444' : '#16A34A'} />
          </div>

          {/* Quick Actions */}
          <div className="card chart-card" style={{ marginBottom: 16 }}>
            <h3>Accesos rápidos</h3>
            <p className="chart-sub">Ingresa datos rápidamente sin salir del dashboard</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              <QuickAction icon="🧾" label="Nueva venta" desc="Registrar venta" onClick={() => setQuickOpen('sale')} />
              <QuickAction icon="📦" label="Nueva compra" desc="Registrar compra" onClick={() => setQuickOpen('purchase')} />
              <QuickAction icon="💸" label="Nuevo gasto" desc="Registrar gasto" onClick={() => setQuickOpen('expense')} />
              <QuickAction icon="🔄" label="Ajustar stock" desc="Entrada/salida" onClick={() => setQuickOpen('stock')} />
              <QuickAction icon="👤" label="Nuevo cliente" desc="Agregar cliente" onClick={() => setQuickOpen('client')} />
            </div>
          </div>

          {/* Charts row */}
          <div className="dash-grid dash-2-1" style={{ marginBottom: 16 }}>
            {/* Cashflow chart */}
            <div className="card chart-card">
              <h3>Flujo de fondos</h3>
              <p className="chart-sub">Ingresos vs gastos de los últimos meses</p>
              {cashflow.length === 0 ? (
                <EmptyChart text="Sin datos suficientes para mostrar el flujo de fondos." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={cashflow} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22D0F7" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#22D0F7" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(2)}`} />
                    <Legend />
                    <Area type="monotone" dataKey="income" name="Ingresos" stroke="#22D0F7" strokeWidth={2} fill="url(#gIncome)" />
                    <Area type="monotone" dataKey="expenses" name="Gastos" stroke="#F59E0B" strokeWidth={2} fill="url(#gExpenses)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top products pie */}
            <div className="card chart-card">
              <h3>Top productos</h3>
              <p className="chart-sub">Por ingresos generados</p>
              {topProducts.length === 0 ? (
                <EmptyChart text="Aún no hay ventas para mostrar productos top." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={topProducts}
                      dataKey="total_revenue"
                      nameKey="product_name"
                      cx="50%" cy="50%"
                      outerRadius={90} innerRadius={40}
                      paddingAngle={3}
                    >
                      {topProducts.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `${Number(v).toFixed(2)}`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Bottom row: bar chart + activity feed */}
          <div className="dash-grid dash-2-1" style={{ marginBottom: 16 }}>
            {/* Profit bar chart */}
            <div className="card chart-card">
              <h3>Utilidad mensual</h3>
              <p className="chart-sub">Ganancia neta por mes</p>
              {cashflow.length === 0 ? (
                <EmptyChart text="Sin datos de utilidad todavía." />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={cashflow} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(2)}`} />
                    <Bar dataKey="net" name="Utilidad neta" radius={[4, 4, 0, 0]}>
                      {cashflow.map((entry, i) => (
                        <Cell key={i} fill={entry.net >= 0 ? '#2198C1' : '#EF4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Activity feed */}
            <div className="card chart-card">
              <h3>Actividad reciente</h3>
              <p className="chart-sub">Últimos movimientos</p>
              {activity.length === 0 ? (
                <p className="muted" style={{ fontSize: 13, padding: '20px 0' }}>Sin actividad reciente.</p>
              ) : (
                activity.map((a, i) => <ActivityRow key={i} item={a} />)
              )}
            </div>
          </div>

          {/* Low stock alerts */}
          {lowStock.length > 0 && (
            <div className="card chart-card" style={{ borderColor: 'var(--warning)' }}>
              <h3 style={{ color: 'var(--warning)' }}>Alertas de inventario</h3>
              <p className="chart-sub">{lowStock.length} producto(s) con stock bajo el mínimo</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {lowStock.slice(0, 8).map((p) => (
                  <Link key={p.id} to="/inventario" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text)' }}>{p.name}</span>
                    <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{p.stock} {p.unit}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick action modals */}
      {quickOpen && (
        <QuickModal type={quickOpen} onClose={() => setQuickOpen(null)} onDone={() => { setQuickOpen(null); load() }} />
      )}
    </div>
  )
}

/* ===== Sub-components ===== */

function KPICard({ label, value, hint, icon, iconBg, iconColor }: {
  label: string; value: string; hint: string; icon: string; iconBg: string; iconColor: string
}) {
  return (
    <div className="card kpi-card">
      <div className="kpi-icon" style={{ background: iconBg, color: iconColor }}>{icon}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color: iconColor }}>{value}</div>
      <div className="kpi-hint">{hint}</div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="kpi-label">{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color }}>{value}</div>
    </div>
  )
}

function QuickAction({ icon, label, desc, onClick }: { icon: string; label: string; desc: string; onClick: () => void }) {
  return (
    <div className="quick-action" onClick={onClick}>
      <div className="qa-icon" style={{ background: 'rgba(34,208,247,0.15)', color: '#2198C1' }}>{icon}</div>
      <div className="qa-label">{label}</div>
      <div className="qa-desc">{desc}</div>
    </div>
  )
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const config = {
    sale: { icon: '🧾', bg: 'rgba(34,208,247,0.15)', color: '#2198C1', label: 'Venta' },
    purchase: { icon: '📦', bg: 'rgba(33,152,193,0.15)', color: '#2198C1', label: 'Compra' },
    expense: { icon: '💸', bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', label: 'Gasto' },
  }
  const c = config[item.activity_type] || config.sale
  return (
    <div className="activity-row">
      <div className="activity-dot" style={{ background: c.bg, color: c.color }}>{c.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.label} · {item.reference || '—'}</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.activity_date} · {item.status}</div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: item.activity_type === 'expense' ? '#F59E0B' : 'var(--text)' }}>
        ${Number(item.amount).toFixed(2)}
      </div>
    </div>
  )
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div style={{ height: 200, display: 'grid', placeItems: 'center' }}>
      <p className="muted" style={{ fontSize: 13, textAlign: 'center' }}>{text}</p>
    </div>
  )
}

/* ===== Quick Action Modal ===== */

function QuickModal({ type, onClose, onDone }: { type: string; onClose: () => void; onDone: () => void }) {
  const { business, user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Form state
  const [selProduct, setSelProduct] = useState('')
  const [qty, setQty] = useState(1)
  const [unitPrice, setUnitPrice] = useState(0)
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState(0)
  const [payMethod, setPayMethod] = useState('efectivo')
  const [moveType, setMoveType] = useState<'entrada' | 'salida'>('entrada')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (business && (type === 'sale' || type === 'stock' || type === 'purchase')) {
      fetchProducts(business.id).then(setProducts).catch(() => {})
    }
  }, [business, type])

  const product = products.find((p) => p.id === selProduct)

  const submit = async () => {
    if (!business || !user) return
    setErr(null); setBusy(true)
    try {
      if (type === 'sale') {
        if (!selProduct || !product) throw new Error('Selecciona un producto')
        await createSale(business.id, user.id, {
          client_id: null,
          payment_type: 'efectivo',
          tax: 0,
          observations: '',
          sale_date: new Date().toISOString().slice(0, 10),
          items: [{
            product_id: product.id,
            name: product.name,
            quantity: Number(qty),
            unit_price: Number(unitPrice) || product.sale_price,
            unit_cost: product.cost,
            profit: (Number(unitPrice) || Number(product.sale_price) - Number(product.cost)) * Number(qty),
            total: (Number(unitPrice) || Number(product.sale_price)) * Number(qty),
          }],
        })
      } else if (type === 'expense') {
        if (!desc.trim() || amount <= 0) throw new Error('Describe el gasto y el monto')
        await createExpense(business.id, user.id, {
          category_id: null,
          description: desc.trim(),
          amount: Number(amount),
          expense_date: new Date().toISOString().slice(0, 10),
          payment_method: payMethod as any,
          status: 'pagada',
        })
      } else if (type === 'purchase') {
        if (!selProduct || !product) throw new Error('Selecciona un producto')
        await createPurchase(business.id, user.id, {
          supplier_id: null,
          payment_method: payMethod as any,
          tax: 0,
          observations: '',
          purchase_date: new Date().toISOString().slice(0, 10),
          items: [{
            product_id: product.id,
            name: product.name,
            quantity: Number(qty),
            unit_cost: Number(unitPrice) || Number(product.cost),
            total: (Number(unitPrice) || Number(product.cost)) * Number(qty),
          }],
        })
      } else if (type === 'stock') {
        if (!selProduct || !product) throw new Error('Selecciona un producto')
        await adjustStock(business.id, user.id, product.id, moveType, Number(qty), reason || `${moveType} rápida`)
      } else if (type === 'client') {
        window.location.href = '/clientes-proveedores'
        return
      }
      onDone()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const titles: Record<string, string> = {
    sale: 'Nueva venta rápida',
    purchase: 'Nueva compra rápida',
    expense: 'Nuevo gasto rápido',
    stock: 'Ajuste de stock rápido',
    client: 'Nuevo cliente',
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20 }}>
      <div className="card" style={{ maxWidth: 480, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3>{titles[type]}</h3>
          <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={onClose}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(type === 'sale' || type === 'purchase' || type === 'stock') && (
            <div className="field">
              <label>Producto *</label>
              <select value={selProduct} onChange={(e) => {
                setSelProduct(e.target.value)
                const p = products.find((x) => x.id === e.target.value)
                if (p) {
                  if (type === 'sale') setUnitPrice(Number(p.sale_price))
                  else if (type === 'purchase') setUnitPrice(Number(p.cost))
                }
              }}>
                <option value="">— Selecciona —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} (stock: {p.stock} {p.unit})</option>)}
              </select>
            </div>
          )}

          {(type === 'sale' || type === 'purchase' || type === 'stock') && (
            <div className="field-row">
              <div className="field">
                <label>Cantidad *</label>
                <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
              </div>
              {(type === 'sale' || type === 'purchase') && (
                <div className="field">
                  <label>{type === 'sale' ? 'Precio unit.' : 'Costo unit.'} ($)</label>
                  <input type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} />
                </div>
              )}
            </div>
          )}

          {type === 'stock' && (
            <div className="field-row">
              <div className="field">
                <label>Movimiento</label>
                <select value={moveType} onChange={(e) => setMoveType(e.target.value as any)}>
                  <option value="entrada">Entrada (+ stock)</option>
                  <option value="salida">Salida (- stock)</option>
                </select>
              </div>
              <div className="field">
                <label>Razón</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Merma, ajuste…" />
              </div>
            </div>
          )}

          {type === 'expense' && (
            <>
              <div className="field">
                <label>Descripción *</label>
                <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej. Pago de electricidad" />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Monto ($)</label>
                  <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                </div>
                <div className="field">
                  <label>Método de pago</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="credito">Crédito</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {(type === 'sale' || type === 'purchase') && (
            <div className="field">
              <label>Método de pago</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
          )}

          {type === 'client' && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>Te llevamos al módulo de clientes para registrar uno nuevo.</p>
              <Link to="/clientes-proveedores" className="btn btn-primary">Ir a clientes</Link>
            </div>
          )}

          {err && <div className="error-text">{err}</div>}

          {type !== 'client' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Guardando…' : 'Guardar'}</button>
              <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            </div>
          )}

          {(type === 'sale' || type === 'purchase') && product && (
            <div style={{ fontSize: 13, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8, color: 'var(--text-dim)' }}>
              Total: <strong style={{ color: 'var(--text)' }}>${(Number(unitPrice) * Number(qty)).toFixed(2)}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
