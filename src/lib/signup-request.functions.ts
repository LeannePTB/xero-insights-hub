import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/rate-limit.server";

const inputSchema = z.object({
  contactName: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  firmName: z.string().trim().min(1).max(120),
  note: z.string().trim().max(1000).optional(),
  /** Honeypot — must stay empty. Bots that fill it are silently accepted. */
  website: z.string().max(0).optional(),
});

/**
 * Request access (Sign Up with Xero modified flow, and the "Request access"
 * link on the sign-in page).
 *
 * SYSTEM CONTEXT — pre-session. Unauthenticated by design: the caller has no
 * account yet. Every field is treated as unverified free text (the Xero
 * identity pre-fill is convenience only). The insert into signup_requests
 * uses the service role because the table is revoked from anon/authenticated
 * by policy; it is registered in docs/security/admin-client-register.md.
 * Rate limited per email and globally; a filled honeypot returns success
 * without writing anything. Nothing about existing accounts is revealed.
 */
export const requestSignup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) return { ok: true }; // honeypot: pretend it worked

    await enforceRateLimit(`signup-request:${data.email}`, 3, 86400);
    await enforceRateLimit("signup-request:global", 30, 3600);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("signup_requests").insert({
      contact_name: data.contactName,
      email: data.email,
      firm_name: data.firmName,
      note: data.note || null,
      status: "pending",
    });
    if (error) {
      console.error("signup request insert failed", error.message);
      throw new Error("Could not send your request. Please try again.");
    }
    return { ok: true };
  });
