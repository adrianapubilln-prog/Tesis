/*
# Create businesses and business_users tables

1. New Tables
- `businesses`: stores the main business/negocio information registered at onboarding.
  - id (uuid PK)
  - name (text, required)
  - phone (text)
  - address (text)
  - nit (text, fiscal document)
  - type (text: 'comercial' | 'productora') — determines if raw materials module is shown
  - founded_at (date)
  - owner_id (uuid, references auth.users) — the user who created the business
  - created_at (timestamptz)
- `business_users`: users that belong to a business with a role.
  - id (uuid PK)
  - business_id (uuid FK -> businesses, cascade)
  - auth_user_id (uuid FK -> auth.users, cascade) — links to Supabase auth
  - name (text)
  - email (text, unique)
  - role (text: 'administrador' | 'empleado' | 'contador')
  - created_at (timestamptz)

2. Security
- Enable RLS on both tables.
- businesses: owner can CRUD their own business (owner_id = auth.uid()).
- business_users: a user can read rows for businesses they own OR rows matching their own auth_user_id.
  Inserts/updates/deletes restricted to business owners (via EXISTS check on businesses.owner_id).
- Owner columns default to auth.uid() where applicable.
*/

CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  nit text,
  type text NOT NULL DEFAULT 'comercial' CHECK (type IN ('comercial','productora')),
  founded_at date,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_businesses" ON businesses;
CREATE POLICY "select_own_businesses" ON businesses
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_businesses" ON businesses;
CREATE POLICY "insert_own_businesses" ON businesses
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "update_own_businesses" ON businesses;
CREATE POLICY "update_own_businesses" ON businesses
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_businesses" ON businesses;
CREATE POLICY "delete_own_businesses" ON businesses
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS business_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'empleado' CHECK (role IN ('administrador','empleado','contador')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_business_users" ON business_users;
CREATE POLICY "select_business_users" ON business_users
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM businesses b WHERE b.id = business_users.business_id AND b.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_business_users" ON business_users;
CREATE POLICY "insert_business_users" ON business_users
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = business_users.business_id AND b.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_business_users" ON business_users;
CREATE POLICY "update_business_users" ON business_users
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = business_users.business_id AND b.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = business_users.business_id AND b.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_business_users" ON business_users;
CREATE POLICY "delete_business_users" ON business_users
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = business_users.business_id AND b.owner_id = auth.uid())
  );
