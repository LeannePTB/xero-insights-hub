import { postAuthDestination } from "@/lib/session-cutoff";

type MfaReader = {
  listFactors: () => Promise<{ data: { totp?: { status: string }[] } | null; error?: unknown }>;
  getAuthenticatorAssuranceLevel: () => Promise<{ data: { currentLevel?: string | null } | null; error?: unknown }>;
};

/** Navigation only: destination guards and server AAL2 checks remain authoritative. */
export async function routeAfterAuth(
  mfa: MfaReader,
  navigate: (opts: { to: string; replace?: boolean }) => void | Promise<void>,
) {
  const factors = await mfa.listFactors();
  if (factors.error) throw factors.error;
  if (!(factors.data?.totp ?? []).some((f) => f.status === "verified")) {
    await navigate({ to: "/auth/mfa-enroll", replace: true });
    return;
  }
  const aal = await mfa.getAuthenticatorAssuranceLevel();
  if (aal.error) throw aal.error;
  await navigate({
    to: aal.data?.currentLevel === "aal2" ? postAuthDestination() : "/auth/mfa-verify",
    replace: true,
  });
}