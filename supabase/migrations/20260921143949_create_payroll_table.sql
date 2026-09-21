/*
# Create payroll/salaries table

1. New Tables
- `payroll`: stores salary payments for employees of a business.
  - id (uuid PK)
  - business_id (uuid FK -> businesses, cascade)
  - employee_name (text, required) — name of the employee
  - position (text) — cargo o puesto
  - department (text) — area o departamento: 'administracion','ventas','produccion','otro'
  - payment_type (text) — 'salario','bono','comision','horas_extra'
  - base_salary (numeric, default 0) — salario base
  - bonuses (numeric, default 0) — bonificaciones (optional)
  - commissions (numeric, default 0) — comisiones (optional)
  - overtime (numeric, default 0) — horas extra (optional)
  - deductions (numeric, default 0) — descuentos o deducciones
  - employer_contributions (numeric, default 0) — prestaciones/aportes patronales (optional)
  - net_pay (numeric, required) — salario neto pagado (auto-calculated)
  - pay_date (date, required) — fecha de pago
  - period (text, required) — período, ej. "2026-09"
  - payment_method (text) — 'efectivo','transferencia','cheque'
  - observations (text)
  - user_id (uuid FK -> auth.users) — who registered it
  - created_at (timestamptz)

2. Security
- Enable RLS on payroll.
- Owner-scoped CRUD via businesses.owner_id check (same pattern as other tables).
*/

CREATE TABLE IF NOT EXISTS payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  employee_name text NOT NULL,
  position text,
  department text DEFAULT 'otro' CHECK (department IN ('administracion','ventas','produccion','otro')),
  payment_type text NOT NULL DEFAULT 'salario' CHECK (payment_type IN ('salario','bono','comision','horas_extra')),
  base_salary numeric NOT NULL DEFAULT 0,
  bonuses numeric NOT NULL DEFAULT 0,
  commissions numeric NOT NULL DEFAULT 0,
  overtime numeric NOT NULL DEFAULT 0,
  deductions numeric NOT NULL DEFAULT 0,
  employer_contributions numeric NOT NULL DEFAULT 0,
  net_pay numeric NOT NULL DEFAULT 0,
  pay_date date NOT NULL,
  period text NOT NULL,
  payment_method text NOT NULL DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo','transferencia','cheque')),
  observations text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_payroll" ON payroll;
CREATE POLICY "select_payroll" ON payroll
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = payroll.business_id AND b.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM business_users bu WHERE bu.business_id = payroll.business_id AND bu.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_payroll" ON payroll
;
CREATE POLICY "insert_payroll" ON payroll
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = payroll.business_id AND b.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_payroll" ON payroll;
CREATE POLICY "update_payroll" ON payroll
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = payroll.business_id AND b.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = payroll.business_id AND b.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_payroll" ON payroll;
CREATE POLICY "delete_payroll" ON payroll
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = payroll.business_id AND b.owner_id = auth.uid())
  );

-- Index for period queries
CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll(business_id, period);
CREATE INDEX IF NOT EXISTS idx_payroll_date ON payroll(business_id, pay_date DESC);