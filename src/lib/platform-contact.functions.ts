import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

/** Fallback when the setting cannot be read. Platform metadata only (Path C). */
export const DEFAULT_MAIN_CONTACT = "hello@tractionadvisory.com.au";

/** System Administrator save; aal2, role and audit are enforced in public.admin_set_main_contact_email. */
export const saveMainContactEmail = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ email: z.string().trim().max(254).email() }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("admin_set_main_contact_email", { _email: data.email });
    if (error) throw new Error(/super|Forbidden|NO_ACCESS|insufficient|aal2/i.test(error.message) ? "Forbidden" : "Check the email address.");
    return { ok: true };
  });
