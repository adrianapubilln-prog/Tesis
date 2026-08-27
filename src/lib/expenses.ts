import { supabase } from './supabase'

export type ExpenseCategory = {
  id: string
  name: string
  color: string
  is_default: boolean
}

export type Expense = {
  id: string
  category_id: string | null
  supplier_id: string | null
  description: string
  amount: number
  expense_date: string
  payment_method: 'efectivo' | 'transferencia' | 'credito'
  status: 'pagada' | 'pendiente'
  receipt_url: string | null
  receipt_extracted: { amount?: number; date?: string; supplier?: string; category?: string } | null
  created_at: string
  category?: ExpenseCategory | null
}

export async function fetchExpenseCategories(businessId: string) {
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('business_id', businessId)
    .order('name', { ascending: true })
  if (error) throw error
  return (data || []) as unknown as ExpenseCategory[]
}

export async function createExpenseCategory(businessId: string, c: { name: string; color: string }) {
  const { data, error } = await supabase
    .from('expense_categories')
    .insert({ ...c, business_id: businessId })
    .select()
    .single()
  if (error) throw error
  return data as unknown as ExpenseCategory
}

export async function deleteExpenseCategory(id: string) {
  const { error } = await supabase.from('expense_categories').delete().eq('id', id)
  if (error) throw error
}

export async function fetchExpenses(businessId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, category:expense_categories(*)')
    .eq('business_id', businessId)
    .order('expense_date', { ascending: false })
  if (error) throw error
  return (data || []) as unknown as Expense[]
}

export async function createExpense(
  businessId: string,
  userId: string,
  e: {
    category_id: string | null
    supplier_id?: string | null
    description: string
    amount: number
    expense_date: string
    payment_method: 'efectivo' | 'transferencia' | 'credito'
    status: 'pagada' | 'pendiente'
    receipt_url?: string | null
    receipt_extracted?: Expense['receipt_extracted']
  }
) {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      business_id: businessId,
      user_id: userId,
      category_id: e.category_id,
      supplier_id: e.supplier_id || null,
      description: e.description,
      amount: e.amount,
      expense_date: e.expense_date,
      payment_method: e.payment_method,
      status: e.status,
      receipt_url: e.receipt_url || null,
      receipt_extracted: e.receipt_extracted || null,
    })
    .select()
    .single()
  if (error) throw error
  return data as unknown as Expense
}

export async function updateExpense(id: string, patch: Partial<Expense>) {
  const { error } = await supabase.from('expenses').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

export async function uploadReceipt(businessId: string, file: File) {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${businessId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('receipts').upload(path, file, { upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('receipts').getPublicUrl(path)
  return { path, url: data.publicUrl }
}

export function getReceiptUrl(path: string) {
  const { data } = supabase.storage.from('receipts').getPublicUrl(path)
  return data.publicUrl
}

export type MonthlyReport = {
  month: string
  total: number
  byCategory: { name: string; color: string; total: number }[]
  pending: number
  paid: number
}

export function buildMonthlyReport(expenses: Expense[]): MonthlyReport {
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthExpenses = expenses.filter((e) => e.expense_date.startsWith(ym))
  const byCat: Record<string, { name: string; color: string; total: number }> = {}
  let total = 0
  let pending = 0
  let paid = 0
  for (const e of monthExpenses) {
    total += Number(e.amount)
    if (e.status === 'pendiente') pending += Number(e.amount)
    else paid += Number(e.amount)
    const key = e.category?.id || 'sin_cat'
    if (!byCat[key]) byCat[key] = { name: e.category?.name || 'Sin categoría', color: e.category?.color || '#2198C1', total: 0 }
    byCat[key].total += Number(e.amount)
  }
  return {
    month: ym,
    total,
    pending,
    paid,
    byCategory: Object.values(byCat).sort((a, b) => b.total - a.total),
  }
}
