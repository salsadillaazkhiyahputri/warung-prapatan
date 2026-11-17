-- Contract checks for schema.sql, executed only against the disposable CI Postgres service.
DO $$
DECLARE
  required_table TEXT;
BEGIN
  FOREACH required_table IN ARRAY ARRAY['users', 'products', 'suppliers', 'transactions'] LOOP
    IF to_regclass(format('public.%I', required_table)) IS NULL THEN
      RAISE EXCEPTION 'Missing required table: %', required_table;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND conname = 'check_supplier_on_in'
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION 'Missing supplier requirement constraint on incoming transactions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.transactions'::regclass
      AND tgname = 'trigger_update_stock'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Missing stock update trigger';
  END IF;

  IF to_regprocedure('public.update_product_stock_on_transaction()') IS NULL THEN
    RAISE EXCEPTION 'Missing stock update trigger function';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_transactions_created_at') THEN
    RAISE EXCEPTION 'Missing transactions created_at index';
  END IF;
END;
$$;

-- Exercise the trigger and incoming-supplier rule inside a transaction that is
-- rolled back before the CI database is discarded.
BEGIN;
DO $$
DECLARE
  product_id INTEGER;
  supplier_id INTEGER;
BEGIN
  INSERT INTO public.products (name, category, stock_current)
  VALUES ('CI schema fixture', 'CI', 10)
  RETURNING id INTO product_id;

  INSERT INTO public.suppliers (name)
  VALUES ('CI schema fixture')
  RETURNING id INTO supplier_id;

  INSERT INTO public.transactions (product_id, supplier_id, type, qty)
  VALUES (product_id, supplier_id, 'in', 5);
  IF (SELECT stock_current FROM public.products WHERE id = product_id) <> 15 THEN
    RAISE EXCEPTION 'Incoming transaction did not update stock';
  END IF;

  INSERT INTO public.transactions (product_id, type, qty)
  VALUES (product_id, 'out', 30);
  IF (SELECT stock_current FROM public.products WHERE id = product_id) <> 0 THEN
    RAISE EXCEPTION 'Outgoing transaction did not clamp stock at zero';
  END IF;

  BEGIN
    INSERT INTO public.transactions (product_id, type, qty)
    VALUES (product_id, 'in', 1);
    RAISE EXCEPTION 'Incoming transaction without supplier was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END;
$$;
ROLLBACK;
