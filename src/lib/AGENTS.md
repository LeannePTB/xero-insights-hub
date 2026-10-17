# src/lib rules
- Account tags (bank/cash, tax/super, costs) live only in `client_account_setup`, keyed by Xero AccountID, written only via `save_client_account_setup()`; consumers read the `account_setup_*_v` views so Xero renames never break a tag.
