import { supabase } from './supabase'
import { getRolePermissions, getRoleLabel } from './permissions'
import type { Role, ModuleKey, BusinessUser } from './supabase'

export type UserWithAccess = BusinessUser & {
  access_summary: { module: ModuleKey; label: string; level: 'full' | 'view' | null }[]
}

const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'Dashboard',
  ventas: 'Ventas',
  compras: 'Compras',
  gastos: 'Gastos',
  inventario: 'Inventario',
  clientes_proveedores: 'Clientes y Proveedores',
  reportes: 'Reportes',
  configuracion: 'Configuración',
  usuarios: 'Usuarios',
}

const MODULE_ORDER: ModuleKey[] = ['dashboard', 'ventas', 'compras', 'gastos', 'inventario', 'clientes_proveedores', 'reportes', 'usuarios', 'configuracion']

export async function fetchBusinessUsers(businessId: string): Promise<UserWithAccess[]> {
  const { data, error } = await supabase
    .from('business_users')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const users = (data || []) as unknown as BusinessUser[]
  return users.map((u) => {
    const perms = getRolePermissions(u.role, u.permissions)
    const access_summary = MODULE_ORDER.map((m) => ({
      module: m,
      label: MODULE_LABELS[m],
      level: perms[m] ?? null,
    }))
    return { ...u, access_summary }
  })
}

export async function createBusinessUser(
  businessId: string,
  user: { name: string; email: string; role: Role }
): Promise<BusinessUser> {
  const { data, error } = await supabase
    .from('business_users')
    .insert({
      business_id: businessId,
      auth_user_id: null,
      name: user.name,
      email: user.email,
      role: user.role,
    })
    .select()
    .single()
  if (error) throw error
  return data as unknown as BusinessUser
}

export async function updateBusinessUserRole(id: string, role: Role) {
  const { error } = await supabase.from('business_users').update({ role }).eq('id', id)
  if (error) throw error
}

export async function deleteBusinessUser(id: string) {
  const { error } = await supabase.from('business_users').delete().eq('id', id)
  if (error) throw error
}

export { getRoleLabel, MODULE_LABELS }
