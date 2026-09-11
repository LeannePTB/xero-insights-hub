/**
 * The one super-admin check (security rules 3 and 6).
 *
 * There used to be six near-identical TypeScript copies of this, each reading
 * `user_roles` itself. The rule now has a single implementation, in the
 * database: `public.assert_super_admin()` re-checks aal2 and the role and
 * raises otherwise. This wrapper holds no rule — it only forwards the caller's
 * session, so a typo here can widen nothing.
 *
 * Super admin on its own still grants ZERO organisation or client data
 * (invariant 3): it authorises Path C platform metadata only.
 */
export async function assertSuperAdminDb(supabase: any) {
  const { error } = await supabase.rpc("assert_super_admin");
  if (error) throw new Error(/forbidden/i.test(error.message) ? "Forbidden" : error.message);
}

/** Non-throwing form, for the few places that branch instead of failing. */
export async function meIsSuperAdmin(supabase: any): Promise<boolean> {
  const { data, error } = await supabase.rpc("me_is_super_admin");
  if (error) return false;
  return data === true;
}
