The callback URL is now correct; the current live error is a server-side 500 in the callback. Published logs show the concrete failure: `ReferenceError: require is not defined` inside the token encryption helper.

Plan:
1. Update `src/lib/crypto.server.ts` so it uses only top-level ES imports from `crypto` and removes the runtime `require("crypto")` call.
2. Keep the existing AES-256-GCM token format and `\x...` bytea output unchanged, so existing encrypted tokens remain readable.
3. Add defensive error logging around callback token encryption / connection save so future Xero callback failures redirect with `xero_error=...` instead of showing the generic 500 page where practical.
4. Verify against the published/server logs path that the `require is not defined` error is gone after implementation.

Likely cause:
The app runs this callback in a serverless runtime where CommonJS `require()` is not available. The crypto helper imports most crypto functions correctly, but still calls `require("crypto")` inside `getKey()` when hashing `TOKEN_ENC_KEY`, which crashes during the Xero callback before the connection can be saved.