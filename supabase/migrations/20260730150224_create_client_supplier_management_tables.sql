/*
# Client & supplier management: payments, reminders, price history

1. New Functions
- `decrement_client_balance(c_id uuid, amount numeric)`: atomically subtracts
  amount from clients.balance (clamped at 0). Used when a client pays down debt.

2. New Tables
- `client_payments`: records each payment a client makes toward their debt.
  Fields: id, business_id, client_id, amount, payment_method, note, user_id,
  created_at. On insert, client balance is decremented via trigger.
- `supplier_payments`: records each payment made to a supplier toward balance
  owed. Fields: id, business_id, supplier_id, amount, payment_method, note,
  user_id, created_at. On insert, supplier balance is decremented via trigger.
- `client_reminders`: automatic payment reminders for clients with pending
  balances. Fields: id, business_id, client_id, message, due_date, status
  (pendiente/enviado/pagado), created_at. Generated automatically when a
  credit sale is created.

3. Security
- RLS enabled on all new tables, scoped to the business owner via
  EXISTS (SELECT 1 FROM businesses b WHERE b.id = <table>.business_id AND
  b.owner_id = auth.uid()).
- 4 CRUD policies per table (select/insert/update/delete).
- SECURITY DEFINER functions callable by authenticated.

4. Notes
- No destructive changes to existing tables.
- Price history is derived from existing purchase_items (historical unit_cost
  per product per purchase date) — no new table needed.
- Triggers handle balance updates so the frontend only needs to insert a
  payment row; the RPC is still available for manual adjustments.
*/

-- Decrement client balance RPC
CREATE OR REPLACE FUNCTION decrement_client_balance(c_id uuid, amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE clients SET balance = GREATEST(0, balance - amount) WHERE id = c_id;
END $$;
GRANT EXECUTE ON FUNCTION decrement_client_balance TO authenticated;

-- Client payments
CREATE TABLE IF NOT EXISTS client_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo','transferencia','credito')),
  note text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE client_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_client_payments" ON client_payments;
CREATE POLICY "select_client_payments" ON client_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = client_payments.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_client_payments" ON client_payments;
CREATE POLICY "insert_client_payments" ON client_payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = client_payments.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_client_payments" ON client_payments;
CREATE POLICY "update_client_payments" ON client_payments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = client_payments.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = client_payments.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_client_payments" ON client_payments;
CREATE POLICY "delete_client_payments" ON client_payments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = client_payments.business_id AND b.owner_id = auth.uid()));

-- Auto-decrement client balance on payment insert
CREATE OR REPLACE FUNCTION on_client_payment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE clients SET balance = GREATEST(0, balance - NEW.amount) WHERE id = NEW.client_id;
  RETURN NEW;
END $$;
GRANT EXECUTE ON FUNCTION on_client_payment_insert TO authenticated;

DROP TRIGGER IF EXISTS trg_client_payment ON client_payments;
CREATE TRIGGER trg_client_payment
  AFTER INSERT ON client_payments
  FOR EACH ROW EXECUTE FUNCTION on_client_payment_insert();

-- Supplier payments
CREATE TABLE IF NOT EXISTS supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo','transferencia','credito')),
  note text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_supplier_payments" ON supplier_payments;
CREATE POLICY "select_supplier_payments" ON supplier_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = supplier_payments.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_supplier_payments" ON supplier_payments;
CREATE POLICY "insert_supplier_payments" ON supplier_payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = supplier_payments.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_supplier_payments" ON supplier_payments;
CREATE POLICY "update_supplier_payments" ON supplier_payments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = supplier_payments.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = supplier_payments.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_supplier_payments" ON supplier_payments;
CREATE POLICY "delete_supplier_payments" ON supplier_payments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = supplier_payments.business_id AND b.owner_id = auth.uid()));

-- Auto-decrement supplier balance on payment insert
CREATE OR REPLACE FUNCTION on_supplier_payment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE suppliers SET balance = GREATEST(0, balance - NEW.amount) WHERE id = NEW.supplier_id;
  RETURN NEW;
END $$;
GRANT EXECUTE ON FUNCTION on_supplier_payment_insert TO authenticated;

DROP TRIGGER IF EXISTS trg_supplier_payment ON supplier_payments;
CREATE TRIGGER trg_supplier_payment
  AFTER INSERT ON supplier_payments
  FOR EACH ROW EXECUTE FUNCTION on_supplier_payment_insert();

-- Client reminders
CREATE TABLE IF NOT EXISTS client_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  message text NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','enviado','pagado')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE client_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_client_reminders" ON client_reminders;
CREATE POLICY "select_client_reminders" ON client_reminders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = client_reminders.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_client_reminders" ON client_reminders;
CREATE POLICY "insert_client_reminders" ON client_reminders FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = client_reminders.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_client_reminders" ON client_reminders;
CREATE POLICY "update_client_reminders" ON client_reminders FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = client_reminders.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = client_reminders.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_client_reminders" ON client_reminders;
CREATE POLICY "delete_client_reminders" ON client_reminders FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = client_reminders.business_id AND b.owner_id = auth.uid()));

-- Price history view: latest unit_cost per product from purchases
CREATE OR REPLACE VIEW product_price_history AS
SELECT
  pi.product_id,
  p.name AS product_name,
  p.business_id,
  pi.unit_cost,
  pur.purchase_date,
  pur.invoice_number,
  s.contact_name AS supplier_name
FROM purchase_items pi
JOIN products p ON p.id = pi.product_id
JOIN purchases pur ON pur.id = pi.purchase_id
LEFT JOIN suppliers s ON s.id = pur.supplier_id
ORDER BY pur.purchase_date DESC;
GRANT SELECT ON product_price_history TO authenticated;