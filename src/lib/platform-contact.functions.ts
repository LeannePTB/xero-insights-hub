import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

/** Fallback when the setting cannot be read. Platform metadata only (Path C). */
export const DEFAULT_MAIN_CONTACT = "hello@tractionadvisory.com.au";

/** Public reader: the platform's main contact address (display metadata, no client data). */
export const getMainContactEmail = createServerFn({ method: "GET" }).handler(async (): Promise<{ email: string }> => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return { email: DEFAULT_MAIN_CONTACT };
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await (client as any).rpc("get_platform_contact");
  const email = !error ? ((data ?? []) as any[])[0]?.main_contact_email : null;
  return { email: typeof email === "string" && email ? email : DEFAULT_MAIN_CONTACT };
});

/** System Administrator save; aal2, role and audit are enforced in public.admin_set_main_contact_email. */
export const saveMainContactEmail = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ email: z.string().trim().max(254).email() }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("admin_set_main_contact_email", { _email: data.email });
    if (error) throw new Error(/super|Forbidden|NO_ACCESS|insufficient|aal2/i.test(error.message) ? "Forbidden" : "Check the email address.");
    return { ok: true };
  });
