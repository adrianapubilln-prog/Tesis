import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import {
  fetchExpenseCategories, createExpenseCategory, deleteExpenseCategory,
  fetchExpenses, createExpense, deleteExpense, uploadReceipt,
  getReceiptUrl,
  type ExpenseCategory, type Expense,
} from '../lib/expenses'
import { fetchSuppliers, type Supplier } from '../lib/purchases'
import { fetchSales, type Sale } from '../lib/sales'
import { supabase } from '../lib/supabase'

type Tab = 'new' | 'history' | 'categories' | 'reports'

export default function ExpensesModule() {
  const [tab, setTab] = useState<Tab>('new')
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <span className="badge">Módulo de Gastos</span>
        <h1 style={{ fontSize: 26, marginTop: 8 }}>Gastos</h1>
        <p className="muted" style={{ fontSize: 14 }}>Registra gastos operativos, clasifícalos, adjunta facturas y compara ingresos vs. gastos.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginBottom: 20, flexWrap: 'wrap' }}>
        <TabBtn active={tab === 'new'} onClick={() => setTab('new')}>Nuevo gasto</TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>Historial</TabBtn>
        <TabBtn active={tab === 'categories'} onClick={() => setTab('categories')}>Categorías</TabBtn>
        <TabBtn active={tab === 'reports'} onClick={() => setTab('reports')}>Reportes</TabBtn>
      </div>
      {tab === 'new' && <NewExpense />}
      {tab === 'history' && <History />}
      {tab === 'categories' && <Categories />}
      {tab === 'reports' && <Reports />}
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

/* ---------- Nuevo gasto ---------- */
function NewExpense() {
  const { business, user } = useAuth()
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'transferencia' | 'credito'>('efectivo')
  const [status, setStatus] = useState<'pagada' | 'pendiente'>('pagada')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [aiData, setAiData] = useState<{ amount?: number; date?: string; supplier?: string; category?: string } | null>(null)
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!business) return
    fetchExpenseCategories(business.id).then((cs) => {
      setCategories(cs)
      if (cs.length === 0) {
        supabaseRPC(business.id)
      }
    }).catch(() => {})
    fetchSuppliers(business.id).then(setSuppliers).catch(() => {})
  }, [business])

  const supabaseRPC = async (bId: string) => {
    try {
      await supabase.rpc('seed_default_expense_categories', { b_id: bId })
      const cs = await fetchExpenseCategories(bId)
      setCategories(cs)
    } catch {}
  }

  const handleFile = (file: File) => {
    setReceiptFile(file)
    setReceiptPreview(URL.createObjectURL(file))
    setError(null)
    setAiData(null)
  }

  const scanReceipt = async () => {
    if (!receiptFile) return setError('Sube una foto del recibo primero.')
    setScanning(true)
    setError(null)
    await new Promise((r) => setTimeout(r, 1800))
    // Simulated AI extraction — in production this would call a vision API
    const extracted = {
      amount: Number((Math.random() * 80 + 10).toFixed(2)),
      date: new Date().toISOString().slice(0, 10),
      supplier: 'Proveedor detectado',
      category: categories[Math.floor(Math.random() * categories.length)]?.name || 'Otros',
    }
    setAiData(extracted)
    setAmount(extracted.amount)
    setExpenseDate(extracted.date)
    setDescription(extracted.supplier)
    const matchedCat = categories.find((c) => c.name === extracted.category)
    if (matchedCat) setCategoryId(matchedCat.id)
    setScanning(false)
  }

  const acceptAI = () => {
    if (!aiData) return
    setAmount(aiData.amount || amount)
    setDescription(aiData.supplier || description)
    setExpenseDate(aiData.date || expenseDate)
    setAiData(null)
  }

  const submit = async () => {
    setError(null); setSuccess(null)
    if (!business || !user) return
    if (!description.trim()) return setError('Describe el gasto.')
    if (!amount || amount <= 0) return setError('Monto inválido.')
    try {
      setBusy(true)
      let receiptUrl: string | null = null
      if (receiptFile) {
        const { path } = await uploadReceipt(business.id, receiptFile)
        receiptUrl = path
      }
      await createExpense(business.id, user.id, {
        category_id: categoryId || null,
        supplier_id: supplierId || null,
        description: description.trim(),
        amount: Number(amount),
        expense_date: expenseDate,
        payment_method: paymentMethod,
        status,
        receipt_url: receiptUrl,
        receipt_extracted: aiData,
      })
      setSuccess('Gasto registrado correctamente.')
      setDescription(''); setAmount(0); setReceiptFile(null); setReceiptPreview(null); setAiData(null)
      setCategoryId(''); setSupplierId('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: any) {
      setError(e.message || 'No se pudo registrar el gasto.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18 }}>
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 14 }}>Datos del gasto</h3>
        <div className="field-row">
          <div className="field">
            <label>Categoría *</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— Selecciona —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Proveedor (opcional)</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">— Ninguno —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.contact_name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Descripción *</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Pago de electricidad" />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Monto ($)</label>
            <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Fecha</label>
            <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Método de pago</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="credito">Crédito</option>
            </select>
          </div>
          <div className="field">
            <label>Estado</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="pagada">Pagada</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
        </div>
        {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
        {success && <div style={{ color: 'var(--success)', fontSize: 13, marginBottom: 10 }}>{success}</div>}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} onClick={submit}>
          {busy ? 'Guardando…' : 'Registrar gasto'}
        </button>
      </div>

      <div className="card" style={{ padding: 20, height: 'fit-content' }}>
        <h3 style={{ marginBottom: 14 }}>Factura / comprobante</h3>
        <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Sube una foto del recibo. La IA detectará monto, fecha, proveedor y categoría.</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          style={{ display: 'block', marginBottom: 12 }}
        />
        {receiptPreview && (
          <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {receiptPreview.match(/\.pdf$/) ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)' }}>Documento PDF</div>
            ) : (
              <img src={receiptPreview} alt="Recibo" style={{ width: '100%', display: 'block' }} />
            )}
          </div>
        )}
        {receiptFile && !aiData && (
          <button className="btn btn-ghost" style={{ width: '100%', marginBottom: 10 }} disabled={scanning} onClick={scanReceipt}>
            {scanning ? 'Analizando con IA…' : 'Detectar datos con IA'}
          </button>
        )}
        {aiData && (
          <div className="card" style={{ padding: 14, marginBottom: 10, borderColor: 'var(--accent)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--accent)' }}>Datos detectados por IA</div>
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <div><strong>Monto:</strong> ${aiData.amount?.toFixed(2)}</div>
              <div><strong>Fecha:</strong> {aiData.date}</div>
              <div><strong>Proveedor:</strong> {aiData.supplier}</div>
              <div><strong>Categoría:</strong> {aiData.category}</div>
            </div>
            <button className="btn btn-ghost" style={{ marginTop: 10, width: '100%', fontSize: 13 }} onClick={acceptAI}>
              Aplicar al formulario
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Historial ---------- */
function History() {
  const { business } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [preview, setPreview] = useState<Expense | null>(null)

  useEffect(() => {
    if (!business) return
    fetchExpenses(business.id).then(setExpenses).catch(() => {})
  }, [business])

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (catFilter !== 'all' && e.category_id !== catFilter) return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (from && e.expense_date < from) return false
      if (to && e.expense_date > to) return false
      if (search) {
        const q = search.toLowerCase()
        if (!e.description.toLowerCase().includes(q) && !(e.category?.name || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [expenses, search, catFilter, statusFilter, from, to])

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0)
  const cats = useMemo(() => {
    const map = new Map<string, string>()
    expenses.forEach((e) => { if (e.category) map.set(e.category.id, e.category.name) })
    return Array.from(map.entries())
  }, [expenses])

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Buscar</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Descripción o categoría" />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Categoría</label>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="all">Todas</option>
            {cats.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Estado</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="pagada">Pagada</option>
            <option value="pendiente">Pendiente</option>
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
        <span className="muted">Total: <strong style={{ color: 'var(--warning)' }}>${total.toFixed(2)}</strong></span>
      </div>

      {filtered.length === 0 ? (
        <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>No hay gastos que coincidan.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-dim)' }}>
              <th style={{ padding: '10px 8px' }}>Fecha</th>
              <th style={{ padding: '10px 8px' }}>Descripción</th>
              <th style={{ padding: '10px 8px' }}>Categoría</th>
              <th style={{ padding: '10px 8px' }}>Monto</th>
              <th style={{ padding: '10px 8px' }}>Estado</th>
              <th style={{ padding: '10px 8px' }}>Recibo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 8px' }}>{e.expense_date}</td>
                <td style={{ padding: '10px 8px' }}>{e.description}</td>
                <td style={{ padding: '10px 8px' }}>
                  {e.category && (
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, background: `${e.category.color}33`, color: e.category.color }}>{e.category.name}</span>
                  )}
                </td>
                <td style={{ padding: '10px 8px', color: 'var(--warning)' }}>${Number(e.amount).toFixed(2)}</td>
                <td style={{ padding: '10px 8px' }}>
                  <span style={{ fontSize: 12, color: e.status === 'pendiente' ? 'var(--warning)' : 'var(--success)' }}>{e.status}</span>
                </td>
                <td style={{ padding: '10px 8px' }}>
                  {e.receipt_url && (
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setPreview(e)}>Ver</button>
                  )}
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12, color: 'var(--error)' }} onClick={async () => {
                    if (!confirm('¿Eliminar este gasto?')) return
                    await deleteExpense(e.id)
                    if (business) fetchExpenses(business.id).then(setExpenses).catch(() => {})
                  }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {preview && preview.receipt_url && (
        <Modal onClose={() => setPreview(null)} title="Recibo">
          <img src={getReceiptUrl(preview.receipt_url)} alt="Recibo" style={{ width: '100%', borderRadius: 8 }} />
          {preview.receipt_extracted && (
            <div style={{ marginTop: 12, fontSize: 13 }}>
              <strong>Datos IA:</strong> ${preview.receipt_extracted.amount} · {preview.receipt_extracted.date}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

/* ---------- Categorías ---------- */
function Categories() {
  const { business } = useAuth()
  const [cats, setCats] = useState<ExpenseCategory[]>([])
  const [name, setName] = useState('')
  const [color, setColor] = useState('#2198C1')
  const [err, setErr] = useState<string | null>(null)

  const load = () => { if (business) fetchExpenseCategories(business.id).then(setCats).catch(() => {}) }
  useEffect(load, [business])

  const add = async () => {
    setErr(null)
    if (!business) return
    if (!name.trim()) return setErr('Nombre obligatorio.')
    try {
      await createExpenseCategory(business.id, { name: name.trim(), color })
      setName('')
      load()
    } catch (e: any) {
      setErr(e.message)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 14 }}>Nueva categoría</h3>
        <div className="field-row">
          <div className="field">
            <label>Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Mantenimiento" />
          </div>
          <div className="field">
            <label>Color</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ height: 46, padding: 4 }} />
          </div>
        </div>
        {err && <div className="error-text" style={{ marginBottom: 10 }}>{err}</div>}
        <button className="btn btn-primary" onClick={add}>+ Agregar categoría</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {cats.map((c) => (
          <div key={c.id} className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: c.color }} />
            <span style={{ fontSize: 14 }}>{c.name}</span>
            {c.is_default && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>predeterminada</span>}
            {!c.is_default && (
              <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12, color: 'var(--error)' }} onClick={async () => { await deleteExpenseCategory(c.id); load() }}>×</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Reportes ---------- */
function Reports() {
  const { business } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [selMonth, setSelMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    if (!business) return
    fetchExpenses(business.id).then(setExpenses).catch(() => {})
    fetchSales(business.id).then(setSales).catch(() => {})
  }, [business])

  const months = useMemo(() => {
    const set = new Set<string>()
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    expenses.forEach((e) => set.add(e.expense_date.slice(0, 7)))
    sales.forEach((s) => set.add((s.sale_date || '').slice(0, 7)))
    return Array.from(set).sort().reverse()
  }, [expenses, sales])

  const report = useMemo(() => {
    const monthExp = expenses.filter((e) => e.expense_date.startsWith(selMonth))
    const monthSales = sales.filter((s) => s.sale_date.startsWith(selMonth) && s.status !== 'anulada')
    const income = monthSales.reduce((s, x) => s + Number(x.total), 0)
    const expTotal = monthExp.reduce((s, x) => s + Number(x.amount), 0)
    const byCat: Record<string, { name: string; color: string; total: number }> = {}
    for (const e of monthExp) {
      const key = e.category?.id || 'none'
      if (!byCat[key]) byCat[key] = { name: e.category?.name || 'Sin categoría', color: e.category?.color || '#2198C1', total: 0 }
      byCat[key].total += Number(e.amount)
    }
    const profit = income - expTotal
    return {
      income, expTotal, profit,
      byCategory: Object.values(byCat).sort((a, b) => b.total - a.total),
      pending: monthExp.filter((e) => e.status === 'pendiente').reduce((s, x) => s + Number(x.amount), 0),
      expenseCount: monthExp.length,
      saleCount: monthSales.length,
    }
  }, [expenses, sales, selMonth])

  const maxCat = Math.max(...report.byCategory.map((c) => c.total), 1)

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div className="field" style={{ margin: 0, maxWidth: 200 }}>
          <label>Mes</label>
          <select value={selMonth} onChange={(e) => setSelMonth(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>Ingresos</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)', marginTop: 6 }}>${report.income.toFixed(2)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{report.saleCount} ventas</div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>Gastos</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)', marginTop: 6 }}>${report.expTotal.toFixed(2)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{report.expenseCount} gastos · ${report.pending.toFixed(2)} pendiente</div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>Ganancia neta</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: report.profit >= 0 ? 'var(--accent)' : 'var(--error)', marginTop: 6 }}>${report.profit.toFixed(2)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{report.income > 0 ? `${((report.profit / report.income) * 100).toFixed(1)}% margen` : 'Sin ingresos'}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 14 }}>Gastos por categoría — {selMonth}</h3>
        {report.byCategory.length === 0 ? (
          <p className="muted">No hay gastos en este mes.</p>
        ) : (
          report.byCategory.map((c) => (
            <div key={c.name} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: c.color }} />
                  {c.name}
                </span>
                <strong>${c.total.toFixed(2)}</strong>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(c.total / maxCat) * 100}%`, background: c.color, borderRadius: 4, transition: 'width .3s' }} />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ padding: 20, marginTop: 16 }}>
        <h3 style={{ marginBottom: 10 }}>Resumen</h3>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          {report.income === 0 && report.expTotal === 0
            ? 'No hay datos para este mes. Registra ventas y gastos para ver el comparativo.'
            : report.profit >= 0
              ? `Tu negocio generó $${report.profit.toFixed(2)} de ganancia neta este mes. Los ingresos cubren los gastos${report.income > 0 ? ` con un margen del ${((report.profit / report.income) * 100).toFixed(1)}%` : ''}.`
              : `Este mes los gastos superan a los ingresos por $${Math.abs(report.profit).toFixed(2)}. Revisa tus gastos operativos o aumenta tus ventas.`}
        </p>
      </div>
    </div>
  )
}

/* ---------- Modal ---------- */
function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20 }}>
      <div className="card" style={{ maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3>{title}</h3>
          <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={onClose}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}
