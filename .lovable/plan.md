## Plan

1. **Make MFA recovery reliable**
   - Update the “Start over” action so it removes both visible verified/unverified TOTP factors and hidden stale factors returned under the full MFA factor list.
   - This prevents old authenticator entries or stale QR codes from keeping the user stuck.

2. **Generate a clean fresh QR flow**
   - After clearing factors, immediately create a new TOTP enrolment with a unique friendly name.
   - Clear the entered code and any previous error message before showing the new QR.

3. **Improve invalid-code handling**
   - Keep the existing clock-drift guidance, but also show the **Start over** option after invalid-code failures so the user can discard the current QR and scan a fresh one.
   - Disable retry actions while verification/re-enrolment is running to avoid duplicate challenges.

4. **Verify the UI state**
   - Check that the MFA screen no longer gets stuck on the invalid code state and that “Start over” can recover to a fresh QR/setup screen.

## Technical notes

- The likely issue is that `startOver()` currently only loops through `factorsData.totp`, while stale/unverified factors can live in `factorsData.all`.
- The fix will stay limited to `src/components/auth/MfaGate.tsx`.