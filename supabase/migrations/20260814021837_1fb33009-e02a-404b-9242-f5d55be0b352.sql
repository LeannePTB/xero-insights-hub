UPDATE public.plan_levels SET widgets = ARRAY['health','receivables','payables','pnl','unreconciled','tax_liability','superannuation','accounting_breakeven','true_breakeven','cashflow','xero_audit'], sort_order = 20 WHERE scope = 'dashboard' AND key = 'advisory';

UPDATE public.plan_levels SET widgets = ARRAY['health','receivables','payables','pnl','unreconciled','tax_liability','superannuation','accounting_breakeven','true_breakeven','cashflow','cashflow_scenario','xero_audit','loan_consolidation'], sort_order = 30 WHERE scope = 'dashboard' AND key = 'multi_company';

UPDATE public.plan_levels SET sort_order = 10 WHERE scope = 'dashboard' AND key = 'basic';