-- CI-only compatibility layer for exercising the current application against
-- Supabase local. The checked-in schema.sql is the legacy four-table schema;
-- keep this fixture separate until the live schema is captured as migrations.

-- The legacy SQL's insert trigger would double-apply stock: the current RPC owns
-- the transaction and stock update atomically.
DROP TRIGGER IF EXISTS trigger_update_stock ON public.transactions;

ALTER TABLE public.products
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN last_counted_at TIMESTAMPTZ,
  ADD COLUMN last_counted_qty INTEGER,
  ADD COLUMN needs_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.products ALTER COLUMN category DROP NOT NULL;
ALTER TABLE public.products ADD CONSTRAINT ci_products_stock_nonnegative CHECK (stock_current >= 0);
CREATE UNIQUE INDEX ci_products_name_active_uq ON public.products (lower(name)) WHERE is_active;

ALTER TABLE public.suppliers
  ADD COLUMN phone VARCHAR(20),
  ADD COLUMN is_adjustment BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN jenis TEXT,
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.suppliers DROP CONSTRAINT suppliers_name_key;
ALTER TABLE public.suppliers ADD CONSTRAINT ci_suppliers_jenis_check CHECK (
  (is_adjustment AND jenis IS NULL) OR
  (NOT is_adjustment AND jenis IN ('utama', 'cadangan', 'grosir'))
);
CREATE UNIQUE INDEX ci_suppliers_name_uq ON public.suppliers (lower(name));
CREATE UNIQUE INDEX ci_suppliers_adjustment_uq ON public.suppliers (is_adjustment) WHERE is_adjustment;

ALTER TABLE public.transactions
  ADD COLUMN source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN opname_id BIGINT;
ALTER TABLE public.transactions ADD CONSTRAINT ci_transactions_qty_positive CHECK (qty > 0);
ALTER TABLE public.transactions ADD CONSTRAINT ci_transactions_source_check CHECK (source IN ('manual', 'opname'));
ALTER TABLE public.transactions ADD CONSTRAINT ci_transactions_in_supplier_check CHECK (
  (type = 'in' AND supplier_id IS NOT NULL) OR (type = 'out' AND supplier_id IS NULL)
);

CREATE SCHEMA bot;
CREATE TABLE bot.stock_movement_keys (
  idem_key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE VIEW public.v_products AS
SELECT id, name, category, unit, qty_per_karton, stock_current, is_active,
       (stock_current <= stock_minimum) AS is_low, created_at, stock_minimum,
       last_counted_at, last_counted_qty, needs_review
FROM public.products;

CREATE VIEW public.v_product_suppliers AS
SELECT p.id AS product_id,
       latest.supplier_id AS last_supplier_id,
       latest.name AS last_supplier_name,
       latest.created_at AS last_in_at,
       latest.is_active AS last_supplier_active,
       COALESCE(history.supplier_count, 0)::INTEGER AS supplier_count,
       history.supplier_names
FROM public.products p
LEFT JOIN LATERAL (
  SELECT s.id AS supplier_id, s.name, s.is_active, t.created_at
  FROM public.transactions t
  JOIN public.suppliers s ON s.id = t.supplier_id
  WHERE t.product_id = p.id AND t.type = 'in' AND NOT s.is_adjustment
  ORDER BY t.created_at DESC, t.id DESC
  LIMIT 1
) latest ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INTEGER AS supplier_count,
         string_agg(x.name, ', ' ORDER BY x.last_restock DESC) AS supplier_names
  FROM (
    SELECT s.id, s.name, MAX(t.created_at) AS last_restock
    FROM public.transactions t
    JOIN public.suppliers s ON s.id = t.supplier_id
    WHERE t.product_id = p.id AND t.type = 'in' AND NOT s.is_adjustment
    GROUP BY s.id, s.name
  ) x
) history ON TRUE;

CREATE VIEW public.v_supplier_stats AS
SELECT s.id, s.name, s.jenis, s.created_at,
       COUNT(t.id) FILTER (WHERE t.type = 'in') AS transaction_count,
       MAX(t.created_at) FILTER (WHERE t.type = 'in') AS last_restock_date,
       s.is_adjustment, s.is_active
FROM public.suppliers s
LEFT JOIN public.transactions t ON t.supplier_id = s.id
GROUP BY s.id;

CREATE FUNCTION public.fn_pair_baru(p_product_id INTEGER, p_supplier_id INTEGER)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NOT COALESCE((SELECT is_adjustment FROM public.suppliers WHERE id = p_supplier_id), TRUE)
     AND EXISTS (SELECT 1 FROM public.transactions t JOIN public.suppliers s ON s.id = t.supplier_id
                 WHERE t.product_id = p_product_id AND t.type = 'in' AND NOT s.is_adjustment)
     AND NOT EXISTS (SELECT 1 FROM public.transactions t
                     WHERE t.product_id = p_product_id AND t.type = 'in' AND t.supplier_id = p_supplier_id);
$$;

CREATE FUNCTION bot.fn_record_stock_movement(
  p_user_id UUID, p_type TEXT, p_items JSONB, p_note TEXT, p_idem_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_short RECORD;
  v_name TEXT;
  v_result JSONB;
  v_movements JSONB;
BEGIN
  IF p_type NOT IN ('in', 'out') OR p_idem_key IS NULL OR BTRIM(p_idem_key) = ''
     OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 100
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_items) e
       WHERE jsonb_typeof(e) <> 'object'
          OR COALESCE(e->>'product_id', '') !~ '^[0-9]{1,9}$'
          OR COALESCE(e->>'qty_base', '') !~ '^[0-9]{1,6}$'
          OR (e->>'qty_base')::INTEGER < 1 OR (e->>'qty_base')::INTEGER > 100000
          OR (e ? 'supplier_id' AND jsonb_typeof(e->'supplier_id') <> 'null'
              AND (e->>'supplier_id') !~ '^[0-9]{1,9}$')
     ) THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'INVALID_ITEMS');
  END IF;

  IF EXISTS (SELECT 1 FROM bot.stock_movement_keys WHERE idem_key = p_idem_key) THEN
    RETURN jsonb_build_object('ok', TRUE, 'duplicate', TRUE);
  END IF;

  SELECT jsonb_agg(jsonb_build_object('pid', pid, 'sid', sid, 'qty', qty)) INTO v_movements
  FROM (
    SELECT (e->>'product_id')::INTEGER AS pid,
           CASE WHEN p_type = 'in' THEN NULLIF(e->>'supplier_id', '')::INTEGER END AS sid,
           SUM((e->>'qty_base')::INTEGER)::INTEGER AS qty
    FROM jsonb_array_elements(p_items) e
    GROUP BY 1, 2
  ) grouped;

  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(v_movements) AS m(pid INTEGER, sid INTEGER, qty INTEGER) WHERE qty > 100000) THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'INVALID_ITEMS');
  END IF;

  PERFORM 1 FROM public.products
  WHERE id IN (SELECT pid FROM jsonb_to_recordset(v_movements) AS m(pid INTEGER, sid INTEGER, qty INTEGER))
  ORDER BY id FOR UPDATE;

  SELECT m.pid::TEXT INTO v_name
  FROM jsonb_to_recordset(v_movements) AS m(pid INTEGER, sid INTEGER, qty INTEGER)
  WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = m.pid AND p.is_active)
  LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('ok', FALSE, 'code', 'PRODUCT_NOT_FOUND', 'product_id', v_name); END IF;

  IF p_type = 'out' THEN
    SELECT p.name, p.unit, p.stock_current INTO v_short
    FROM (
      SELECT pid, SUM(qty) AS qty FROM jsonb_to_recordset(v_movements) AS m(pid INTEGER, sid INTEGER, qty INTEGER) GROUP BY 1
    ) requested
    JOIN public.products p ON p.id = requested.pid
    WHERE p.stock_current < requested.qty LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', FALSE, 'code', 'INSUFFICIENT_STOCK',
                                'product', v_short.name, 'unit', v_short.unit, 'stock', v_short.stock_current);
    END IF;
  ELSE
    SELECT p.name INTO v_name
    FROM jsonb_to_recordset(v_movements) AS m(pid INTEGER, sid INTEGER, qty INTEGER)
    JOIN public.products p ON p.id = m.pid WHERE m.sid IS NULL LIMIT 1;
    IF FOUND THEN RETURN jsonb_build_object('ok', FALSE, 'code', 'SUPPLIER_REQUIRED', 'product', v_name); END IF;

    SELECT m.sid::TEXT INTO v_name
    FROM jsonb_to_recordset(v_movements) AS m(pid INTEGER, sid INTEGER, qty INTEGER)
    WHERE NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = m.sid) LIMIT 1;
    IF FOUND THEN RETURN jsonb_build_object('ok', FALSE, 'code', 'SUPPLIER_UNKNOWN', 'supplier_id', v_name); END IF;
  END IF;

  BEGIN
    INSERT INTO bot.stock_movement_keys (idem_key) VALUES (p_idem_key);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', TRUE, 'duplicate', TRUE);
  END;

  INSERT INTO public.transactions (product_id, user_id, supplier_id, type, qty, note)
  SELECT pid, p_user_id, sid, p_type, qty, NULLIF(BTRIM(LEFT(COALESCE(p_note, ''), 200)), '')
  FROM jsonb_to_recordset(v_movements) AS m(pid INTEGER, sid INTEGER, qty INTEGER)
  ORDER BY pid, sid;

  UPDATE public.products p
  SET stock_current = p.stock_current + CASE WHEN p_type = 'in' THEN requested.qty ELSE -requested.qty END
  FROM (
    SELECT pid, SUM(qty) AS qty FROM jsonb_to_recordset(v_movements) AS m(pid INTEGER, sid INTEGER, qty INTEGER) GROUP BY 1
  ) requested
  WHERE p.id = requested.pid;

  SELECT jsonb_build_object('ok', TRUE, 'items', jsonb_agg(jsonb_build_object(
    'product_id', p.id, 'product', p.name, 'unit', p.unit, 'qty_base', m.qty,
    'supplier', s.name, 'stock', p.stock_current, 'low', p.stock_current <= p.stock_minimum
  ) ORDER BY p.name, s.name)) INTO v_result
  FROM jsonb_to_recordset(v_movements) AS m(pid INTEGER, sid INTEGER, qty INTEGER)
  JOIN public.products p ON p.id = m.pid
  LEFT JOIN public.suppliers s ON s.id = m.sid;
  RETURN v_result;
END;
$$;

CREATE FUNCTION public.fn_dashboard_record_movement(
  p_user_id UUID, p_type TEXT, p_product_id INTEGER, p_qty INTEGER,
  p_supplier_id INTEGER, p_note TEXT, p_idem_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_type NOT IN ('in', 'out') THEN RETURN jsonb_build_object('ok', FALSE, 'code', 'INVALID_TYPE'); END IF;
  IF p_qty IS NULL OR p_qty <= 0 OR p_qty > 100000 THEN RETURN jsonb_build_object('ok', FALSE, 'code', 'INVALID_QTY'); END IF;
  IF p_idem_key IS NULL OR p_idem_key !~ '^web:.{8,}$' THEN RETURN jsonb_build_object('ok', FALSE, 'code', 'INVALID_IDEM_KEY'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN RETURN jsonb_build_object('ok', FALSE, 'code', 'USER_NOT_FOUND'); END IF;
  IF p_product_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND is_active) THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'PRODUCT_NOT_FOUND');
  END IF;
  IF p_type = 'in' AND p_supplier_id IS NULL THEN RETURN jsonb_build_object('ok', FALSE, 'code', 'SUPPLIER_REQUIRED'); END IF;
  IF p_type = 'in' AND NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id) THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'SUPPLIER_UNKNOWN');
  END IF;

  v_result := bot.fn_record_stock_movement(
    p_user_id, p_type,
    jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'product_id', p_product_id, 'qty_base', p_qty,
      'supplier_id', CASE WHEN p_type = 'in' THEN p_supplier_id END
    ))),
    p_note, p_idem_key
  );
  IF (v_result->>'ok')::BOOLEAN AND v_result ? 'items' THEN
    v_result := v_result || jsonb_build_object('supplier', v_result->'items'->0->'supplier');
  END IF;
  RETURN v_result;
END;
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public, bot TO service_role;
GRANT ALL ON public.users, public.products, public.suppliers, public.transactions TO service_role;
GRANT SELECT ON public.v_products, public.v_product_suppliers, public.v_supplier_stats TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
REVOKE ALL ON FUNCTION public.fn_pair_baru(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_dashboard_record_movement(UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION bot.fn_record_stock_movement(UUID, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pair_baru(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_dashboard_record_movement(UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION bot.fn_record_stock_movement(UUID, TEXT, JSONB, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
