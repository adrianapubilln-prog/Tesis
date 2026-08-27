import { supabase } from './supabase'

export type DashboardKPIs = {
  today_sales: number
  month_sales: number
  month_profit: number
  month_expenses: number
  net_profit: number
  pending_client_balance: number
  pending_supplier_balance: number
  low_stock_count: number
  inventory_value: number
  sales_this_month: number
  expenses_this_month: number
}

export type CashflowPoint = {
  month: string
  income: number
  expenses: number
  net: number
}

export type TopProduct = {
  product_id: string
  product_name: string
  total_quantity: number
  total_revenue: number
  total_profit: number
}

export type ActivityItem = {
  id: string
  activity_type: 'sale' | 'purchase' | 'expense'
  reference: string | null
  amount: number
  activity_date: string
  status: string
}

export async function fetchDashboardKPIs(businessId: string): Promise<DashboardKPIs> {
  const { data, error } = await supabase.rpc('get_dashboard_kpis', { b_id: businessId })
  if (error) throw error
  if (!data || data.length === 0) {
    return {
      today_sales: 0, month_sales: 0, month_profit: 0, month_expenses: 0,
      net_profit: 0, pending_client_balance: 0, pending_supplier_balance: 0,
      low_stock_count: 0, inventory_value: 0, sales_this_month: 0, expenses_this_month: 0,
    }
  }
  const r = data[0]
  return {
    today_sales: Number(r.today_sales) || 0,
    month_sales: Number(r.month_sales) || 0,
    month_profit: Number(r.month_profit) || 0,
    month_expenses: Number(r.month_expenses) || 0,
    net_profit: Number(r.net_profit) || 0,
    pending_client_balance: Number(r.pending_client_balance) || 0,
    pending_supplier_balance: Number(r.pending_supplier_balance) || 0,
    low_stock_count: Number(r.low_stock_count) || 0,
    inventory_value: Number(r.inventory_value) || 0,
    sales_this_month: Number(r.sales_this_month) || 0,
    expenses_this_month: Number(r.expenses_this_month) || 0,
  }
}

export async function fetchCashflow(businessId: string, months = 12): Promise<CashflowPoint[]> {
  const { data, error } = await supabase
    .from('dashboard_cashflow')
    .select('*')
    .eq('business_id', businessId)
    .order('month', { ascending: true })
    .limit(months)
  if (error) throw error
  return (data || []).map((d: any) => ({
    month: d.month,
    income: Number(d.income) || 0,
    expenses: Number(d.expenses) || 0,
    net: Number(d.net) || 0,
  }))
}

export async function fetchTopProducts(businessId: string, limit = 5): Promise<TopProduct[]> {
  const { data, error } = await supabase
    .from('top_products_by_sales')
    .select('*')
    .eq('business_id', businessId)
    .order('total_revenue', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []).map((d: any) => ({
    product_id: d.product_id,
    product_name: d.product_name,
    total_quantity: Number(d.total_quantity) || 0,
    total_revenue: Number(d.total_revenue) || 0,
    total_profit: Number(d.total_profit) || 0,
  }))
}

export async function fetchRecentActivity(businessId: string, limit = 8): Promise<ActivityItem[]> {
  const { data, error } = await supabase
    .from('recent_activity')
    .select('*')
    .eq('business_id', businessId)
    .order('activity_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []) as unknown as ActivityItem[]
}
