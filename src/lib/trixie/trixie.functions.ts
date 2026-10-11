import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

const allowance = z.number().int().min(1).max(1_000_000).nullable();

export const getTrixieAdmin = createServerFn({ method: "GET" }).middleware([requireAal2]).handler(async ({ context }) => {
  const sb = context.supabase as any;
  const now = new Date();
  const [settings, knowledge, limits, usage, spend, alerts, alertSettings] = await Promise.all([
    sb.rpc("admin_trixie_settings"),
    sb.rpc("admin_trixie_knowledge"),
    sb.rpc("admin_trixie_limits"),
    sb.rpc("admin_trixie_usage", { _from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString() }),
    sb.rpc("admin_trixie_spend_overview", { _days: 30 }),
    sb.rpc("admin_trixie_alerts", { _limit: 50 }),
    sb.rpc("admin_trixie_alert_settings"),
  ]);
  for (const result of [settings, knowledge, limits, usage, spend, alerts, alertSettings]) if (result.error) throw new Error("Trixie administration could not be loaded.");
  const daily = (spend.data ?? []).map((d: any) => ({ day: String(d.day), spend: Number(d.spend_usd), questions: Number(d.questions) }));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const mtd = daily.filter((d: { day: string }) => d.day >= monthStart);
  return {
    settings: settings.data?.[0] ?? null,
    alertSettings: alertSettings.data?.[0] ?? { spend_alert_thresholds_usd: [25, 50, 100], daily_spike_multiplier: 3, daily_spike_floor_usd: 1 },
    knowledge: knowledge.data ?? [],
    limits: limits.data ?? [],
    usage: usage.data ?? [],
    daily,
    monthToDateSpend: mtd.reduce((s: number, d: { spend: number }) => s + d.spend, 0),
    monthToDateQuestions: mtd.reduce((s: number, d: { questions: number }) => s + d.questions, 0),
    alerts: alerts.data ?? [],
  };
});

export const saveTrixieSettings = createServerFn({ method: "POST" }).middleware([requireAal2])
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean(), model: z.literal("openai/gpt-6-astra"), defaultAllowance: allowance, warningThreshold: z.number().int().min(1).max(100), platformAllowance: allowance, tokenCostGuardUsd: z.number().positive().max(100).nullable() }).parse(input))
  .handler(async ({ data, context }) => { const { error } = await (context.supabase as any).rpc("save_trixie_settings", { _enabled: data.enabled, _model: data.model, _default: data.defaultAllowance, _warning: data.warningThreshold, _platform: data.platformAllowance, _guard: data.tokenCostGuardUsd }); if (error) throw new Error("Trixie settings could not be saved."); return { ok: true }; });

export const saveTrixieAlertSettings = createServerFn({ method: "POST" }).middleware([requireAal2])
  .inputValidator((input: unknown) => z.object({ thresholds: z.array(z.number().positive().max(1_000_000)).max(10), multiplier: z.number().gt(1).max(50) }).parse(input))
  .handler(async ({ data, context }) => { const { error } = await (context.supabase as any).rpc("save_trixie_alert_settings", { _thresholds: data.thresholds, _multiplier: data.multiplier }); if (error) throw new Error("Alert settings could not be saved."); return { ok: true }; });

export const acknowledgeTrixieAlert = createServerFn({ method: "POST" }).middleware([requireAal2])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => { const { error } = await (context.supabase as any).rpc("acknowledge_trixie_alert", { _id: data.id }); if (error) throw new Error("Alert could not be dismissed."); return { ok: true }; });

export const saveTrixieOrgLimit = createServerFn({ method: "POST" }).middleware([requireAal2])
  .inputValidator((input: unknown) => z.object({ firmId: z.string().uuid(), allowance }).parse(input))
  .handler(async ({ data, context }) => { const { error } = await (context.supabase as any).rpc("save_trixie_org_limit", { _firm_id: data.firmId, _allowance: data.allowance }); if (error) throw new Error("Organisation allowance could not be saved."); return { ok: true }; });

export const saveTrixieArticle = createServerFn({ method: "POST" }).middleware([requireAal2])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid().nullable(), title: z.string().trim().min(3).max(160), body: z.string().trim().min(10).max(20_000), tags: z.array(z.string().trim().min(1).max(40)).max(20), audience: z.enum(["all","staff","viewer","platform"]), active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => { const { data: id, error } = await (context.supabase as any).rpc("save_trixie_article", { _id: data.id, _title: data.title, _body: data.body, _tags: data.tags, _audience: data.audience, _active: data.active }); if (error) throw new Error("Knowledge article could not be saved."); return { id }; });
