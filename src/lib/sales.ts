import { supabase } from './supabase'

export type Client = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  credit_limit: number
  balance: number
  observations: string | null
  created_at: string
}

export type Product = {
  id: string
  name: string
  sku: string | null
  sale_price: number
  cost: number
  unit: string
  stock: number
  min_stock: number
  active: boolean
}

export type SaleItem = {
  id?: string
  product_id: string | null
  name: string
  quantity: number
  unit_price: number
  unit_cost: number
  profit: number
  total: number
}

export type Sale = {
  id: string
  client_id: string | null
  invoice_number: string | null
  payment_type: 'efectivo' | 'credito'
  subtotal: number
  tax: number
  total: number
  profit: number
  status: 'pagada' | 'pendiente' | 'anulada'
  observations: string | null
  sale_date: string
  created_at: string
  client?: Client | null
  items?: SaleItem[]
}

export async function fetchClients(businessId: string) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('business_id', businessId)
    .order('name', { ascending: true })
  if (error) throw error
  return (data || []) as unknown as Client[]
}

export async function createClient(businessId: string, c: Partial<Client>) {
  const { data, error } = await supabase
    .from('clients')
    .insert({ ...c, business_id: businessId })
    .select()
    .single()
  if (error) throw error
  return data as unknown as Client
}

export async function updateClient(id: string, patch: Partial<Client>) {
  const { error } = await supabase.from('clients').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) throw error
}

export type ClientPayment = {
  id: string
  client_id: string
  amount: number
  payment_method: 'efectivo' | 'transferencia' | 'credito'
  note: string | null
  created_at: string
}

export type ClientReminder = {
  id: string
  client_id: string
  message: string
  due_date: string | null
  status: 'pendiente' | 'enviado' | 'pagado'
  created_at: string
}

export async function fetchClientSales(businessId: string, clientId: string) {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .order('sale_date', { ascending: false })
  if (error) throw error
  return (data || []) as unknown as Sale[]
}

export async function fetchClientPayments(businessId: string, clientId: string) {
  const { data, error } = await supabase
    .from('client_payments')
    .select('*')
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as unknown as ClientPayment[]
}

export async function payClient(
  businessId: string,
  userId: string,
  clientId: string,
  amount: number,
  paymentMethod: 'efectivo' | 'transferencia' | 'credito',
  note?: string
) {
  const { error } = await supabase.from('client_payments').insert({
    business_id: businessId,
    client_id: clientId,
    amount,
    payment_method: paymentMethod,
    note: note || null,
    user_id: userId,
  })
  if (error) throw error
}

export async function fetchClientReminders(businessId: string) {
  const { data, error } = await supabase
    .from('client_reminders')
    .select('*, client:clients(*)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as unknown as (ClientReminder & { client?: Client | null })[]
}

export async function createClientReminder(
  businessId: string,
  userId: string,
  clientId: string,
  message: string,
  dueDate?: string
) {
  const { error } = await supabase.from('client_reminders').insert({
    business_id: businessId,
    client_id: clientId,
    message,
    due_date: dueDate || null,
    user_id: userId,
  })
  if (error) throw error
}

export async function updateReminderStatus(id: string, status: 'pendiente' | 'enviado' | 'pagado') {
  const { error } = await supabase.from('client_reminders').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteReminder(id: string) {
  const { error } = await supabase.from('client_reminders').delete().eq('id', id)
  if (error) throw error
}

export async function fetchProducts(businessId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .order('name', { ascending: true })
  if (error) throw error
  return (data || []) as unknown as Product[]
}

export async function fetchSales(businessId: string) {
  const { data, error } = await supabase
    .from('sales')
    .select('*, client:clients(*)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as unknown as Sale[]
}

export async function fetchSaleItems(saleId: string) {
  const { data, error } = await supabase
    .from('sale_items')
    .select('*')
    .eq('sale_id', saleId)
  if (error) throw error
  return (data || []) as unknown as SaleItem[]
}

export async function fetchReturns(businessId: string) {
  const { data, error } = await supabase
    .from('returns')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as any[]
}

export async function createSale(
  businessId: string,
  userId: string,
  sale: {
    client_id: string | null
    client_name?: string
    payment_type: 'efectivo' | 'credito'
    tax: number
    observations: string
    sale_date: string
    items: SaleItem[]
  }
) {
  const subtotal = sale.items.reduce((s, i) => s + i.total, 0)
  const total = subtotal + sale.tax
  const profit = sale.items.reduce((s, i) => s + i.profit, 0)
  const status = sale.payment_type === 'credito' ? 'pendiente' : 'pagada'

  // Generate invoice number: FAC-YYYYMMDD-XXXX
  const today = new Date()
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const { count } = await supabase
    .from('sales')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
  const invoiceNumber = `FAC-${ymd}-${String((count ?? 0) + 1).padStart(4, '0')}`

  const { data: saleRow, error: saleErr } = await supabase
    .from('sales')
    .insert({
      business_id: businessId,
      client_id: sale.client_id,
      user_id: userId,
      invoice_number: invoiceNumber,
      payment_type: sale.payment_type,
      subtotal,
      tax: sale.tax,
      total,
      profit,
      status,
      observations: sale.observations || null,
      sale_date: sale.sale_date,
    })
    .select()
    .single()
  if (saleErr) throw saleErr
  const saleId = (saleRow as any).id

  // Insert sale items and decrement stock
  for (const item of sale.items) {
    const { error: itemErr } = await supabase.from('sale_items').insert({
      sale_id: saleId,
      product_id: item.product_id,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      unit_cost: item.unit_cost,
      profit: item.profit,
      total: item.total,
    })
    if (itemErr) throw itemErr
    if (item.product_id) {
      await supabase.rpc('decrement_stock', { p_id: item.product_id, qty: item.quantity })
      await supabase.from('inventory_movements').insert({
        business_id: businessId,
        product_id: item.product_id,
        type: 'salida',
        quantity: item.quantity,
        reason: `Venta ${invoiceNumber}`,
        user_id: userId,
      })
    }
  }

  // If credit sale, increase client balance
  if (sale.payment_type === 'credito' && sale.client_id) {
    await supabase.rpc('increment_client_balance', { c_id: sale.client_id, amount: total })
  }

  return { id: saleId, invoiceNumber }
}

export async function createReturn(
  businessId: string,
  userId: string,
  ret: {
    sale_id: string
    sale_item_id: string | null
    product_id: string | null
    name: string
    quantity: number
    reason: string
    refund_amount: number
  }
) {
  const { error } = await supabase.from('returns').insert({
    business_id: businessId,
    sale_id: ret.sale_id,
    sale_item_id: ret.sale_item_id,
    product_id: ret.product_id,
    name: ret.name,
    quantity: ret.quantity,
    reason: ret.reason,
    refund_amount: ret.refund_amount,
    user_id: userId,
  })
  if (error) throw error
  // Restore stock
  if (ret.product_id) {
    await supabase.rpc('increment_stock', { p_id: ret.product_id, qty: ret.quantity })
    await supabase.from('inventory_movements').insert({
      business_id: businessId,
      product_id: ret.product_id,
      type: 'entrada',
      quantity: ret.quantity,
      reason: 'Devolución de venta',
      user_id: userId,
    })
  }
}

export async function updateSaleStatus(saleId: string, status: 'pagada' | 'pendiente' | 'anulada') {
  const { error } = await supabase.from('sales').update({ status }).eq('id', saleId)
  if (error) throw error
}
