# Xero library rules
- Bank/card extraction is shared in `tax-lines.ts`; the ID-keyed bank-classification overlay applies explicit client/file/account overrides before Xero BankAccountType, never name guesses, so stored and live figures agree without rewriting Xero metadata.
- Xero reference reads (accounts, organisation, bank summary, balance sheet, P&L) go through the short tenant-keyed shared cache inside xeroGet, beneath per-caller access checks; settings pages read stored snapshots first and go live only on explicit Refresh, because repeated live reads exhausted the per-file budget.
- Lodged-tax RPCs delegate to a server-only reader with the existing card gate and database-resolved client before audited caller-scoped snapshot reads, so a client-supplied file never grants bill access.
