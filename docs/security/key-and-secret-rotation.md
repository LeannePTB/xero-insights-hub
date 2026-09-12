# Key and secret rotation

> **Status:** draft procedure, not yet performed. Closes backlog 39 (a) and (b).
> Items marked **[CONFIRM]** need a decision or a fact only the practice can supply.

## Who can read the secrets

Secrets live in Lovable Cloud → Secrets for this project. They are injected into server-side code at run time and never reach the browser.

| Person | Role | Can read secrets | Why |
| --- | --- | --- | --- |
| Leanne Ardern | Director, sole developer | Yes | Owns the Lovable workspace |
| **[CONFIRM: anyone else with workspace access?]** | | | |

Anyone who leaves the practice, or whose role changes so they no longer need it, has their workspace access removed the same day, and every secret below is rotated within seven days.

## The secrets

| Secret | What it protects | Rotation | Notes |
| --- | --- | --- | --- |
| `TOKEN_ENC_KEY` | Encrypts Xero access and refresh tokens at rest | Every 12 months, and immediately on suspected exposure | See the procedure below — this one is not a simple swap |
| `XERO_CLIENT_SECRET` | Our Xero app credential | Every 12 months, and immediately on suspected exposure | Rotate in the Xero developer portal, then update here |
| `STRIPE_SECRET_KEY` | Payment processing | Every 12 months | Roll in the Stripe dashboard; the old key can be revoked once the new one is live |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook signatures | On endpoint change, or every 12 months | |
| `SECURITY_TEST_TRIGGER_SECRET` | Starts an access-test run | Every 12 months | Low impact; a wrong value only prevents a test run |
| Email provider key | Transactional email | Every 12 months | **[CONFIRM: exact secret name]** |
| Supabase service role key | Full database access | Managed by the platform | Not rotatable by hand; treat platform account security as the control |

**[CONFIRM: check the Secrets list against this table and add anything missing.]**

## Rotating `TOKEN_ENC_KEY`

This key wraps every stored Xero token. Replacing it naively makes every existing connection unreadable, so it needs a deliberate sequence.

**Option A — re-wrap (no client disruption).** Preferred.

1. Generate the new key. Add it as a second secret, `TOKEN_ENC_KEY_NEXT`, leaving the current key in place.
2. Deploy a change that decrypts with the old key and encrypts with the new one, writing each connection row in a single transaction. Run it as a one-off task, not a migration and not on start-up.
3. Verify: every connected row still decrypts, and a live Xero call succeeds for one file.
4. Promote `TOKEN_ENC_KEY_NEXT` to `TOKEN_ENC_KEY`, remove the temporary secret, and remove the dual-key code.
5. Record the rotation in the log below.

**Option B — forced reconnection (fallback).** Only if a re-wrap is not possible, or if the old key is believed compromised and must not be used again.

1. Replace the key.
2. Mark every connection as needing reconnection and clear the stored token ciphertext.
3. Tell every adviser they must reconnect each Xero file. **This is disruptive** — twelve files today, each needing a client's consent screen. Do not choose this path casually.

**If the key is believed exposed:** treat it as an incident, follow the incident register procedure, use Option B, and consider whether the tokens themselves should be revoked at Xero as well.

## Rotation log

| Date | Secret | Reason | Performed by | Verified how |
| --- | --- | --- | --- | --- |
| — | — | No rotation has been performed yet | — | — |

## Next review

**[CONFIRM: set a date — I suggest twelve months from the day you sign this off, with a calendar reminder.]**
