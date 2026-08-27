import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export type Business = {
  id: string
  name: string
  phone: string | null
  address: string | null
  nit: string | null
  type: 'comercial' | 'productora'
  founded_at: string | null
  owner_id: string
  created_at: string
}

export type Role = 'administrador' | 'contador' | 'gerente' | 'auxiliar' | 'vendedor' | 'auditor'

export type ModuleKey = 'dashboard' | 'ventas' | 'compras' | 'gastos' | 'inventario' | 'clientes_proveedores' | 'reportes' | 'configuracion' | 'usuarios'

export type Permission = 'full' | 'view' | null

export type Permissions = Partial<Record<ModuleKey, Permission>>

export type BusinessUser = {
  id: string
  business_id: string
  auth_user_id: string
  name: string
  email: string
  role: Role
  permissions: Permissions | null
  created_at: string
}
