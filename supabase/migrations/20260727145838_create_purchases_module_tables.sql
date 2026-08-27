/*
# Create suppliers, purchases, purchase_items, purchase_returns tables

1. New Tables
- `suppliers`: suppliers/providers of a business.
  - id, business_id, contact_name (person), company_name, phone, email,
    address, products_supplied (text note of what they supply),
    balance (amount owed to supplier), observations, created_at.
- `purchases`: main purchase record.
  - id, business_id, supplier_id, user_id, invoice_number (from supplier),
    payment_method (efectivo/transferencia/credito), subtotal, tax, total,
    status (pagada/pendiente/anulada), observations, purchase_date, created_at.
- `purchase_items`: products in each purchase.
  - id, purchase_id, product_id, name, quantity, unit_cost, total.
  On insert, product stock increases and product.cost updates to the latest
  unit_cost.
- `purchase_returns`: returns of purchases to suppliers.
  - id, business_id, purchase_id, purchase_item_id, product_id, name, quantity,
    reason, refund_amount, user_id, created_at.
  On insert, product stock decreases.

2. Security
- RLS enabled on all tables, scoped to the business owner via
  EXISTS (SELECT 1 FROM businesses b WHERE b.id = <table>.business_id AND
  b.owner_id = auth.uid()).
- purchase_items scoped through its parent purchase's business_id.
- 4 CRUD policies per table (select/insert/update/delete).

3. Notes
- Stock changes are handled in the frontend using existing RPCs
  (increment_stock / decrement_stock) plus inventory_movements rows.
- supplier.balance increases on credit purchases and decreases when a payment
  is registered (via increment_supplier_balance / decrement_supplier_balance
  RPCs added in this migration).
*/

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  company_name text,
  phone text,
  email text,
  address text,
  products_supplied text,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  observations text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_suppliers" ON suppliers;
CREATE POLICY "select_suppliers" ON suppliers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = suppliers.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_suppliers" ON suppliers;
CREATE POLICY "insert_suppliers" ON suppliers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = suppliers.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_suppliers" ON suppliers;
CREATE POLICY "update_suppliers" ON suppliers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = suppliers.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = suppliers.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_suppliers" ON suppliers;
CREATE POLICY "delete_suppliers" ON suppliers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = suppliers.business_id AND b.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_number text,
  payment_method text NOT NULL DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo','transferencia','credito')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pagada' CHECK (status IN ('pagada','pendiente','anulada')),
  observations text,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_purchases" ON purchases;
CREATE POLICY "select_purchases" ON purchases FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = purchases.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_purchases" ON purchases;
CREATE POLICY "insert_purchases" ON purchases FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = purchases.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_purchases" ON purchases;
CREATE POLICY "update_purchases" ON purchases FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = purchases.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = purchases.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_purchases" ON purchases;
CREATE POLICY "delete_purchases" ON purchases FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = purchases.business_id AND b.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity numeric(14,2) NOT NULL,
  unit_cost numeric(12,2) NOT NULL,
  total numeric(12,2) NOT NULL DEFAULT 0
);
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_purchase_items" ON purchase_items;
CREATE POLICY "select_purchase_items" ON purchase_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM purchases p JOIN businesses b ON b.id = p.business_id WHERE p.id = purchase_items.purchase_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_purchase_items" ON purchase_items;
CREATE POLICY "insert_purchase_items" ON purchase_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM purchases p JOIN businesses b ON b.id = p.business_id WHERE p.id = purchase_items.purchase_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_purchase_items" ON purchase_items;
CREATE POLICY "update_purchase_items" ON purchase_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM purchases p JOIN businesses b ON b.id = p.business_id WHERE p.id = purchase_items.purchase_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM purchases p JOIN businesses b ON b.id = p.business_id WHERE p.id = purchase_items.purchase_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_purchase_items" ON purchase_items;
CREATE POLICY "delete_purchase_items" ON purchase_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM purchases p JOIN businesses b ON b.id = p.business_id WHERE p.id = purchase_items.purchase_id AND b.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS purchase_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  purchase_item_id uuid REFERENCES purchase_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity numeric(14,2) NOT NULL,
  reason text,
  refund_amount numeric(12,2) NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE purchase_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_purchase_returns" ON purchase_returns;
CREATE POLICY "select_purchase_returns" ON purchase_returns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = purchase_returns.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_purchase_returns" ON purchase_returns;
CREATE POLICY "insert_purchase_returns" ON purchase_returns FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = purchase_returns.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_purchase_returns" ON purchase_returns;
CREATE POLICY "update_purchase_returns" ON purchase_returns FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = purchase_returns.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = purchase_returns.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_purchase_returns" ON purchase_returns;
CREATE POLICY "delete_purchase_returns" ON purchase_returns FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = purchase_returns.business_id AND b.owner_id = auth.uid()));

-- Helper RPCs for supplier balance
CREATE OR REPLACE FUNCTION increment_supplier_balance(s_id uuid, amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE suppliers SET balance = balance + amount WHERE id = s_id;
END $$;

CREATE OR REPLACE FUNCTION decrement_supplier_balance(s_id uuid, amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE suppliers SET balance = GREATEST(0, balance - amount) WHERE id = s_id;
END $$;

-- Helper RPC to update product cost to the latest purchase unit cost
CREATE OR REPLACE FUNCTION update_product_cost(p_id uuid, new_cost numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products SET cost = new_cost WHERE id = p_id;
END $$;

GRANT EXECUTE ON FUNCTION increment_supplier_balance TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_supplier_balance TO authenticated;
GRANT EXECUTE ON FUNCTION update_product_cost TO authenticated;
