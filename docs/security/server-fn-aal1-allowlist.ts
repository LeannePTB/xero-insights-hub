/**
 * Server functions that deliberately do NOT use `requireAal2`.
 *
 * Project Knowledge rule 2: data access requires an aal2 session. Every entry
 * below is an approved exception, verified 11 Sep 2026 by reading the handler.
 * tests/static-guards.test.ts fails the build when a server function is added
 * without `requireAal2` and without an entry here.
 *
 * Adding an entry is a security decision — it needs the owner, not the agent.
 */

export type Aal1Exception = {
  /** Path relative to the project root. */
  file: string;
  /** Exported const name. */
  fn: string;
  kind: "aal1-logger" | "unauthenticated";
  reason: string;
  /** What stops this being an access path to organisation or client data. */
  containment: string;
};

export const AAL1_ALLOWLIST: Aal1Exception[] = [
  // ------------------------------------------------- approved aal1 loggers (2)
  {
    file: "src/lib/audit.functions.ts",
    fn: "logAuthEvent",
    kind: "aal1-logger",
    reason:
      "Auth lifecycle events (sign-out, MFA enrol/unenrol, failed MFA challenge, password change/reset) must be recordable before a second factor exists.",
    containment:
      "requireSupabaseAuth (verified token). Event name checked against a fixed allow-list; actor and email are taken from context.userId/context.claims, never from caller input. Rate limited per user. Writes only audit_log.",
  },
  {
    file: "src/lib/login-log.functions.ts",
    fn: "logLogin",
    kind: "aal1-logger",
    reason: "Fires at sign-in, before MFA, so it can never require aal2.",
    containment:
      "requireSupabaseAuth (verified token). user_id/email from the token; ip/user_agent from request headers; no caller-supplied field is trusted. Rate limited per user. Writes only login_events.",
  },

  // --------------------------------------------- unauthenticated functions (7)
  {
    file: "src/lib/api/example.functions.ts",
    fn: "getGreeting",
    kind: "unauthenticated",
    reason: "Template sample endpoint, echoes a greeting. Not a product feature.",
    containment:
      "Touches no database and no secret. BACKLOG: delete it — tracked in docs/security-backlog.md.",
  },
  {
    file: "src/lib/audit.functions.ts",
    fn: "logFailedSignIn",
    kind: "unauthenticated",
    reason: "A failed sign-in means there is no session or token to authenticate with.",
    containment:
      "Rate limited per IP. Writes an audit_log row only; email and reason are truncated. Returns nothing about whether the account exists.",
  },
  {
    file: "src/lib/invites.functions.ts",
    fn: "getInvitePublic",
    kind: "unauthenticated",
    reason: "The invitee has no account yet and must see who invited them before signing up.",
    containment:
      "The long random token is the credential; only its hash is stored. Returns email, role and organisation name only, and only for an unexpired, unaccepted invite.",
  },
  {
    file: "src/lib/invites.functions.ts",
    fn: "acceptInvite",
    kind: "unauthenticated",
    reason: "This is how a brand-new user obtains their first session.",
    containment:
      "Token hash lookup, single use, expiry checked, rate limited by token prefix. Membership is created only for the organisation named in the invite.",
  },
  {
    file: "src/lib/reports/report-link.functions.ts",
    fn: "describeReportLink",
    kind: "unauthenticated",
    reason: "External report recipients hold no account.",
    containment: "Recipient-bound token is the credential and reaches exactly one report. IP rate limited.",
  },
  {
    file: "src/lib/reports/report-link.functions.ts",
    fn: "openReportLink",
    kind: "unauthenticated",
    reason: "Same as describeReportLink — the recipient opens one report without a session.",
    containment:
      "Token plus recipient email must both match; revocation and expiry checked; opens are recorded. Rate limited by IP and token.",
  },
  {
    file: "src/lib/xero/connections.functions.ts",
    fn: "startXeroSignIn",
    kind: "unauthenticated",
    reason: "Called from /auth before any session exists.",
    containment:
      "Mints a PKCE state row with user_id null and returns Xero's authorize URL. It grants nothing: the callback matches the Xero identity email against already-invited users, so it cannot create access.",
  },
];
