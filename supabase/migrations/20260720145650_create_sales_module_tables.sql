/*
# Create clients, categories, products, sales, sale_items, returns, inventory_movements

1. New Tables
- `clients`: clients of a business. Fields: id, business_id, name, phone, email,
  address, credit_limit, balance (current debt), observations, created_at.
- `categories`: product categories. Fields: id, business_id, name, color,
  description, created_at.
- `products`: products sold by the business. Fields: id, business_id, name,
  description, sku, sale_price, cost, unit, stock, min_stock, category_id,
  image_url, active, created_at.
- `sales`: main sales record. Fields: id, business_id, client_id, user_id,
  invoice_number, payment_type (efectivo/credito), subtotal, tax, total, profit,
  status (pagada/pendiente/anulada), observations, sale_date, created_at.
- `sale_items`: products in each sale. Fields: id, sale_id, product_id, name,
  quantity, unit_price, unit_cost, profit, total.
- `returns`: returns/refunds. Fields: id, business_id, sale_id, sale_item_id,
  product_id, name, quantity, reason, refund_amount, user_id, created_at.
- `inventory_movements`: stock movements. Fields: id, business_id, product_id,
  type (entrada/salida), quantity, reason, user_id, created_at.

2. Security
- RLS enabled on all tables, scoped to the business owner via
  EXISTS (SELECT 1 FROM businesses b WHERE b.id = <table>.business_id AND
  b.owner_id = auth.uid()).
- 4 CRUD policies per table (select/insert/update/delete).
- sale_items scoped through its parent sale's business_id.

3. Notes
- stock on products is decremented by sale_items insert and restored on returns
  (handled in the frontend for now).
- sale_items.name snapshots the product name at sale time so historical sales
  remain readable even if the product is later renamed or deleted.
*/

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  credit_limit numeric(12,2) DEFAULT 0,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  observations text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_clients" ON clients;
CREATE POLICY "select_clients" ON clients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = clients.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_clients" ON clients;
CREATE POLICY "insert_clients" ON clients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = clients.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_clients" ON clients;
CREATE POLICY "update_clients" ON clients FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = clients.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = clients.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_clients" ON clients;
CREATE POLICY "delete_clients" ON clients FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = clients.business_id AND b.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#778c43',
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_categories" ON categories;
CREATE POLICY "select_categories" ON categories FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = categories.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_categories" ON categories;
CREATE POLICY "insert_categories" ON categories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = categories.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_categories" ON categories;
CREATE POLICY "update_categories" ON categories FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = categories.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = categories.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_categories" ON categories;
CREATE POLICY "delete_categories" ON categories FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = categories.business_id AND b.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sku text,
  sale_price numeric(12,2) NOT NULL DEFAULT 0,
  cost numeric(12,2) NOT NULL DEFAULT 0,
  unit text DEFAULT 'unidad',
  stock numeric(14,2) NOT NULL DEFAULT 0,
  min_stock numeric(14,2) DEFAULT 0,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  image_url text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_products" ON products;
CREATE POLICY "select_products" ON products FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = products.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_products" ON products;
CREATE POLICY "insert_products" ON products FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = products.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_products" ON products;
CREATE POLICY "update_products" ON products FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = products.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = products.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_products" ON products;
CREATE POLICY "delete_products" ON products FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = products.business_id AND b.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_number text,
  payment_type text NOT NULL DEFAULT 'efectivo' CHECK (payment_type IN ('efectivo','credito')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  profit numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pagada' CHECK (status IN ('pagada','pendiente','anulada')),
  observations text,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_sales" ON sales;
CREATE POLICY "select_sales" ON sales FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = sales.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_sales" ON sales;
CREATE POLICY "insert_sales" ON sales FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = sales.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_sales" ON sales;
CREATE POLICY "update_sales" ON sales FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = sales.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = sales.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_sales" ON sales;
CREATE POLICY "delete_sales" ON sales FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = sales.business_id AND b.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity numeric(14,2) NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  profit numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0
);
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_sale_items" ON sale_items;
CREATE POLICY "select_sale_items" ON sale_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM sales s JOIN businesses b ON b.id = s.business_id WHERE s.id = sale_items.sale_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_sale_items" ON sale_items;
CREATE POLICY "insert_sale_items" ON sale_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM sales s JOIN businesses b ON b.id = s.business_id WHERE s.id = sale_items.sale_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_sale_items" ON sale_items;
CREATE POLICY "update_sale_items" ON sale_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM sales s JOIN businesses b ON b.id = s.business_id WHERE s.id = sale_items.sale_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM sales s JOIN businesses b ON b.id = s.business_id WHERE s.id = sale_items.sale_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_sale_items" ON sale_items;
CREATE POLICY "delete_sale_items" ON sale_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM sales s JOIN businesses b ON b.id = s.business_id WHERE s.id = sale_items.sale_id AND b.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  sale_item_id uuid REFERENCES sale_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity numeric(14,2) NOT NULL,
  reason text,
  refund_amount numeric(12,2) NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_returns" ON returns;
CREATE POLICY "select_returns" ON returns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = returns.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_returns" ON returns;
CREATE POLICY "insert_returns" ON returns FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = returns.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_returns" ON returns;
CREATE POLICY "update_returns" ON returns FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = returns.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = returns.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_returns" ON returns;
CREATE POLICY "delete_returns" ON returns FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = returns.business_id AND b.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('entrada','salida')),
  quantity numeric(14,2) NOT NULL,
  reason text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_inventory_movements" ON inventory_movements;
CREATE POLICY "select_inventory_movements" ON inventory_movements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = inventory_movements.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_inventory_movements" ON inventory_movements;
CREATE POLICY "insert_inventory_movements" ON inventory_movements FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = inventory_movements.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_inventory_movements" ON inventory_movements;
CREATE POLICY "update_inventory_movements" ON inventory_movements FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = inventory_movements.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = inventory_movements.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_inventory_movements" ON inventory_movements;
CREATE POLICY "delete_inventory_movements" ON inventory_movements FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = inventory_movements.business_id AND b.owner_id = auth.uid()));
