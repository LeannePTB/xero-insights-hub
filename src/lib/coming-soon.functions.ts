import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

/**
 * "Coming soon" teasers. Display only: nothing here makes a card visible or
 * usable — that is still client_cards_v2 (Available / Early access). Every
 * reader and writer is a guarded database function:
 *   coming_soon_for_client   practice users of the client's organisation (aal2)
 *   register_coming_soon_interest  same gate, shared 3/hour enquiry limit, audited
 *   admin_coming_soon_list / admin_save_coming_soon / admin_delete_coming_soon  System Administrator
 */
export type ComingSoonEntry = { key: string; name: string; description: string; timing: string | null; earlyAccess: boolean };

const Key = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/);

export const getClientComingSoon = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ clientId: z.string().uuid() }).strict().parse(i))
  .handler(async ({ data, context }): Promise<{ entries: ComingSoonEntry[] }> => {
    const { data: rows, error } = await (context.supabase as any).rpc("coming_soon_for_client", { _client_id: data.clientId });
    if (error) return { entries: [] };
    return {
      entries: ((rows ?? []) as any[]).map((r) => ({
        key: r.entry_key,
        name: r.name,
        description: r.description ?? "",
        timing: r.timing ?? null,
        earlyAccess: !!r.early_access,
      })),
    };
  });

export const registerComingSoonInterest = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) =>
    z.object({ clientId: z.string().uuid(), entryKey: Key, submissionKey: z.string().uuid() }).strict().parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await (context.supabase as any).rpc("register_coming_soon_interest", {
      _client_id: data.clientId,
      _entry_key: data.entryKey,
      _submission_key: data.submissionKey,
    });
    if (error) {
      if (/ENQUIRY_LIMIT/.test(error.message)) throw new Error("You can send up to three enquiries per hour. Please try again later.");
      throw new Error("Your interest could not be recorded.");
    }
    // The alert never blocks or fails the saved interest.
    let notification: "queued" | "failed" = "failed";
    try {
      notification = await queueInterestAlert(r as any);
    } catch (e) {
      console.error("interest alert failed", e instanceof Error ? e.message : "unknown");
    }
    return { ok: true, notification };
  });

async function queueInterestAlert(r: { id: string; name: string; email: string; organisation: string; client: string; entry: string; createdAt: string }) {
  // System context (email queue): read the platform alert address and record the send link.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const { data: b } = await admin.from("platform_branding").select("enquiry_alert_email").eq("id", true).maybeSingle();
  const to = b?.enquiry_alert_email as string | null;
  if (!to) {
    await admin.from("upgrade_enquiries").update({ alert_error: "No alert address configured" }).eq("id", r.id);
    return "failed" as const;
  }
  const { enqueueAppEmail } = await import("@/lib/email/send.server");
  const { perthTime } = await import("@/lib/upgrade-enquiries.functions");
  const res = await enqueueAppEmail({
    templateName: "enquiry-alert",
    recipientEmail: to,
    idempotencyKey: `enquiry-alert-${r.id}`,
    replyTo: r.email,
    templateData: {
      organisation: r.organisation,
      submitterName: r.name,
      submitterEmail: r.email,
      modules: [`Coming soon: ${r.entry}`],
      clients: [r.client],
      message: `Interested in: ${r.entry}`,
      submittedAt: perthTime(r.createdAt),
      enquiriesUrl: "https://tractionadvisory.com.au/system/enquiries",
    },
  });
  await admin
    .from("upgrade_enquiries")
    .update({ alert_message_id: res.messageId ?? null, alert_error: res.status === "queued" ? null : (res.reason ?? res.status) })
    .eq("id", r.id);
  return res.status === "queued" ? ("queued" as const) : ("failed" as const);
}

export type AdminComingSoonRow = {
  key: string;
  name: string;
  description: string;
  timing: string | null;
  sortOrder: number;
  shown: boolean;
  showOnWebsite: boolean;
  moduleKey: string | null;
  cardKey: string | null;
  nowAvailable: boolean;
};

export const listComingSoonAdmin = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .handler(async ({ context }): Promise<{ rows: AdminComingSoonRow[] }> => {
    const { data, error } = await (context.supabase as any).rpc("admin_coming_soon_list");
    if (error) throw new Error("Coming soon entries are unavailable.");
    return {
      rows: ((data ?? []) as any[]).map((r) => ({
        key: r.entry_key,
        name: r.name,
        description: r.description ?? "",
        timing: r.timing ?? null,
        sortOrder: Number(r.sort_order ?? 100),
        shown: !!r.is_shown,
        showOnWebsite: !!r.show_on_website,
        moduleKey: r.module_key ?? null,
        cardKey: r.card_key ?? null,
        nowAvailable: !!r.now_available,
      })),
    };
  });

export const saveComingSoon = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) =>
    z.object({
      key: Key,
      name: z.string().trim().min(1).max(80),
      description: z.string().trim().max(200),
      timing: z.string().trim().max(40).nullable(),
      sortOrder: z.number().int().min(0).max(9999),
      shown: z.boolean(),
      showOnWebsite: z.boolean(),
      moduleKey: z.string().regex(/^[a-z][a-z_]{1,39}$/).nullable(),
      cardKey: z.string().regex(/^[a-z][a-z_]{1,39}$/).nullable(),
    }).strict().parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("admin_save_coming_soon", {
      _entry_key: data.key,
      _name: data.name,
      _description: data.description,
      _timing: data.timing,
      _sort_order: data.sortOrder,
      _is_shown: data.shown,
      _show_on_website: data.showOnWebsite,
      _module_key: data.moduleKey,
      _card_key: data.cardKey,
    });
    if (error) throw new Error(/Forbidden|super|NO_ACCESS|insufficient/i.test(error.message) ? "Forbidden" : "The entry could not be saved.");
    return { ok: true };
  });

export const deleteComingSoon = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ key: Key }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("admin_delete_coming_soon", { _entry_key: data.key });
    if (error) throw new Error("The entry could not be removed.");
    return { ok: true };
  });
