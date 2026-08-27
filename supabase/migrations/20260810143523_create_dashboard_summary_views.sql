/*
# Dashboard summary views and RPCs

1. New Views
- `monthly_sales_summary`: aggregates sales total, profit, and count grouped
  by business_id and year-month. Excludes cancelled sales.
- `monthly_expenses_summary`: aggregates expense total grouped by business_id
  and year-month.
- `dashboard_cashflow`: combines sales income and expenses by month.
- `top_products_by_sales`: ranks products by total quantity and revenue sold.
- `recent_activity`: union of recent sales, purchases, and expenses with a
  unified type label for the dashboard activity feed.

2. New Functions
- `get_dashboard_kpis(b_id uuid)`: returns a single row with today's sales,
  this month's sales, this month's expenses, net profit, pending client
  balances, pending supplier balances, low-stock count, and total inventory
  value — all in one round-trip.

3. Security
- All views granted SELECT to authenticated.
- RPC granted EXECUTE to authenticated.

4. Notes
- No destructive changes. All views are CREATE OR REPLACE.
*/

-- Monthly sales summary
CREATE OR REPLACE VIEW monthly_sales_summary AS
SELECT
  business_id,
  TO_CHAR(sale_date, 'YYYY-MM') AS month,
  SUM(total) AS total_sales,
  SUM(profit) AS total_profit,
  COUNT(*) AS sales_count
FROM sales
WHERE status <> 'anulada'
GROUP BY business_id, TO_CHAR(sale_date, 'YYYY-MM');
GRANT SELECT ON monthly_sales_summary TO authenticated;

-- Monthly expenses summary
CREATE OR REPLACE VIEW monthly_expenses_summary AS
SELECT
  business_id,
  TO_CHAR(expense_date, 'YYYY-MM') AS month,
  SUM(amount) AS total_expenses,
  COUNT(*) AS expense_count
FROM expenses
GROUP BY business_id, TO_CHAR(expense_date, 'YYYY-MM');
GRANT SELECT ON monthly_expenses_summary TO authenticated;

-- Dashboard cashflow: income vs expenses by month
CREATE OR REPLACE VIEW dashboard_cashflow AS
SELECT
  COALESCE(s.business_id, e.business_id) AS business_id,
  COALESCE(s.month, e.month) AS month,
  COALESCE(s.total_sales, 0) AS income,
  COALESCE(e.total_expenses, 0) AS expenses,
  COALESCE(s.total_sales, 0) - COALESCE(e.total_expenses, 0) AS net
FROM monthly_sales_summary s
FULL OUTER JOIN monthly_expenses_summary e
  ON s.business_id = e.business_id AND s.month = e.month;
GRANT SELECT ON dashboard_cashflow TO authenticated;

-- Top products by sales
CREATE OR REPLACE VIEW top_products_by_sales AS
SELECT
  si.product_id,
  p.name AS product_name,
  p.business_id,
  SUM(si.quantity) AS total_quantity,
  SUM(si.total) AS total_revenue,
  SUM(si.profit) AS total_profit
FROM sale_items si
JOIN products p ON p.id = si.product_id
JOIN sales s ON s.id = si.sale_id
WHERE s.status <> 'anulada'
GROUP BY si.product_id, p.name, p.business_id;
GRANT SELECT ON top_products_by_sales TO authenticated;

-- Recent activity feed (all dates cast to text for UNION compatibility)
CREATE OR REPLACE VIEW recent_activity AS
SELECT
  business_id,
  id,
  'sale' AS activity_type,
  invoice_number AS reference,
  total AS amount,
  sale_date::text AS activity_date,
  status
FROM sales
UNION ALL
SELECT
  business_id,
  id,
  'purchase' AS activity_type,
  invoice_number AS reference,
  total AS amount,
  purchase_date::text AS activity_date,
  status
FROM purchases
UNION ALL
SELECT
  business_id,
  id,
  'expense' AS activity_type,
  description AS reference,
  amount AS amount,
  expense_date::text AS activity_date,
  status
FROM expenses;
GRANT SELECT ON recent_activity TO authenticated;

-- Dashboard KPIs in a single round-trip
CREATE OR REPLACE FUNCTION get_dashboard_kpis(b_id uuid)
RETURNS TABLE(
  today_sales numeric,
  month_sales numeric,
  month_profit numeric,
  month_expenses numeric,
  net_profit numeric,
  pending_client_balance numeric,
  pending_supplier_balance numeric,
  low_stock_count bigint,
  inventory_value numeric,
  sales_this_month bigint,
  expenses_this_month bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN s.sale_date = CURRENT_DATE THEN s.total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN TO_CHAR(s.sale_date,'YYYY-MM') = TO_CHAR(CURRENT_DATE,'YYYY-MM') THEN s.total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN TO_CHAR(s.sale_date,'YYYY-MM') = TO_CHAR(CURRENT_DATE,'YYYY-MM') THEN s.profit ELSE 0 END), 0),
    COALESCE((SELECT SUM(amount) FROM expenses WHERE business_id = b_id AND TO_CHAR(expense_date,'YYYY-MM') = TO_CHAR(CURRENT_DATE,'YYYY-MM')), 0),
    COALESCE(SUM(CASE WHEN TO_CHAR(s.sale_date,'YYYY-MM') = TO_CHAR(CURRENT_DATE,'YYYY-MM') THEN s.total ELSE 0 END), 0)
      - COALESCE((SELECT SUM(amount) FROM expenses WHERE business_id = b_id AND TO_CHAR(expense_date,'YYYY-MM') = TO_CHAR(CURRENT_DATE,'YYYY-MM')), 0),
    COALESCE((SELECT SUM(balance) FROM clients WHERE business_id = b_id), 0),
    COALESCE((SELECT SUM(balance) FROM suppliers WHERE business_id = b_id), 0),
    (SELECT COUNT(*) FROM products WHERE business_id = b_id AND stock <= min_stock AND active = true),
    COALESCE((SELECT SUM(stock * cost) FROM products WHERE business_id = b_id AND active = true), 0),
    (SELECT COUNT(*) FROM sales WHERE business_id = b_id AND TO_CHAR(sale_date,'YYYY-MM') = TO_CHAR(CURRENT_DATE,'YYYY-MM') AND status <> 'anulada'),
    (SELECT COUNT(*) FROM expenses WHERE business_id = b_id AND TO_CHAR(expense_date,'YYYY-MM') = TO_CHAR(CURRENT_DATE,'YYYY-MM'))
  FROM sales s
  WHERE s.business_id = b_id AND s.status <> 'anulada';
END $$;
GRANT EXECUTE ON FUNCTION get_dashboard_kpis TO authenticated;