import type { Role, ModuleKey, Permission, Permissions } from './supabase'

const ROLE_LABELS: Record<Role, string> = {
  administrador: 'Administrador',
  contador: 'Contador',
  gerente: 'Propietario / Gerente',
  auxiliar: 'Auxiliar contable',
  vendedor: 'Vendedor / Cajero',
  auditor: 'Auditor / Consultor',
}

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  administrador: 'Control total del sistema: usuarios, configuración, operaciones y bitácora.',
  contador: 'Gestión contable: asientos, ingresos, gastos, inventario, estados financieros y cierres.',
  gerente: 'Supervisión y toma de decisiones: dashboard, ventas, gastos, inventario y reportes.',
  auxiliar: 'Registro de operaciones diarias: compras, ventas, gastos, cobros y pagos.',
  vendedor: 'Solo ventas: crear ventas, registrar clientes y productos, emitir comprobantes.',
  auditor: 'Solo lectura: consultar registros, movimientos, estados financieros e historial.',
}

const DEFAULT_PERMISSIONS: Record<Role, Permissions> = {
  administrador: {
    dashboard: 'full', ventas: 'full', compras: 'full', gastos: 'full',
    inventario: 'full', clientes_proveedores: 'full', reportes: 'full',
    configuracion: 'full', usuarios: 'full',
  },
  contador: {
    dashboard: 'full', ventas: 'full', compras: 'full', gastos: 'full',
    inventario: 'full', clientes_proveedores: 'full', reportes: 'full',
    configuracion: 'view', usuarios: null,
  },
  gerente: {
    dashboard: 'full', ventas: 'full', compras: 'view', gastos: 'full',
    inventario: 'full', clientes_proveedores: 'view', reportes: 'full',
    configuracion: 'view', usuarios: null,
  },
  auxiliar: {
    dashboard: 'view', ventas: 'full', compras: 'full', gastos: 'full',
    inventario: 'view', clientes_proveedores: 'full', reportes: null,
    configuracion: null, usuarios: null,
  },
  vendedor: {
    dashboard: 'view', ventas: 'full', compras: null, gastos: null,
    inventario: 'view', clientes_proveedores: 'view', reportes: null,
    configuracion: null, usuarios: null,
  },
  auditor: {
    dashboard: 'view', ventas: 'view', compras: 'view', gastos: 'view',
    inventario: 'view', clientes_proveedores: 'view', reportes: 'view',
    configuracion: null, usuarios: null,
  },
}

export function getRoleLabel(role: Role): string {
  return ROLE_LABELS[role]
}

export function getRoleDescription(role: Role): string {
  return ROLE_DESCRIPTIONS[role]
}

export function getAllRoles(): Role[] {
  return Object.keys(ROLE_LABELS) as Role[]
}

export function getRolePermissions(role: Role, overrides?: Permissions | null): Permissions {
  const base = DEFAULT_PERMISSIONS[role]
  if (!overrides) return base
  return { ...base, ...overrides }
}

export function canAccess(role: Role, module: ModuleKey, overrides?: Permissions | null): boolean {
  const perms = getRolePermissions(role, overrides)
  return perms[module] != null
}

export function canEdit(role: Role, module: ModuleKey, overrides?: Permissions | null): boolean {
  const perms = getRolePermissions(role, overrides)
  return perms[module] === 'full'
}

export function getPermissionLevel(role: Role, module: ModuleKey, overrides?: Permissions | null): Permission {
  const perms = getRolePermissions(role, overrides)
  return perms[module] ?? null
}
