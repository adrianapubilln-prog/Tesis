import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { fetchProducts, type Product } from '../lib/sales'
import {
  createProduct, updateProduct, deleteProduct, adjustStock, fetchMovements,
  fetchRecipes, createRecipe, deleteRecipe, runProduction, recipeUnitCost,
  type InventoryMovement, type Recipe, type RecipeIngredient,
} from '../lib/inventory'

type Tab = 'stock' | 'movements' | 'alerts' | 'production'

export default function InventoryModule() {
  const [tab, setTab] = useState<Tab>('stock')
  const { business } = useAuth()
  const isProductora = business?.type === 'productora'

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <span className="badge">Inventario Inteligente</span>
        <h1 style={{ fontSize: 26, marginTop: 8 }}>Inventario</h1>
        <p className="muted" style={{ fontSize: 14 }}>Controla tu stock, alertas, movimientos y costo de producción.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginBottom: 20, flexWrap: 'wrap' }}>
        <TabBtn active={tab === 'stock'} onClick={() => setTab('stock')}>Productos</TabBtn>
        <TabBtn active={tab === 'movements'} onClick={() => setTab('movements')}>Movimientos</TabBtn>
        <TabBtn active={tab === 'alerts'} onClick={() => setTab('alerts')}>Alertas</TabBtn>
        {isProductora && <TabBtn active={tab === 'production'} onClick={() => setTab('production')}>Producción</TabBtn>}
      </div>
      {tab === 'stock' && <Stock />}
      {tab === 'movements' && <Movements />}
      {tab === 'alerts' && <Alerts />}
      {tab === 'production' && isProductora && <Production />}
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

/* ---------- Productos / Stock ---------- */
function Stock() {
  const { business } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = () => { if (business) fetchProducts(business.id).then(setProducts).catch(() => {}) }
  useEffect(load, [business])

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label>Buscar producto</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre…" />
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>+ Nuevo producto</button>
      </div>

      {showForm && (
        <ProductForm
          existing={editing}
          onCancel={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); load() }}
        />
      )}

      {filtered.length === 0 && !showForm ? (
        <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>No hay productos. Agrega tu primer producto.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-dim)' }}>
              <th style={{ padding: '10px 8px' }}>Producto</th>
              <th style={{ padding: '10px 8px' }}>SKU</th>
              <th style={{ padding: '10px 8px' }}>Costo</th>
              <th style={{ padding: '10px 8px' }}>P. venta</th>
              <th style={{ padding: '10px 8px' }}>Stock</th>
              <th style={{ padding: '10px 8px' }}>Mín.</th>
              <th style={{ padding: '10px 8px' }}>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const low = p.stock <= p.min_stock
              return (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 8px' }}>{p.name}</td>
                  <td style={{ padding: '10px 8px', color: 'var(--text-dim)' }}>{p.sku || '—'}</td>
                  <td style={{ padding: '10px 8px' }}>${Number(p.cost).toFixed(2)}</td>
                  <td style={{ padding: '10px 8px' }}>${Number(p.sale_price).toFixed(2)}</td>
                  <td style={{ padding: '10px 8px', fontWeight: 600, color: low ? 'var(--warning)' : 'var(--text)' }}>{p.stock} {p.unit}</td>
                  <td style={{ padding: '10px 8px', color: 'var(--text-dim)' }}>{p.min_stock}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, color: low ? 'var(--warning)' : 'var(--success)' }}>
                      {low ? 'Bajo' : 'OK'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setEditing(p); setShowForm(true) }}>Editar</button>
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12, color: 'var(--error)' }} onClick={async () => {
                      if (!confirm(`¿Eliminar "${p.name}"?`)) return
                      await deleteProduct(p.id); load()
                    }}>Eliminar</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function ProductForm({ existing, onCancel, onSaved }: { existing: Product | null; onCancel: () => void; onSaved: () => void }) {
  const { business } = useAuth()
  const [name, setName] = useState(existing?.name || '')
  const [sku, setSku] = useState(existing?.sku || '')
  const [unit, setUnit] = useState(existing?.unit || 'unidad')
  const [cost, setCost] = useState(existing?.cost || 0)
  const [salePrice, setSalePrice] = useState(existing?.sale_price || 0)
  const [stock, setStock] = useState(existing?.stock || 0)
  const [minStock, setMinStock] = useState(existing?.min_stock || 0)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setErr(null)
    if (!business) return
    if (!name.trim()) return setErr('Nombre obligatorio.')
    setBusy(true)
    try {
      const data = {
        name: name.trim(),
        sku: sku.trim() || null,
        unit,
        cost: Number(cost) || 0,
        sale_price: Number(salePrice) || 0,
        stock: Number(stock) || 0,
        min_stock: Number(minStock) || 0,
        active: true,
      }
      if (existing) await updateProduct(existing.id, data)
      else await createProduct(business.id, data)
      onSaved()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: 20, marginBottom: 16, maxWidth: 560 }}>
      <h3 style={{ marginBottom: 14 }}>{existing ? 'Editar producto' : 'Nuevo producto'}</h3>
      <div className="field-row">
        <div className="field">
          <label>Nombre *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>SKU / código</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Unidad</label>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unidad, kg, litro…" />
        </div>
        <div className="field">
          <label>Stock actual</label>
          <input type="number" step="0.01" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Costo unitario ($)</label>
          <input type="number" step="0.01" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Precio de venta ($)</label>
          <input type="number" step="0.01" value={salePrice} onChange={(e) => setSalePrice(Number(e.target.value))} />
        </div>
      </div>
      <div className="field">
        <label>Stock mínimo (alerta)</label>
        <input type="number" step="0.01" value={minStock} onChange={(e) => setMinStock(Number(e.target.value))} />
      </div>
      {err && <div className="error-text" style={{ marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

/* ---------- Movimientos ---------- */
function Movements() {
  const { business, user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [selProduct, setSelProduct] = useState('')
  const [type, setType] = useState<'entrada' | 'salida'>('entrada')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = () => {
    if (!business) return
    fetchProducts(business.id).then(setProducts).catch(() => {})
    fetchMovements(business.id).then(setMovements).catch(() => {})
  }
  useEffect(load, [business])

  const submit = async () => {
    setErr(null)
    if (!business || !user) return
    if (!selProduct) return setErr('Selecciona un producto.')
    const q = Number(qty)
    if (!q || q <= 0) return setErr('Cantidad inválida.')
    try {
      setBusy(true)
      await adjustStock(business.id, user.id, selProduct, type, q, reason || `Ajuste manual (${type})`)
      setSelProduct(''); setQty(1); setReason('')
      load()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 18 }}>
      <div className="card" style={{ padding: 20, height: 'fit-content' }}>
        <h3 style={{ marginBottom: 14 }}>Ajuste de inventario</h3>
        <div className="field">
          <label>Producto</label>
          <select value={selProduct} onChange={(e) => setSelProduct(e.target.value)}>
            <option value="">— Selecciona —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.stock} {p.unit})</option>)}
          </select>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="entrada">Entrada (+)</option>
              <option value="salida">Salida (−)</option>
            </select>
          </div>
          <div className="field">
            <label>Cantidad</label>
            <input type="number" min={0} step="0.01" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </div>
        </div>
        <div className="field">
          <label>Motivo</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Compra, merma, ajuste…" />
        </div>
        {err && <div className="error-text" style={{ marginBottom: 10 }}>{err}</div>}
        <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Aplicando…' : 'Aplicar ajuste'}</button>
      </div>

      <div>
        <h3 style={{ marginBottom: 12 }}>Historial de movimientos</h3>
        {movements.length === 0 ? (
          <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>Sin movimientos.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-dim)' }}>
                <th style={{ padding: '8px 6px' }}>Fecha</th>
                <th style={{ padding: '8px 6px' }}>Producto</th>
                <th style={{ padding: '8px 6px' }}>Tipo</th>
                <th style={{ padding: '8px 6px' }}>Cant.</th>
                <th style={{ padding: '8px 6px' }}>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {movements.slice(0, 50).map((m) => (
                <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 6px' }}>{new Date(m.created_at).toLocaleDateString('es-SV')}</td>
                  <td style={{ padding: '8px 6px' }}>{m.product?.name || '—'}</td>
                  <td style={{ padding: '8px 6px' }}>
                    <span style={{ color: m.type === 'entrada' ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                      {m.type === 'entrada' ? '▲ Entrada' : '▼ Salida'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 6px' }}>{m.quantity}</td>
                  <td style={{ padding: '8px 6px', color: 'var(--text-dim)' }}>{m.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ---------- Alertas ---------- */
function Alerts() {
  const { business } = useAuth()
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    if (business) fetchProducts(business.id).then(setProducts).catch(() => {})
  }, [business])

  const outOfStock = products.filter((p) => p.stock <= 0)
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.min_stock)

  return (
    <div>
      {outOfStock.length > 0 && (
        <div className="card" style={{ padding: 18, marginBottom: 16, borderColor: 'var(--error)' }}>
          <h3 style={{ color: 'var(--error)', marginBottom: 10 }}>Agotados ({outOfStock.length})</h3>
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
          <h3 style={{ color: 'var(--warning)', marginBottom: 10 }}>Por agotarse ({lowStock.length})</h3>
          {lowStock.map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
              <span>{p.name}</span>
              <span style={{ color: 'var(--warning)' }}>Stock: {p.stock} {p.unit} (mín: {p.min_stock})</span>
            </div>
          ))}
        </div>
      )}
      {outOfStock.length === 0 && lowStock.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p className="muted">Todo en orden. Ningún producto necesita reposición.</p>
        </div>
      )}
    </div>
  )
}

/* ---------- Producción ---------- */
function Production() {
  const { business, user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [showForm, setShowForm] = useState(false)
  const [runTarget, setRunTarget] = useState<Recipe | null>(null)
  const [runMult, setRunMult] = useState(1)
  const [busy, setBusy] = useState(false)

  const load = () => {
    if (!business) return
    fetchProducts(business.id).then(setProducts).catch(() => {})
    fetchRecipes(business.id).then(setRecipes).catch(() => {})
  }
  useEffect(load, [business])

  const doRun = async () => {
    if (!business || !user || !runTarget) return
    try {
      setBusy(true)
      await runProduction(business.id, user.id, runTarget.id, Number(runMult) || 1)
      setRunTarget(null); setRunMult(1)
      load()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3>Recetas de producción</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nueva receta</button>
      </div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
        Define cómo se elabora un producto a partir de materias primas. El costo de producción se calcula automáticamente.
      </p>

      {showForm && (
        <RecipeForm
          products={products}
          onCancel={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
          businessId={business?.id || ''}
        />
      )}

      {recipes.length === 0 && !showForm ? (
        <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>No hay recetas. Crea tu primera receta de producción.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {recipes.map((r) => (
            <div key={r.id} className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{r.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>Producto: {r.product?.name}</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>
                <div>Produce: <strong>{r.output_qty} {r.product?.unit}</strong></div>
                <div>Costo/unit: <strong style={{ color: 'var(--accent)' }}>${recipeUnitCost(r).toFixed(2)}</strong></div>
              </div>
              <div style={{ marginTop: 8, fontSize: 13 }}>
                <div className="muted" style={{ marginBottom: 4 }}>Ingredientes:</div>
                {(r.ingredients || []).map((ing, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{ing.name}</span>
                    <span className="muted">{ing.quantity} · ${ing.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary" style={{ flex: 1, fontSize: 13 }} onClick={() => setRunTarget(r)}>Producir</button>
                <button className="btn btn-ghost" style={{ fontSize: 13, color: 'var(--error)' }} onClick={async () => {
                  if (!confirm('¿Eliminar receta?')) return
                  await deleteRecipe(r.id); load()
                }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {runTarget && (
        <Modal onClose={() => setRunTarget(null)} title={`Producir — ${runTarget.name}`}>
          <p style={{ fontSize: 14, marginBottom: 14 }}>
            Cada tanda produce <strong>{runTarget.output_qty} {runTarget.product?.unit}</strong> de {runTarget.product?.name}.
            Se consumirán las materias primas y se añadirá el producto terminado al inventario.
          </p>
          <div className="field">
            <label>Cantidad de tandas</label>
            <input type="number" min={1} value={runMult} onChange={(e) => setRunMult(Number(e.target.value))} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>
            Total a producir: <strong style={{ color: 'var(--text)' }}>{(runTarget.output_qty * (Number(runMult) || 0))} {runTarget.product?.unit}</strong>
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={doRun}>{busy ? 'Procesando…' : 'Confirmar producción'}</button>
        </Modal>
      )}
    </div>
  )
}

function RecipeForm({ products, onCancel, onSaved, businessId }: { products: Product[]; onCancel: () => void; onSaved: () => void; businessId: string }) {
  const [productId, setProductId] = useState('')
  const [name, setName] = useState('')
  const [outputQty, setOutputQty] = useState(1)
  const [laborCost, setLaborCost] = useState(0)
  const [overheadCost, setOverheadCost] = useState(0)
  const [notes, setNotes] = useState('')
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [ingProduct, setIngProduct] = useState('')
  const [ingQty, setIngQty] = useState(1)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const addIng = () => {
    if (!ingProduct) return setErr('Selecciona materia prima.')
    const p = products.find((x) => x.id === ingProduct)
    if (!p) return
    setIngredients([...ingredients, {
      product_id: p.id, name: p.name, quantity: Number(ingQty) || 1,
      unit_cost: Number(p.cost) || 0, total: (Number(ingQty) || 1) * (Number(p.cost) || 0),
    }])
    setIngProduct(''); setIngQty(1); setErr(null)
  }

  const totalCost = ingredients.reduce((s, i) => s + i.total, 0) + Number(laborCost) + Number(overheadCost)
  const unitCost = totalCost / (Number(outputQty) || 1)

  const save = async () => {
    setErr(null)
    if (!productId) return setErr('Selecciona el producto terminado.')
    if (!name.trim()) return setErr('Nombre obligatorio.')
    if (ingredients.length === 0) return setErr('Agrega al menos una materia prima.')
    try {
      setBusy(true)
      await createRecipe(businessId, {
        product_id: productId,
        name: name.trim(),
        output_qty: Number(outputQty) || 1,
        labor_cost: Number(laborCost) || 0,
        overhead_cost: Number(overheadCost) || 0,
        notes,
        ingredients,
      })
      onSaved()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: 20, marginBottom: 16, maxWidth: 640 }}>
      <h3 style={{ marginBottom: 14 }}>Nueva receta</h3>
      <div className="field-row">
        <div className="field">
          <label>Producto terminado *</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">— Selecciona —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Nombre de la receta</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Pan dulce x12" />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Unidades producidas</label>
          <input type="number" min={1} step="0.01" value={outputQty} onChange={(e) => setOutputQty(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Mano de obra ($)</label>
          <input type="number" min={0} step="0.01" value={laborCost} onChange={(e) => setLaborCost(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Costos indirectos ($)</label>
          <input type="number" min={0} step="0.01" value={overheadCost} onChange={(e) => setOverheadCost(Number(e.target.value))} />
        </div>
      </div>

      <h4 style={{ marginTop: 14, marginBottom: 10 }}>Materias primas</h4>
      <div className="field-row">
        <div className="field" style={{ flex: 2 }}>
          <label>Materia prima</label>
          <select value={ingProduct} onChange={(e) => setIngProduct(e.target.value)}>
            <option value="">— Selecciona —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} (${Number(p.cost).toFixed(2)}/{p.unit})</option>)}
          </select>
        </div>
        <div className="field">
          <label>Cantidad</label>
          <input type="number" min={0} step="0.01" value={ingQty} onChange={(e) => setIngQty(Number(e.target.value))} />
        </div>
        <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={addIng}>+ Agregar</button>
        </div>
      </div>

      {ingredients.length > 0 && (
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginBottom: 10 }}>
          <tbody>
            {ingredients.map((ing, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '6px' }}>{ing.name}</td>
                <td style={{ padding: '6px', textAlign: 'right' }}>{ing.quantity}</td>
                <td style={{ padding: '6px', textAlign: 'right' }}>${ing.total.toFixed(2)}</td>
                <td style={{ padding: '6px' }}>
                  <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setIngredients(ingredients.filter((_, x) => x !== i))}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ fontSize: 14, marginBottom: 14, padding: '10px 14px', background: 'rgba(119,140,67,0.12)', borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Costo total</span><strong>${totalCost.toFixed(2)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Costo por unidad</span><strong style={{ color: 'var(--accent)' }}>${unitCost.toFixed(2)}</strong>
        </div>
      </div>

      {err && <div className="error-text" style={{ marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar receta'}</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

/* ---------- Modal ---------- */
function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20 }}>
      <div className="card" style={{ maxWidth: 480, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3>{title}</h3>
          <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={onClose}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}
