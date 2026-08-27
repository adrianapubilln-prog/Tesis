/*
# Expand roles and add per-user permissions

1. Changes
- Expand business_users.role CHECK constraint from 3 values to 6:
  administrador, contador, gerente, auxiliar, vendedor, auditor
- Add business_users.permissions column (jsonb, default '{}') — stores a
  per-module permission map so the frontend can show/hide modules per user.
  Example: {"dashboard":"view","ventas":"view","compras":null,...}
  Values: "full" | "view" | null per module key.

2. Security
- No RLS policy changes. Existing policies on business_users still apply
  (owner can CRUD, members can SELECT their own row). The new column is
  covered by those existing policies automatically.

3. Notes
- Existing rows keep their current role ('administrador','empleado','contador').
  A follow-up data step maps 'empleado' → 'auxiliar'.
- The permissions column is optional; when empty the frontend falls back to
  the default permission set for the user's role.
*/

-- 1. Expand the role check constraint
ALTER TABLE business_users DROP CONSTRAINT IF EXISTS business_users_role_check;
ALTER TABLE business_users ADD CONSTRAINT business_users_role_check
  CHECK (role IN ('administrador','contador','gerente','auxiliar','vendedor','auditor'));

-- 2. Add permissions jsonb column
ALTER TABLE business_users ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}';

-- 3. Migrate legacy 'empleado' rows to 'auxiliar'
UPDATE business_users SET role = 'auxiliar' WHERE role = 'empleado';