import { supabase } from './supabase'

export type PayrollEntry = {
  id: string
  business_id: string
  employee_name: string
  position: string | null
  department: 'administracion' | 'ventas' | 'produccion' | 'otro'
  payment_type: 'salario' | 'bono' | 'comision' | 'horas_extra'
  base_salary: number
  bonuses: number
  commissions: number
  overtime: number
  deductions: number
  employer_contributions: number
  net_pay: number
  pay_date: string
  period: string
  payment_method: 'efectivo' | 'transferencia' | 'cheque'
  observations: string | null
  user_id: string | null
  created_at: string
}

export type PayrollInput = {
  employee_name: string
  position: string | null
  department: PayrollEntry['department']
  payment_type: PayrollEntry['payment_type']
  base_salary: number
  bonuses: number
  commissions: number
  overtime: number
  deductions: number
  employer_contributions: number
  net_pay: number
  pay_date: string
  period: string
  payment_method: PayrollEntry['payment_method']
  observations: string | null
}

export function computeNetPay(e: {
  base_salary: number
  bonuses: number
  commissions: number
  overtime: number
  deductions: number
  employer_contributions: number
}): number {
  const gross = Number(e.base_salary) + Number(e.bonuses) + Number(e.commissions) + Number(e.overtime)
  const net = gross - Number(e.deductions) - Number(e.employer_contributions)
  return Math.max(0, net)
}

export async function fetchPayroll(businessId: string, period?: string) {
  let q = supabase.from('payroll').select('*').eq('business_id', businessId)
  if (period) q = q.eq('period', period)
  const { data, error } = await q.order('pay_date', { ascending: false })
  if (error) throw error
  return (data || []) as unknown as PayrollEntry[]
}

export async function createPayroll(businessId: string, userId: string, entry: PayrollInput) {
  const { data, error } = await supabase
    .from('payroll')
    .insert({ ...entry, business_id: businessId, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data as unknown as PayrollEntry
}

export async function deletePayroll(id: string) {
  const { error } = await supabase.from('payroll').delete().eq('id', id)
  if (error) throw error
}

export function getAvailablePeriods(): string[] {
  const periods: string[] = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return periods.reverse()
}

export function formatPeriod(period: string): string {
  const [y, m] = period.split('-')
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return `${months[parseInt(m) - 1] || m} ${y}`
}
