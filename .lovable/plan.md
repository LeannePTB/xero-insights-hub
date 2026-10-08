# Why TracyFinlay shows "Partial data — 1 check unavailable"

## What is happening
- TracyFinlay is set to **not registered** for GST and PAYG withholding, so no protected money (GST, PAYG, super) is expected. The protected-money check should stay silent.
- Its Balance Sheet has a loan account called **"TracyFinlay Superannuation Fund"** (−$687). The word "Superannuation" in the name makes it look like super owed to employees.
- Because one tax-looking line was found, the check skips its "nothing expected, stay silent" exit. It then finds that none of the expected parts can be worked out (none are expected), and reports "protected money could not be established". That is the one unavailable check.
- The stored data is complete. Nothing is missing from Xero.

Separately, bank is overdrawn overall (−$600,813, mostly the Macquarie loan). If the first problem were fixed for a client that *was* registered, this would give a "cash is not positive" note. That note is correct and stays.

## Proposed fix (needs your OK. It changes badges)
1. In the protected-money check: when the client's settings expect no GST, PAYG or super, return silence whatever lines were found (the rule the other check already follows).
2. Optional, your call: stop treating an account named "... Superannuation Fund" as super owed when it sits under a loan or related-party heading. This could change other clients' protected-money totals, so I would list affected clients before changing it.
3. Add tests: a not-registered client with a "Superannuation Fund" loan line shows no gap; a registered client still shows its gaps.

Effect: TracyFinlay moves to "Nothing to action" (or whatever its other checks say). Other not-registered clients with a similar account change the same way. The monthly report uses the same check, so it changes too.

## Security classification
Logic-only change to how stored client data is judged. No changes to access, policies, Xero calls or who can see what. The security checks still run before finishing.

## Not covered
The debtor-ageing defect from last turn is still waiting on your decision. It is separate from this.
