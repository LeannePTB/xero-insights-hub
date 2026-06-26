## What I found

The current project is not actually structured the same as the working Business Hub project.

The working project uses:
- A public `/auth/mfa-enroll` route for first setup.
- A public `/auth/mfa-verify` route for existing verified factors.
- The protected app layout redirects users to one of those routes before loading the dashboard.
- Setup verification uses Supabase’s documented `challenge()` then `verify()` sequence.

This project currently uses a single in-layout `MfaGate` component inside `/_authenticated`. That means MFA setup/verification happens while the protected app route is already loading, and the recent change switched setup to `challengeAndVerify()`. The docs and the working app both show enrollment using `challenge()` + `verify()`. The mismatch is the most likely reason the same valid-looking code still fails.

## Plan

1. **Replace the single MFA gate with the working route pattern**
   - Add `/auth/mfa-enroll` for users with no verified authenticator.
   - Add `/auth/mfa-verify` for users who already have an authenticator but need to step up to AAL2.
   - Keep both routes `ssr: false` so auth state is read only in the browser.

2. **Update protected route enforcement**
   - Change `src/routes/_authenticated/route.tsx` to match the working project:
     - confirm the user is signed in;
     - check MFA factors;
     - redirect to enroll if no verified TOTP exists;
     - redirect to verify if the current session is not AAL2;
     - render the normal authenticated content only after AAL2.

3. **Update login routing**
   - Change `src/routes/auth.tsx` so after sign-in it routes users to:
     - `/auth/mfa-enroll` if no verified factor exists;
     - `/auth/mfa-verify` if a factor exists but the session is not AAL2;
     - `/dashboard` only once MFA is satisfied.

4. **Use the documented verification sequence**
   - In enrollment and verification, use:
     - `supabase.auth.mfa.challenge({ factorId })`
     - then `supabase.auth.mfa.verify({ factorId, challengeId, code })`
   - Stop using `challengeAndVerify()` for the setup flow.
   - Continue using Supabase’s returned `totp.qr_code` image directly.

5. **Keep recovery but make it safe**
   - Before enrollment, remove stale unverified TOTP factors so the friendly-name collision cannot return.
   - Keep sign-out/cancel options.
   - Preserve the clearer invalid-code message.

6. **Retire `MfaGate` from the authenticated shell**
   - Stop rendering `MfaGate` in `/_authenticated/route.tsx`.
   - Leave the component unused or remove it only if no imports remain, to keep the change focused.

## Validation

After implementation I will verify:
- `/auth` sends signed-in users to the correct MFA page instead of straight to dashboard.
- `/auth/mfa-enroll` renders a QR code from the backend and uses `challenge()` + `verify()`.
- `/auth/mfa-verify` handles existing verified factors separately.
- Protected dashboard routes only render once the current session reaches AAL2.