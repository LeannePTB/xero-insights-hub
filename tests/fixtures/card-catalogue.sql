
  select case _group
    when 'standard' then array['health','receivables','payables','pnl','notes','unreconciled']
    when 'advisory' then array['cashflow','cashflow_scenario','accounting_breakeven','gst_reconciliation','superannuation','payg_withholding','xero_audit','transaction_search']
    when 'consolidation' then array['loan_consolidation']
    else '{}'::text[]
  end

