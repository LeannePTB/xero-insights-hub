-- Settings only: strip the retired widget key from configuration arrays.
-- No table, column, policy, trigger or grant is touched, and no
-- reconciliation_snapshots row is deleted.

UPDATE public.plan_levels
SET widgets = array_remove(widgets, 'balance_sheet_reconciliation'),
    updated_at = now()
WHERE 'balance_sheet_reconciliation' = ANY(widgets);

UPDATE public.tier_widget_config
SET widgets = array_remove(widgets, 'balance_sheet_reconciliation'),
    excluded_widgets = array_remove(excluded_widgets, 'balance_sheet_reconciliation'),
    updated_at = now()
WHERE 'balance_sheet_reconciliation' = ANY(widgets)
   OR 'balance_sheet_reconciliation' = ANY(excluded_widgets);

UPDATE public.firms
SET default_widgets = array_remove(default_widgets, 'balance_sheet_reconciliation'),
    updated_at = now()
WHERE 'balance_sheet_reconciliation' = ANY(default_widgets);

UPDATE public.clients
SET dashboard_widgets = array_remove(dashboard_widgets, 'balance_sheet_reconciliation'),
    updated_at = now()
WHERE 'balance_sheet_reconciliation' = ANY(dashboard_widgets);

UPDATE public.dashboard_card_order
SET "order" = array_remove("order", 'balance_sheet_reconciliation'),
    updated_at = now()
WHERE 'balance_sheet_reconciliation' = ANY("order");