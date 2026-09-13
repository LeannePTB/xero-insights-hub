# Public security contact page and security.txt

Security classification: **not security-relevant to access control** — both artefacts are
static, unauthenticated, read no data, and add no role, policy, grant, function or access
path. It touches a public route, so the gate's public-route questions are answered here:
no session is needed by design; there is no credential, no input, no database read.

## What changes

1. **`public/.well-known/security.txt`** — RFC 9116 file served as a static asset:
   `Contact: mailto:security@tractionadvisory.com.au`, `Expires: 2027-09-13T00:00:00.000Z`
   (12 months from build date 13 Sep 2026), `Policy: https://tractionadvisory.com.au/security`,
   `Preferred-Languages: en`. Comment line noting annual refresh. No `Encryption` field
   (no PGP key exists). Verified to resolve on the dev server before reporting done;
   if the static pipeline strips dot-paths, a TanStack server route serves it instead.
2. **`/security` public route** — the agreed wording from `docs/security/incident-register.md`,
   verbatim, plus one honest line that the practice is a small team with no 24/7 security
   desk. No session, no data. Styled to match the existing public auth page. Own `head()`
   title/description.
3. **Link** — the site has no marketing footer and no privacy-policy page; the only public
   page is `/auth`, so the link goes there, next to the existing copyright line. Noted in
   the report so the owner can add it to a privacy policy later.
4. **Docs** — `docs/security/incident-register.md`: reporting address and published
   location `[CONFIRM]` markers resolved (alias forwards to `admin@`, watched by the whole
   team; the same fact answers the backup-contact line). Every other marker and every
   register/drill row untouched. Backlog 39(f) page-published part closed; a new open item
   records the annual `security.txt` `Expires:` refresh.

## Verification

`bun run security:check` before/after with fingerprint, typecheck, linter, and a live
`curl` of `/.well-known/security.txt` on the dev server showing `Content-Type: text/plain`.
