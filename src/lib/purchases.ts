import { supabase } from './supabase'

export type Supplier = {
  id: string
  contact_name: string
  company_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  products_supplied: string | null
  balance: number
  observations: string | null
  created_at: string
}

export type PurchaseItem = {
  id?: string
  product_id: string | null
  name: string
  quantity: number
  unit_cost: number
  total: number
}

export type Purchase = {
  id: string
  supplier_id: string | null
  invoice_number: string | null
  payment_method: 'efectivo' | 'transferencia' | 'credito'
  subtotal: number
  tax: number
  total: number
  status: 'pagada' | 'pendiente' | 'anulada'
  observations: string | null
  purchase_date: string
  created_at: string
  supplier?: Supplier | null
  items?: PurchaseItem[]
}

export async function fetchSuppliers(businessId: string) {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('business_id', businessId)
    .order('contact_name', { ascending: true })
  if (error) throw error
  return (data || []) as unknown as Supplier[]
}

export async function createSupplier(businessId: string, s: Partial<Supplier>) {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...s, business_id: businessId })
    .select()
    .single()
  if (error) throw error
  return data as unknown as Supplier
}

export async function updateSupplier(id: string, patch: Partial<Supplier>) {
  const { error } = await supabase.from('suppliers').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteSupplier(id: string) {
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) throw error
}

export async function fetchPurchases(businessId: string) {
  const { data, error } = await supabase
    .from('purchases')
    .select('*, supplier:suppliers(*)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as unknown as Purchase[]
}

export async function fetchPurchaseItems(purchaseId: string) {
  const { data, error } = await supabase
    .from('purchase_items')
    .select('*')
    .eq('purchase_id', purchaseId)
  if (error) throw error
  return (data || []) as unknown as PurchaseItem[]
}

export async function fetchSupplierPurchases(businessId: string, supplierId: string) {
  const { data, error } = await supabase
    .from('purchases')
    .select('*, supplier:suppliers(*)')
    .eq('business_id', businessId)
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as unknown as Purchase[]
}

export async function createPurchase(
  businessId: string,
  userId: string,
  purchase: {
    supplier_id: string | null
    supplier_data?: Partial<Supplier>
    payment_method: 'efectivo' | 'transferencia' | 'credito'
    tax: number
    observations: string
    purchase_date: string
    items: PurchaseItem[]
  }
) {
  const subtotal = purchase.items.reduce((s, i) => s + i.total, 0)
  const total = subtotal + purchase.tax
  const status = purchase.payment_method === 'credito' ? 'pendiente' : 'pagada'

  let supplierId = purchase.supplier_id
  if (!supplierId && purchase.supplier_data?.contact_name?.trim()) {
    const s = await createSupplier(businessId, purchase.supplier_data)
    supplierId = s.id
  }

  const { data: row, error: err } = await supabase
    .from('purchases')
    .insert({
      business_id: businessId,
      supplier_id: supplierId,
      user_id: userId,
      payment_method: purchase.payment_method,
      subtotal,
      tax: purchase.tax,
      total,
      status,
      observations: purchase.observations || null,
      purchase_date: purchase.purchase_date,
    })
    .select()
    .single()
  if (err) throw err
  const purchaseId = (row as any).id

  for (const item of purchase.items) {
    const { error: itemErr } = await supabase.from('purchase_items').insert({
      purchase_id: purchaseId,
      product_id: item.product_id,
      name: item.name,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      total: item.total,
    })
    if (itemErr) throw itemErr
    if (item.product_id) {
      await supabase.rpc('increment_stock', { p_id: item.product_id, qty: item.quantity })
      await supabase.rpc('update_product_cost', { p_id: item.product_id, new_cost: item.unit_cost })
      await supabase.from('inventory_movements').insert({
        business_id: businessId,
        product_id: item.product_id,
        type: 'entrada',
        quantity: item.quantity,
        reason: 'Compra a proveedor',
        user_id: userId,
      })
    }
  }

  if (purchase.payment_method === 'credito' && supplierId) {
    await supabase.rpc('increment_supplier_balance', { s_id: supplierId, amount: total })
  }

  return { id: purchaseId }
}

export async function createPurchaseReturn(
  businessId: string,
  userId: string,
  ret: {
    purchase_id: string
    purchase_item_id: string | null
    product_id: string | null
    name: string
    quantity: number
    reason: string
    refund_amount: number
  }
) {
  const { error } = await supabase.from('purchase_returns').insert({
    business_id: businessId,
    purchase_id: ret.purchase_id,
    purchase_item_id: ret.purchase_item_id,
    product_id: ret.product_id,
    name: ret.name,
    quantity: ret.quantity,
    reason: ret.reason,
    refund_amount: ret.refund_amount,
    user_id: userId,
  })
  if (error) throw error
  if (ret.product_id) {
    await supabase.rpc('decrement_stock', { p_id: ret.product_id, qty: ret.quantity })
    await supabase.from('inventory_movements').insert({
      business_id: businessId,
      product_id: ret.product_id,
      type: 'salida',
      quantity: ret.quantity,
      reason: 'Devolución de compra',
      user_id: userId,
    })
  }
}

export type SupplierPayment = {
  id: string
  supplier_id: string
  amount: number
  payment_method: 'efectivo' | 'transferencia' | 'credito'
  note: string | null
  created_at: string
}

export type PriceHistoryEntry = {
  product_id: string
  product_name: string
  unit_cost: number
  purchase_date: string
  invoice_number: string | null
  supplier_name: string | null
}

export async function paySupplier(
  businessId: string,
  userId: string,
  supplierId: string,
  amount: number,
  paymentMethod: 'efectivo' | 'transferencia' | 'credito',
  note?: string
) {
  const { error } = await supabase.from('supplier_payments').insert({
    business_id: businessId,
    supplier_id: supplierId,
    amount,
    payment_method: paymentMethod,
    note: note || null,
    user_id: userId,
  })
  if (error) throw error
}

export async function fetchSupplierPayments(businessId: string, supplierId: string) {
  const { data, error } = await supabase
    .from('supplier_payments')
    .select('*')
    .eq('business_id', businessId)
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as unknown as SupplierPayment[]
}

export async function fetchProductPriceHistory(businessId: string, productId?: string) {
  let query = supabase
    .from('product_price_history')
    .select('*')
    .eq('business_id', businessId)
  if (productId) query = query.eq('product_id', productId)
  const { data, error } = await query.order('purchase_date', { ascending: false }).limit(100)
  if (error) throw error
  return (data || []) as unknown as PriceHistoryEntry[]
}

export async function paySupplierLegacy(businessId: string, supplierId: string, amount: number) {
  await supabase.rpc('decrement_supplier_balance', { s_id: supplierId, amount })
}
