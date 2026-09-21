import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useAuth } from '../lib/auth'
import { fetchSales, type Sale, type Product } from '../lib/sales'
import { fetchProducts } from '../lib/sales'
import { fetchPurchases, type Purchase, fetchSuppliers, type Supplier } from '../lib/purchases'
import { fetchExpenses, type Expense } from '../lib/expenses'
import { fetchClients, fetchClientPayments } from '../lib/sales'
import { fetchMovements } from '../lib/inventory'
import { fetchPayroll, formatPeriod, getAvailablePeriods, type PayrollEntry } from '../lib/payroll'
import type { Client } from '../lib/sales'

const PIE_COLORS = ['#22D0F7', '#2198C1', '#1C2A38', '#4A4A4A', '#8B9197', '#16A34A', '#F59E0B', '#EF4444']

type ReportArea = 'ventas' | 'compras' | 'proveedores' | 'clientes' | 'inventario' | 'gastos' | 'financiero'

export default function ReportsModule() {
  const { business } = useAuth()
  const [area, setArea] = useState<ReportArea>('financiero')
  const [period, setPeriod] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })

  const periods = getAvailablePeriods()

  const [sales, setSales] = useState<Sale[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [payroll, setPayroll] = useState<PayrollEntry[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!business) return
    setLoading(true)
    Promise.all([
      fetchSales(business.id),
      fetchPurchases(business.id),
      fetchExpenses(business.id),
      fetchProducts(business.id),
      fetchClients(business.id),
      fetchSuppliers(business.id),
      fetchPayroll(business.id),
      fetchMovements(business.id),
    ]).then(([s, p, e, pr, c, sup, pay, mv]) => {
      setSales(s)
      setPurchases(p)
      setExpenses(e)
      setProducts(pr)
      setClients(c)
      setSuppliers(sup)
      setPayroll(pay)
      setMovements(mv)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [business])

  useEffect(load, [load])

  const periodLabel = formatPeriod(period)

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <span className="badge">Reportes contables</span>
        <h1 style={{ fontSize: 26, marginTop: 8 }}>Reportes e informes</h1>
        <p className="muted" style={{ fontSize: 14 }}>Informes detallados generados a partir de la información contable de tu negocio.</p>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Área</label>
          <select value={area} onChange={(e) => setArea(e.target.value as ReportArea)}>
            <option value="financiero">Financiero</option>
            <option value="ventas">Ventas</option>
            <option value="compras">Compras</option>
            <option value="proveedores">Proveedores</option>
            <option value="clientes">Clientes</option>
            <option value="inventario">Inventario</option>
            <option value="gastos">Gastos</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Período</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {periods.map((p) => <option key={p} value={p}>{formatPeriod(p)}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card muted" style={{ padding: 32, textAlign: 'center' }}>Cargando datos…</div>
      ) : (
        <>
          {area === 'financiero' && <FinancialReport sales={sales} expenses={expenses} payroll={payroll} period={period} label={periodLabel} />}
          {area === 'ventas' && <SalesReport sales={sales} period={period} label={periodLabel} />}
          {area === 'compras' && <PurchasesReport purchases={purchases} period={period} label={periodLabel} />}
          {area === 'proveedores' && <SuppliersReport purchases={purchases} suppliers={suppliers} period={period} label={periodLabel} />}
          {area === 'clientes' && <ClientsReport sales={sales} clients={clients} period={period} label={periodLabel} />}
          {area === 'inventario' && <InventoryReport products={products} movements={movements} label={periodLabel} />}
          {area === 'gastos' && <ExpensesReport expenses={expenses} payroll={payroll} period={period} label={periodLabel} />}
        </>
      )}
    </div>
  )
}

/* ===== Financiero ===== */
function FinancialReport({ sales, expenses, payroll, period, label }: {
  sales: Sale[]; expenses: Expense[]; payroll: PayrollEntry[]; period: string; label: string
}) {
  const monthSales = sales.filter((s) => s.sale_date?.startsWith(period) && s.status !== 'anulada')
  const monthExp = expenses.filter((e) => e.expense_date?.startsWith(period))
  const monthPayroll = payroll.filter((p) => p.period === period)
  const income = monthSales.reduce((s, x) => s + Number(x.total), 0)
  const expTotal = monthExp.reduce((s, x) => s + Number(x.amount), 0)
  const payrollTotal = monthPayroll.reduce((s, x) => s + Number(x.net_pay), 0)
  const totalExpenses = expTotal + payrollTotal
  const profit = income - totalExpenses
  const margin = income > 0 ? (profit / income) * 100 : 0

  const cashflowData = [
    { name: 'Ingresos', value: income, color: '#22D0F7' },
    { name: 'Gastos operativos', value: expTotal, color: '#F59E0B' },
    { name: 'Salarios', value: payrollTotal, color: '#EF4444' },
  ]

  return (
    <div>
      <ReportHeader title="Resumen financiero" subtitle={label} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label="Ingresos" value={`$${income.toFixed(2)}`} hint={`${monthSales.length} ventas`} color="#22D0F7" />
        <StatCard label="Gastos operativos" value={`$${expTotal.toFixed(2)}`} hint={`${monthExp.length} gastos`} color="#F59E0B" />
        <StatCard label="Salarios" value={`$${payrollTotal.toFixed(2)}`} hint={`${monthPayroll.length} pagos`} color="#EF4444" />
        <StatCard label="Resultado neto" value={`$${profit.toFixed(2)}`} hint={`${margin.toFixed(1)}% margen`} color={profit >= 0 ? '#16A34A' : '#EF4444'} />
      </div>

      <div className="dash-grid dash-2-1" style={{ marginBottom: 16 }}>
        <div className="card chart-card">
          <h3>Flujo de efectivo — {label}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cashflowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {cashflowData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card chart-card">
          <h3>Distribución de gastos</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={cashflowData.filter((d) => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                {cashflowData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3>Estado de resultados — {label}</h3>
        <table style={{ width: '100%', fontSize: 14, marginTop: 12 }}>
          <tbody>
            <ReportRow label="Ingresos por ventas" value={income} color="#22D0F7" />
            <ReportRow label="(–) Gastos operativos" value={-expTotal} color="#F59E0B" />
            <ReportRow label="(–) Salarios y remuneraciones" value={-payrollTotal} color="#EF4444" />
            <tr style={{ borderTop: '2px solid var(--text)' }}>
              <td style={{ padding: '10px 0', fontWeight: 700 }}>Resultado del período (utilidad/pérdida)</td>
              <td style={{ padding: '10px 0', fontWeight: 700, textAlign: 'right', color: profit >= 0 ? '#16A34A' : '#EF4444' }}>${profit.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ===== Ventas ===== */
function SalesReport({ sales, period, label }: { sales: Sale[]; period: string; label: string }) {
  const monthSales = sales.filter((s) => s.sale_date?.startsWith(period) && s.status !== 'anulada')
  const total = monthSales.reduce((s, x) => s + Number(x.total), 0)

  const byProduct = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>()
    monthSales.forEach((s) => {
      (s.items || []).forEach((i) => {
        const cur = map.get(i.name) || { name: i.name, qty: 0, total: 0 }
        cur.qty += Number(i.quantity)
        cur.total += Number(i.total)
        map.set(i.name, cur)
      })
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [monthSales])

  const byClient = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>()
    monthSales.forEach((s) => {
      const name = s.client?.name || 'Cliente general'
      const cur = map.get(name) || { name, count: 0, total: 0 }
      cur.count += 1
      cur.total += Number(s.total)
      map.set(name, cur)
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10)
  }, [monthSales])

  const byDay = useMemo(() => {
    const map = new Map<string, number>()
    monthSales.forEach((s) => {
      const day = s.sale_date
      map.set(day, (map.get(day) || 0) + Number(s.total))
    })
    return Array.from(map.entries()).map(([day, total]) => ({ day, total })).sort((a, b) => a.day.localeCompare(b.day))
  }, [monthSales])

  return (
    <div>
      <ReportHeader title="Reporte de ventas" subtitle={label} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label="Total vendido" value={`$${total.toFixed(2)}`} hint={`${monthSales.length} transacciones`} color="#22D0F7" />
        <StatCard label="Ticket promedio" value={`$${monthSales.length > 0 ? (total / monthSales.length).toFixed(2) : '0.00'}`} color="#2198C1" />
        <StatCard label="Ventas a crédito" value={`$${monthSales.filter((s) => s.payment_type === 'credito').reduce((s, x) => s + Number(x.total), 0).toFixed(2)}`} color="#F59E0B" />
      </div>

      <div className="card chart-card" style={{ marginBottom: 16 }}>
        <h3>Ventas por día — {label}</h3>
        {byDay.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
              <Bar dataKey="total" name="Ventas" fill="#22D0F7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="dash-grid dash-2-1">
        <div className="card" style={{ padding: 20 }}>
          <h3>Ventas por producto</h3>
          <ReportTable headers={['Producto', 'Cantidad', 'Total']}>
            {byProduct.length === 0 ? <EmptyRow colSpan={3} /> : byProduct.map((p) => (
              <tr key={p.name} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px' }}>{p.name}</td>
                <td style={{ padding: '8px' }}>{p.qty}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>${p.total.toFixed(2)}</td>
              </tr>
            ))}
          </ReportTable>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <h3>Ventas por cliente</h3>
          <ReportTable headers={['Cliente', 'Compras', 'Total']}>
            {byClient.length === 0 ? <EmptyRow colSpan={3} /> : byClient.map((c) => (
              <tr key={c.name} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px' }}>{c.name}</td>
                <td style={{ padding: '8px' }}>{c.count}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>${c.total.toFixed(2)}</td>
              </tr>
            ))}
          </ReportTable>
        </div>
      </div>
    </div>
  )
}

/* ===== Compras ===== */
function PurchasesReport({ purchases, period, label }: { purchases: Purchase[]; period: string; label: string }) {
  const monthPurchases = purchases.filter((p) => p.purchase_date?.startsWith(period) && p.status !== 'anulada')
  const total = monthPurchases.reduce((s, x) => s + Number(x.total), 0)

  const bySupplier = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>()
    monthPurchases.forEach((p) => {
      const name = p.supplier?.contact_name || 'Sin proveedor'
      const cur = map.get(name) || { name, count: 0, total: 0 }
      cur.count += 1
      cur.total += Number(p.total)
      map.set(name, cur)
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [monthPurchases])

  return (
    <div>
      <ReportHeader title="Reporte de compras" subtitle={label} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label="Total comprado" value={`$${total.toFixed(2)}`} hint={`${monthPurchases.length} compras`} color="#2198C1" />
        <StatCard label="Compra promedio" value={`$${monthPurchases.length > 0 ? (total / monthPurchases.length).toFixed(2) : '0.00'}`} color="#22D0F7" />
        <StatCard label="Compras a crédito" value={`$${monthPurchases.filter((p) => p.payment_method === 'credito').reduce((s, x) => s + Number(x.total), 0).toFixed(2)}`} color="#F59E0B" />
      </div>
      <div className="card" style={{ padding: 20 }}>
        <h3>Historial de compras — {label}</h3>
        <ReportTable headers={['Fecha', 'Proveedor', 'Método', 'Estado', 'Total']}>
          {monthPurchases.length === 0 ? <EmptyRow colSpan={5} /> : monthPurchases.map((p) => (
            <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '8px' }}>{p.purchase_date}</td>
              <td style={{ padding: '8px' }}>{p.supplier?.contact_name || '—'}</td>
              <td style={{ padding: '8px' }}>{p.payment_method}</td>
              <td style={{ padding: '8px' }}>{p.status}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>${Number(p.total).toFixed(2)}</td>
            </tr>
          ))}
        </ReportTable>
      </div>
      <div className="card" style={{ padding: 20, marginTop: 16 }}>
        <h3>Compras por proveedor</h3>
        <ReportTable headers={['Proveedor', 'Compras', 'Total']}>
          {bySupplier.length === 0 ? <EmptyRow colSpan={3} /> : bySupplier.map((s) => (
            <tr key={s.name} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '8px' }}>{s.name}</td>
              <td style={{ padding: '8px' }}>{s.count}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>${s.total.toFixed(2)}</td>
            </tr>
          ))}
        </ReportTable>
      </div>
    </div>
  )
}

/* ===== Proveedores ===== */
function SuppliersReport({ purchases, suppliers, period, label }: {
  purchases: Purchase[]; suppliers: Supplier[]; period: string; label: string
}) {
  const monthPurchases = purchases.filter((p) => p.purchase_date?.startsWith(period) && p.status !== 'anulada')
  const pending = monthPurchases.filter((p) => p.status === 'pendiente')
  const pendingTotal = pending.reduce((s, x) => s + Number(x.total), 0)

  const supplierStats = useMemo(() => {
    return suppliers.map((s) => {
      const sPurchases = purchases.filter((p) => p.supplier_id === s.id && p.status !== 'anulada')
      const total = sPurchases.reduce((acc, p) => acc + Number(p.total), 0)
      const sPending = sPurchases.filter((p) => p.status === 'pendiente').reduce((acc, p) => acc + Number(p.total), 0)
      return { supplier: s, total, count: sPurchases.length, pending: sPending }
    }).filter((x) => x.count > 0).sort((a, b) => b.total - a.total)
  }, [suppliers, purchases])

  return (
    <div>
      <ReportHeader title="Estado de proveedores" subtitle={label} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label="Proveedores activos" value={String(suppliers.length)} color="#2198C1" />
        <StatCard label="Compras del período" value={`$${monthPurchases.reduce((s, x) => s + Number(x.total), 0).toFixed(2)}`} color="#22D0F7" />
        <StatCard label="Cuentas por pagar" value={`$${pendingTotal.toFixed(2)}`} hint={`${pending.length} facturas pendientes`} color="#EF4444" />
      </div>
      <div className="card" style={{ padding: 20 }}>
        <h3>Historial de proveedores</h3>
        <ReportTable headers={['Proveedor', 'Empresa', 'Teléfono', 'Compras', 'Total histórico', 'Saldo']}>
          {supplierStats.length === 0 ? <EmptyRow colSpan={6} /> : supplierStats.map(({ supplier: s, total, count, pending }) => (
            <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '8px' }}>{s.contact_name}</td>
              <td style={{ padding: '8px' }}>{s.company_name || '—'}</td>
              <td style={{ padding: '8px' }}>{s.phone || '—'}</td>
              <td style={{ padding: '8px' }}>{count}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>${total.toFixed(2)}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: pending > 0 ? '#EF4444' : 'var(--text)' }}>${pending.toFixed(2)}</td>
            </tr>
          ))}
        </ReportTable>
      </div>
    </div>
  )
}

/* ===== Clientes ===== */
function ClientsReport({ sales, clients, period, label }: {
  sales: Sale[]; clients: Client[]; period: string; label: string
}) {
  const monthSales = sales.filter((s) => s.sale_date?.startsWith(period) && s.status !== 'anulada')
  const creditSales = monthSales.filter((s) => s.payment_type === 'credito')
  const pendingTotal = creditSales.reduce((s, x) => s + Number(x.total), 0)

  const clientStats = useMemo(() => {
    return clients.map((c) => {
      const cSales = sales.filter((s) => s.client_id === c.id && s.status !== 'anulada')
      const total = cSales.reduce((acc, s) => acc + Number(s.total), 0)
      return { client: c, total, count: cSales.length }
    }).filter((x) => x.count > 0).sort((a, b) => b.total - a.total)
  }, [clients, sales])

  return (
    <div>
      <ReportHeader title="Estado de clientes" subtitle={label} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label="Clientes registrados" value={String(clients.length)} color="#2198C1" />
        <StatCard label="Ventas del período" value={`$${monthSales.reduce((s, x) => s + Number(x.total), 0).toFixed(2)}`} color="#22D0F7" />
        <StatCard label="Cuentas por cobrar" value={`$${clients.reduce((s, c) => s + Number(c.balance), 0).toFixed(2)}`} hint={`${creditSales.length} ventas a crédito`} color="#F59E0B" />
      </div>
      <div className="card" style={{ padding: 20 }}>
        <h3>Historial de compras por cliente</h3>
        <ReportTable headers={['Cliente', 'Teléfono', 'Compras', 'Total histórico', 'Saldo']}>
          {clientStats.length === 0 ? <EmptyRow colSpan={5} /> : clientStats.map(({ client: c, total, count }) => (
            <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '8px' }}>{c.name}</td>
              <td style={{ padding: '8px' }}>{c.phone || '—'}</td>
              <td style={{ padding: '8px' }}>{count}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>${total.toFixed(2)}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: Number(c.balance) > 0 ? '#F59E0B' : 'var(--text)' }}>${Number(c.balance).toFixed(2)}</td>
            </tr>
          ))}
        </ReportTable>
      </div>
    </div>
  )
}

/* ===== Inventario ===== */
function InventoryReport({ products, movements, label }: {
  products: Product[]; movements: any[]; label: string
}) {
  const lowStock = products.filter((p) => p.stock <= p.min_stock && p.stock > 0)
  const outOfStock = products.filter((p) => p.stock === 0)
  const inventoryValue = products.reduce((s, p) => s + Number(p.cost) * p.stock, 0)
  const inventoryRetail = products.reduce((s, p) => s + Number(p.sale_price) * p.stock, 0)

  return (
    <div>
      <ReportHeader title="Reporte de inventario" subtitle={label} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label="Productos" value={String(products.length)} color="#2198C1" />
        <StatCard label="Valor de inventario (costo)" value={`$${inventoryValue.toFixed(2)}`} color="#22D0F7" />
        <StatCard label="Valor de inventario (venta)" value={`$${inventoryRetail.toFixed(2)}`} color="#16A34A" />
        <StatCard label="Alertas" value={String(lowStock.length + outOfStock.length)} hint={`${outOfStock.length} agotados`} color={lowStock.length + outOfStock.length > 0 ? '#EF4444' : '#16A34A'} />
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3>Existencias actuales</h3>
        <ReportTable headers={['Producto', 'SKU', 'Stock', 'Mínimo', 'Costo unit.', 'Valor total']}>
          {products.length === 0 ? <EmptyRow colSpan={6} /> : products.map((p) => (
            <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '8px' }}>{p.name}</td>
              <td style={{ padding: '8px' }}>{p.sku || '—'}</td>
              <td style={{ padding: '8px', color: p.stock === 0 ? '#EF4444' : p.stock <= p.min_stock ? '#F59E0B' : 'var(--text)' }}>{p.stock} {p.unit}</td>
              <td style={{ padding: '8px' }}>{p.min_stock}</td>
              <td style={{ padding: '8px' }}>${Number(p.cost).toFixed(2)}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>${(Number(p.cost) * p.stock).toFixed(2)}</td>
            </tr>
          ))}
        </ReportTable>
      </div>

      {(lowStock.length > 0 || outOfStock.length > 0) && (
        <div className="dash-grid dash-2-1">
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ color: 'var(--warning)' }}>Productos con bajo stock</h3>
            {lowStock.length === 0 ? <p className="muted">No hay productos con stock bajo.</p> : (
              <ReportTable headers={['Producto', 'Stock', 'Mínimo']}>
                {lowStock.map((p) => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px' }}>{p.name}</td>
                    <td style={{ padding: '8px', color: '#F59E0B' }}>{p.stock} {p.unit}</td>
                    <td style={{ padding: '8px' }}>{p.min_stock}</td>
                  </tr>
                ))}
              </ReportTable>
            )}
          </div>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ color: 'var(--error)' }}>Productos agotados</h3>
            {outOfStock.length === 0 ? <p className="muted">No hay productos agotados.</p> : (
              <ReportTable headers={['Producto', 'SKU']}>
                {outOfStock.map((p) => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px' }}>{p.name}</td>
                    <td style={{ padding: '8px' }}>{p.sku || '—'}</td>
                  </tr>
                ))}
              </ReportTable>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 20, marginTop: 16 }}>
        <h3>Movimientos de inventario</h3>
        <ReportTable headers={['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Razón']}>
          {movements.length === 0 ? <EmptyRow colSpan={5} /> : movements.slice(0, 50).map((m) => (
            <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '8px' }}>{new Date(m.created_at).toLocaleDateString('es-SV')}</td>
              <td style={{ padding: '8px' }}>{m.product?.name || '—'}</td>
              <td style={{ padding: '8px', color: m.type === 'entrada' ? '#16A34A' : '#EF4444' }}>{m.type}</td>
              <td style={{ padding: '8px' }}>{m.quantity}</td>
              <td style={{ padding: '8px' }}>{m.reason || '—'}</td>
            </tr>
          ))}
        </ReportTable>
      </div>
    </div>
  )
}

/* ===== Gastos ===== */
function ExpensesReport({ expenses, payroll, period, label }: {
  expenses: Expense[]; payroll: PayrollEntry[]; period: string; label: string
}) {
  const monthExp = expenses.filter((e) => e.expense_date?.startsWith(period))
  const monthPayroll = payroll.filter((p) => p.period === period)
  const expTotal = monthExp.reduce((s, x) => s + Number(x.amount), 0)
  const payrollTotal = monthPayroll.reduce((s, x) => s + Number(x.net_pay), 0)
  const grandTotal = expTotal + payrollTotal

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; color: string; total: number }>()
    monthExp.forEach((e) => {
      const key = e.category?.id || 'none'
      if (!map.has(key)) map.set(key, { name: e.category?.name || 'Sin categoría', color: e.category?.color || '#2198C1', total: 0 })
      map.get(key)!.total += Number(e.amount)
    })
    const cats = Array.from(map.values()).sort((a, b) => b.total - a.total)
    if (payrollTotal > 0) cats.push({ name: 'Salarios y remuneraciones', color: '#EF4444', total: payrollTotal })
    return cats
  }, [monthExp, payrollTotal])

  const byDepartment = useMemo(() => {
    const map = new Map<string, number>()
    monthPayroll.forEach((p) => {
      map.set(p.department, (map.get(p.department) || 0) + Number(p.net_pay))
    })
    const labels: Record<string, string> = { administracion: 'Administración', ventas: 'Ventas', produccion: 'Producción', otro: 'Otro' }
    return Array.from(map.entries()).map(([k, v]) => ({ name: labels[k] || k, total: v }))
  }, [monthPayroll])

  const pieData = byCategory.map((c) => ({ name: c.name, value: c.total }))

  return (
    <div>
      <ReportHeader title="Reporte de gastos" subtitle={label} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label="Gastos operativos" value={`$${expTotal.toFixed(2)}`} hint={`${monthExp.length} gastos`} color="#F59E0B" />
        <StatCard label="Salarios y remuneraciones" value={`$${payrollTotal.toFixed(2)}`} hint={`${monthPayroll.length} pagos`} color="#EF4444" />
        <StatCard label="Total gastos" value={`$${grandTotal.toFixed(2)}`} color="var(--text)" />
      </div>

      <div className="dash-grid dash-2-1" style={{ marginBottom: 16 }}>
        <div className="card chart-card">
          <h3>Gastos por categoría — {label}</h3>
          {pieData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                  {pieData.map((_, i) => <Cell key={i} fill={byCategory[i]?.color || PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card chart-card">
          <h3>Salarios por departamento</h3>
          {byDepartment.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byDepartment}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                <Bar dataKey="total" name="Salarios" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3>Detalle de gastos por categoría</h3>
        <ReportTable headers={['Categoría', 'Total', '% del total']}>
          {byCategory.length === 0 ? <EmptyRow colSpan={3} /> : byCategory.map((c) => (
            <tr key={c.name} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: c.color }} />
                {c.name}
              </td>
              <td style={{ padding: '8px', textAlign: 'right' }}>${c.total.toFixed(2)}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>{grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : 0}%</td>
            </tr>
          ))}
        </ReportTable>
      </div>
    </div>
  )
}

/* ===== Shared components ===== */
function ReportHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 20 }}>{title}</h2>
      <p className="muted" style={{ fontSize: 14 }}>Período: {subtitle}</p>
    </div>
  )
}

function StatCard({ label, value, hint, color }: { label: string; value: string; hint?: string; color: string }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 6 }}>{value}</div>
      {hint && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function ReportTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table style={{ width: '100%', fontSize: 13, marginTop: 10 }}>
      <thead>
        <tr style={{ textAlign: 'left', color: 'var(--text-dim)' }}>
          {headers.map((h, i) => <th key={i} style={{ padding: '8px', textAlign: i === headers.length - 1 || (i > 0 && h.includes('Total')) ? 'right' : 'left' }}>{h}</th>)}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

function ReportRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <tr>
      <td style={{ padding: '8px 0' }}>{label}</td>
      <td style={{ padding: '8px 0', textAlign: 'right', color }}>${Math.abs(value).toFixed(2)}</td>
    </tr>
  )
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return <tr><td colSpan={colSpan} style={{ padding: 16, textAlign: 'center' }} className="muted">No hay datos para este período.</td></tr>
}

function EmptyChart() {
  return <div style={{ height: 200, display: 'grid', placeItems: 'center' }}><p className="muted" style={{ fontSize: 13 }}>Sin datos para mostrar.</p></div>
}
