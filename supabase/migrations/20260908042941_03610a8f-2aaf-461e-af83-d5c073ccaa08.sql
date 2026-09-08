UPDATE public.plan_levels
SET widgets = ARRAY['superannuation','accounting_breakeven','true_breakeven','cashflow','balance_sheet_reconciliation','gst_reconciliation','payg_withholding']
WHERE scope = 'dashboard' AND key = 'wip';