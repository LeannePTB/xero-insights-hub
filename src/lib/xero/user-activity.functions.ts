// Xero file activity (last sign-ins per user). Reads the stored nightly
// snapshot only — zero live Xero calls. Access: requireAal2 + the database
// assert_widget_access check, then the snapshot read runs as the caller under
// RLS. The caller-supplied tenant id is a filter, never a grant.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

const Input = z.object({ clientId: z.string().uuid(), tenantId: z.string().min(1) }).strict();

export type XeroUserActivity = {
  name: string;
  lastLoginAt: string | null;
  loginsThisMonth: number | null;
  documentsCreated: number | null;
};

export type XeroUserActivityResponse = {
  available: boolean;
  users: XeroUserActivity[];
  fetchedAt: string | null;
};

export const getXeroUserActivity = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }): Promise<XeroUserActivityResponse> => {
    const { assertWidgetAccess } = await import("./access.server");
    // The card lives in the statutory block next to Tax obligations and is
    // gated on the same entitlement.
    await assertWidgetAccess(context.supabase, data.tenantId, "tax_obligations");
    const { readSnapshot } = await import("./snapshot-read.server");
    const hit = await readSnapshot({
      supabase: context.supabase,
      tenantId: data.tenantId,
      clientId: data.clientId,
      reportKey: "user_activities",
    });
    if (!hit) return { available: false, users: [], fetchedAt: null };
    const raw = ((hit.payload as any)?.Users ?? []) as any[];
    const users: XeroUserActivity[] = raw.map((u) => {
      const name =
        (typeof u?.Name === "string" && u.Name) ||
        [u?.FirstName, u?.LastName].filter((p) => typeof p === "string" && p).join(" ") ||
        "A Xero user";
      const lastLogin = typeof u?.LastLoginDateUtc === "string" ? new Date(u.LastLoginDateUtc) : null;
      return {
        name,
        lastLoginAt: lastLogin && !isNaN(lastLogin.getTime()) ? lastLogin.toISOString() : null,
        loginsThisMonth: typeof u?.NumberOfLogins === "number" ? u.NumberOfLogins : null,
        documentsCreated: typeof u?.NumberOfDocumentsCreated === "number" ? u.NumberOfDocumentsCreated : null,
      };
    });
    users.sort((a, b) => (b.lastLoginAt ?? "").localeCompare(a.lastLoginAt ?? ""));
    return { available: true, users, fetchedAt: hit.source.fetchedAt };
  });
