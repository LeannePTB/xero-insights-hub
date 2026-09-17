# Verify and harden live access-test rate limiting

## Classification and threat
Security-relevant: this changes an authentication test runner and its public, secret-protected trigger. It will not alter application access rules, test-account permissions, or real-user authentication.

Threat: repeated smoke-test runs can consume the authentication provider's per-source allowance or overlap, while a pre-run 429 can be mistaken for a completed security result.

## Changes
1. Document the two separate limits in code and security records:
   - the observed app-owned trigger limit and exact fixed-window behaviour;
   - the authentication provider's password-sign-in limit and whether it is keyed by source IP.
2. Reduce and pace test authentication:
   - reuse each account's established session across all assertions;
   - retain the separate owner aal1 proof without signing in per assertion;
   - add deliberate spacing between password sign-ins;
   - prevent overlapping live runs and tighten trigger cadence so repeated manual/automated runs cannot burst.
3. Introduce an explicit incomplete-run result. Any 429 from the trigger or test-account authentication will report `INCONCLUSIVE — run did not complete`, never green and never as a failed access assertion.
4. Add focused tests for sign-in counting/session reuse and 429 reporting, then update the security backlog/spec evidence.

## Verification
- Confirm the exact steady-state and first-run sign-in counts from tests.
- Run focused runner tests, type checking, the local access matrix, the database linter and posture checks available to this environment.
- Run the full security command once; if its own cadence gate blocks that verification, report it as inconclusive with the reset window rather than retrying.
