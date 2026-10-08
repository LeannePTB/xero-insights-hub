
  SELECT CASE _group
    WHEN 'standard' THEN ARRAY['health','receivables','payables','pnl','notes']
    WHEN 'advisory' THEN ARRAY['cashflow','cashflow_scenario','accounting_breakeven','tax_obligations','gst_reconciliation','superannuation','payg_withholding','xero_audit','transaction_search']
    WHEN 'consolidation' THEN ARRAY['loan_consolidation']
    ELSE '{}'::text[]
  END

