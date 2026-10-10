import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

const allowance = z.number().int().min(1).max(1_000_000).nullable();

export const getTrixieAdmin = createServerFn({ method: "GET" }).middleware([requireAal2]).handler(async ({ context }) => {
  const [settings, knowledge, limits, usage] = await Promise.all([
    (context.supabase as any).rpc("admin_trixie_settings"),
    (context.supabase as any).rpc("admin_trixie_knowledge"),
    (context.supabase as any).rpc("admin_trixie_limits"),
    (context.supabase as any).rpc("admin_trixie_usage", { _from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString() }),
  ]);
  for (const result of [settings, knowledge, limits, usage]) if (result.error) throw new Error("Trixie administration could not be loaded.");
  return { settings: settings.data?.[0] ?? null, knowledge: knowledge.data ?? [], limits: limits.data ?? [], usage: usage.data ?? [] };
});

export const saveTrixieSettings = createServerFn({ method: "POST" }).middleware([requireAal2])
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean(), model: z.literal("openai/gpt-6-astra"), defaultAllowance: allowance, warningThreshold: z.number().int().min(1).max(1_000_000), platformAllowance: allowance, tokenCostGuardUsd: z.number().positive().max(1_000_000).nullable() }).parse(input))
  .handler(async ({ data, context }) => { const { error } = await (context.supabase as any).rpc("save_trixie_settings", { _enabled: data.enabled, _model: data.model, _default: data.defaultAllowance, _warning: data.warningThreshold, _platform: data.platformAllowance, _guard: data.tokenCostGuardUsd }); if (error) throw new Error("Trixie settings could not be saved."); return { ok: true }; });

export const saveTrixieOrgLimit = createServerFn({ method: "POST" }).middleware([requireAal2])
  .inputValidator((input: unknown) => z.object({ firmId: z.string().uuid(), allowance }).parse(input))
  .handler(async ({ data, context }) => { const { error } = await (context.supabase as any).rpc("save_trixie_org_limit", { _firm_id: data.firmId, _allowance: data.allowance }); if (error) throw new Error("Organisation allowance could not be saved."); return { ok: true }; });

export const saveTrixieArticle = createServerFn({ method: "POST" }).middleware([requireAal2])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid().nullable(), title: z.string().trim().min(3).max(160), body: z.string().trim().min(10).max(20_000), tags: z.array(z.string().trim().min(1).max(40)).max(20), audience: z.enum(["all","staff","viewer","platform"]), active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => { const { data: id, error } = await (context.supabase as any).rpc("save_trixie_article", { _id: data.id, _title: data.title, _body: data.body, _tags: data.tags, _audience: data.audience, _active: data.active }); if (error) throw new Error("Knowledge article could not be saved."); return { id }; });