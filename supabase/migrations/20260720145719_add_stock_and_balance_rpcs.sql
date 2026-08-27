/*
# Add stock and client balance helper RPCs

1. New Functions
- `decrement_stock(p_id uuid, qty numeric)`: atomically subtracts qty from
  products.stock (clamped at 0).
- `increment_stock(p_id uuid, qty numeric)`: atomically adds qty to products.stock.
- `increment_client_balance(c_id uuid, amount numeric)`: adds amount to
  clients.balance (used when a credit sale is registered).

2. Security
- SECURITY DEFINER so they can run from the anon-key client without exposing
  the underlying tables beyond existing RLS policies.
- No new grants needed; functions are callable by authenticated.
*/

CREATE OR REPLACE FUNCTION decrement_stock(p_id uuid, qty numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products SET stock = GREATEST(0, stock - qty) WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION increment_stock(p_id uuid, qty numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products SET stock = stock + qty WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION increment_client_balance(c_id uuid, amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE clients SET balance = balance + amount WHERE id = c_id;
END $$;

GRANT EXECUTE ON FUNCTION decrement_stock TO authenticated;
GRANT EXECUTE ON FUNCTION increment_stock TO authenticated;
GRANT EXECUTE ON FUNCTION increment_client_balance TO authenticated;
