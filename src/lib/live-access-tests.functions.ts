import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";
import { assertSuperAdminDb } from "@/lib/auth/super-admin.server";

export type LiveRunResult = {
  runId: string;
  passed: number;
  failed: number;
  inconclusive: number;
  failures: {
    role: string;
    resource: string;
    operation: string;
    expected: string;
    observed: string;
    detail: string;
  }[];
};

/**
 * Runs the slim live access-test suite from the admin screen.
 *
 * Super admin only, and the check is the database's own
 * (assertSuperAdminDb → public.me_is_super_admin), never a role read here. The
 * runner itself is loaded inside the handler so nothing server-only reaches a
 * client bundle. Returns counts and failed expectations only.
 */
export const runAccessTests = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .handler(async ({ context }): Promise<LiveRunResult> => {
    await assertSuperAdminDb(context.supabase);
    const { runLiveAccessTests } = await import("@/lib/live-access-tests.server");
    const summary = await runLiveAccessTests(context.userId ?? null);
    return {
      runId: summary.runId,
      passed: summary.passed,
      failed: summary.failed,
      inconclusive: summary.inconclusive,
      failures: summary.probes
        .filter((p) => !p.passed)
        .map((p) => ({
          role: p.role,
          resource: p.resource,
          operation: p.operation,
          expected: p.expected,
          observed: p.observed,
          detail: p.detail,
        })),
    };
  });
