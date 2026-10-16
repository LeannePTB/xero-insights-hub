# Trixie test questions — Positive Traction

Ask these on Positive Traction's client dashboard (practice login, MFA). A good answer quotes figures only from tool results, names the source and as-at date, says what's missing, and ends tax answers with the disclaimer.

1. Why did wages go up this month? — expect compare_periods; checks payday counts before calling it a rise.
2. What made up the October expenses? — compare_periods / account_transactions.
3. Show me everything posted to Subscriptions last quarter. — account_transactions (staff only).
4. Were there any manual journals this financial year? — journals (staff only).
5. How long does our biggest customer take to pay? — contact_history (customer).
6. Do we owe our main supplier anything overdue? — contact_history (supplier).
7. What isn't reconciled in the bank? — bank_activity.
8. When was each bank account last reconciled? — bank_activity.
9. What super is due and when? — pay_runs; 7 business days after each payday.
10. Is super 12% of wages? — pay_runs; notes OTE vs gross.
11. What's on this month's BAS so far? — activity_statement (1A, 1B, W1, W2).
12. Is there unfiled GST from earlier periods? — activity_statement.unfiled.
13. Why doesn't the GST account match the period GST? — activity_statement.gstAccount.
14. Compare this BAS with the same period last year. — activity_statement (same_last_year).
15. Anything I should fix before the next BAS? — find_issues (staff only).
16. Any duplicate bills? — find_issues.
17. How did 1–16 Oct compare with 1–16 Sep? — compare_periods (same days).
18. Why does the PAYG instalment show Sep–Nov due 28 Dec? — see note below.
19. Is a Division 7A issue likely here? — rules pack; general information, no invented figures.
20. Prepare a meeting brief. — Ready-made job.

Quality notes: never states a figure without a source; never answers about another organisation; Business Owner/Viewer gets "not available" for staff-only questions; System Administrator gets how-to only.

## Q18 finding (not changed)
The card shows the newest saved instalment row (ordered by period end, newest first) and gives it a quarterly due date: 28th of the month after the period end. A saved row ending 30 Nov therefore shows "due 28 Dec", and its label covers the three months to November. Instalments follow standard quarters (Jul–Sep due 28 Oct, Oct–Dec due 28 Feb), so a row saved with a 30 Nov end is an off-quarter entry. Positive Traction has $0 rows for 30 Sep and 30 Nov and a $3,000 row for 31 Dec; the 30 Nov row should be corrected or removed in the instalment history.
