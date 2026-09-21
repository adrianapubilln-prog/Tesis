/*
# Create business_settings table

1. New Tables
- `business_settings`: stores per-business system parameters.
  - business_id (uuid PK, FK -> businesses, cascade)
  - tax_rate (numeric, default 0)
  - currency (text, default 'USD')
  - low_stock_alerts (boolean, default true)
  - updated_at (timestamptz)

2. Security
- Enable RLS. Owner can CRUD. Members can SELECT.
*/

CREATE TABLE IF NOT EXISTS business_settings (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  tax_rate numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  low_stock_alerts boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_business_settings" ON business_settings;
CREATE POLICY "select_business_settings" ON business_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = business_settings.business_id AND b.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM business_users bu WHERE bu.business_id = business_settings.business_id AND bu.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "upsert_business_settings" ON business_settings;
CREATE POLICY "upsert_business_settings" ON business_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = business_settings.business_id AND b.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_business_settings" ON business_settings;
CREATE POLICY "update_business_settings" ON business_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM businesses b WHERE b.id = business_settings.business_id AND b.owner_id = auth.uid())
  );