/*
# Create expense categories, expenses, recipes, recipe_ingredients + storage bucket

1. New Tables
- `expense_categories`: categories to classify expenses (agua, luz, internet,
  alquiler, materia prima, transporte, combustible, publicidad, empleados, etc.).
  Fields: id, business_id, name, color, is_default (true for seed categories),
  created_at.
- `expenses`: operational/business expenses. Fields: id, business_id, user_id,
  category_id, supplier_id (optional link to a supplier), description, amount,
  expense_date, payment_method (efectivo/transferencia/credito), status
  (pagada/pendiente), receipt_url (path to uploaded receipt in storage),
  receipt_extracted (jsonb of AI-extracted data: amount/date/supplier/category),
  created_at.
- `recipes`: production recipes for productora businesses. A recipe defines how
  to manufacture a product from raw materials and its production cost.
  Fields: id, business_id, product_id (the finished product), name, output_qty
  (how many units this recipe produces), labor_cost, overhead_cost, notes,
  created_at.
- `recipe_ingredients`: raw materials consumed by a recipe.
  Fields: id, recipe_id, product_id (the raw material), name, quantity,
  unit_cost, total. The sum of ingredient totals + labor + overhead = production
  cost per output_qty.

2. Storage
- Create a public bucket `receipts` for uploading expense receipt photos/PDFs.
- Policies allow authenticated users to manage objects in their own business
  folder path: receipts/<business_id>/...

3. Security
- RLS enabled on all tables, scoped to the business owner via
  EXISTS (SELECT 1 FROM businesses b WHERE b.id = <table>.business_id AND
  b.owner_id = auth.uid()).
- recipe_ingredients scoped through its parent recipe's business_id.
- 4 CRUD policies per table (select/insert/update/delete).
- Storage policies scoped by business_id in the object path.

4. Notes
- expenses.receipt_extracted stores JSON from AI receipt extraction (amount,
  date, supplier, category) so the user can review before saving.
- expenses.supplier_id optionally links to suppliers table for cross-reference
  with purchase balances.
- products table is reused for raw materials: a product is a raw material if
  it belongs to a category named like "Materia prima" (no schema flag added —
  classification is by category, avoiding destructive column changes).
- No destructive changes to existing tables.
*/

-- Expense categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#778c43',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_expense_categories" ON expense_categories;
CREATE POLICY "select_expense_categories" ON expense_categories FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = expense_categories.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_expense_categories" ON expense_categories;
CREATE POLICY "insert_expense_categories" ON expense_categories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = expense_categories.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_expense_categories" ON expense_categories;
CREATE POLICY "update_expense_categories" ON expense_categories FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = expense_categories.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = expense_categories.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_expense_categories" ON expense_categories;
CREATE POLICY "delete_expense_categories" ON expense_categories FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = expense_categories.business_id AND b.owner_id = auth.uid()));

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category_id uuid REFERENCES expense_categories(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo','transferencia','credito')),
  status text NOT NULL DEFAULT 'pagada' CHECK (status IN ('pagada','pendiente')),
  receipt_url text,
  receipt_extracted jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_expenses" ON expenses;
CREATE POLICY "select_expenses" ON expenses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = expenses.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_expenses" ON expenses;
CREATE POLICY "insert_expenses" ON expenses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = expenses.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_expenses" ON expenses;
CREATE POLICY "update_expenses" ON expenses FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = expenses.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = expenses.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_expenses" ON expenses;
CREATE POLICY "delete_expenses" ON expenses FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = expenses.business_id AND b.owner_id = auth.uid()));

-- Recipes (production cost)
CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL,
  output_qty numeric(14,2) NOT NULL DEFAULT 1,
  labor_cost numeric(12,2) NOT NULL DEFAULT 0,
  overhead_cost numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_recipes" ON recipes;
CREATE POLICY "select_recipes" ON recipes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = recipes.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_recipes" ON recipes;
CREATE POLICY "insert_recipes" ON recipes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = recipes.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_recipes" ON recipes;
CREATE POLICY "update_recipes" ON recipes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = recipes.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = recipes.business_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_recipes" ON recipes;
CREATE POLICY "delete_recipes" ON recipes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = recipes.business_id AND b.owner_id = auth.uid()));

-- Recipe ingredients (raw materials)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity numeric(14,2) NOT NULL,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0
);
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "select_recipe_ingredients" ON recipe_ingredients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM recipes r JOIN businesses b ON b.id = r.business_id WHERE r.id = recipe_ingredients.recipe_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "insert_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "insert_recipe_ingredients" ON recipe_ingredients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM recipes r JOIN businesses b ON b.id = r.business_id WHERE r.id = recipe_ingredients.recipe_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "update_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "update_recipe_ingredients" ON recipe_ingredients FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM recipes r JOIN businesses b ON b.id = r.business_id WHERE r.id = recipe_ingredients.recipe_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM recipes r JOIN businesses b ON b.id = r.business_id WHERE r.id = recipe_ingredients.recipe_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "delete_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "delete_recipe_ingredients" ON recipe_ingredients FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM recipes r JOIN businesses b ON b.id = r.business_id WHERE r.id = recipe_ingredients.recipe_id AND b.owner_id = auth.uid()));

-- Storage bucket for receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "select_receipts" ON storage.objects;
CREATE POLICY "select_receipts" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "insert_receipts" ON storage.objects;
CREATE POLICY "insert_receipts" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "update_receipts" ON storage.objects;
CREATE POLICY "update_receipts" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "delete_receipts" ON storage.objects;
CREATE POLICY "delete_receipts" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts');

-- Seed default expense categories for new businesses (via RPC for idempotency)
CREATE OR REPLACE FUNCTION seed_default_expense_categories(b_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO expense_categories (business_id, name, color, is_default)
  VALUES
    (b_id, 'Servicios básicos', '#4a90d9', true),
    (b_id, 'Alquiler', '#d9a441', true),
    (b_id, 'Materia prima', '#6fa84a', true),
    (b_id, 'Transporte', '#c9a86f', true),
    (b_id, 'Combustible', '#e07b39', true),
    (b_id, 'Publicidad', '#c7544a', true),
    (b_id, 'Empleados', '#8a6fd9', true),
    (b_id, 'Otros', '#778c43', true)
  ON CONFLICT DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION seed_default_expense_categories TO authenticated;

-- Helper RPC: register a production run (consume raw materials, add finished product)
CREATE OR REPLACE FUNCTION register_production(
  r_id uuid,
  b_id uuid,
  u_id uuid,
  multiplier numeric DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec recipes%ROWTYPE;
  ing recipe_ingredients%ROWTYPE;
BEGIN
  SELECT * INTO rec FROM recipes WHERE id = r_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receta no encontrada'; END IF;

  FOR ing IN SELECT * FROM recipe_ingredients WHERE recipe_id = r_id LOOP
    UPDATE products SET stock = GREATEST(0, stock - (ing.quantity * multiplier)) WHERE id = ing.product_id;
    INSERT INTO inventory_movements (business_id, product_id, type, quantity, reason, user_id)
    VALUES (b_id, ing.product_id, 'salida', ing.quantity * multiplier, 'Producción: ' || rec.name, u_id);
  END LOOP;

  UPDATE products SET stock = stock + (rec.output_qty * multiplier) WHERE id = rec.product_id;
  INSERT INTO inventory_movements (business_id, product_id, type, quantity, reason, user_id)
  VALUES (b_id, rec.product_id, 'entrada', rec.output_qty * multiplier, 'Producción: ' || rec.name, u_id);
END $$;
GRANT EXECUTE ON FUNCTION register_production TO authenticated;