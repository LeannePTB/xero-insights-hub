// Server-only entitlement gates for dashboard widgets and organisation-level
// features. The database is the single source of truth: the plan is the
// ceiling, tier_widget_config is what's switched on, and the RPCs return the
// intersection. Never reimplement that logic here.
//
// These run through the caller's session (RLS applies) — never supabaseAdmin.
// Fail closed: any error resolves to "no access".

import type { WidgetKey } from "@/lib/tiers";

export async function clientAllowedWidgets(supabase: any, clientId: string): Promise<WidgetKey[]> {
  try {
    const { data, error } = await supabase.rpc("client_allowed_widgets", { _client_id: clientId });
    if (error) return [];
    return ((data ?? []) as string[]) as WidgetKey[];
  } catch {
    return [];
  }
}

export async function firmAllowedWidgets(supabase: any, firmId: string): Promise<WidgetKey[]> {
  try {
    const { data, error } = await supabase.rpc("firm_allowed_widgets", { _firm_id: firmId });
    if (error) return [];
    return ((data ?? []) as string[]) as WidgetKey[];
  } catch {
    return [];
  }
}

export async function clientCanUseWidget(
  supabase: any,
  clientId: string,
  widget: WidgetKey,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("client_can_use_widget", {
      _client_id: clientId,
      _widget: widget,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export async function firmCanUseWidget(
  supabase: any,
  firmId: string,
  widget: WidgetKey,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("firm_can_use_widget", {
      _firm_id: firmId,
      _widget: widget,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export const WIDGET_NOT_IN_PLAN =
  "This feature is not included in this organisation's plan.";

export async function assertClientWidget(
  supabase: any,
  clientId: string,
  widget: WidgetKey,
): Promise<void> {
  if (!(await clientCanUseWidget(supabase, clientId, widget))) {
    throw new Error(WIDGET_NOT_IN_PLAN);
  }
}

export async function assertFirmWidget(
  supabase: any,
  firmId: string,
  widget: WidgetKey,
): Promise<void> {
  if (!(await firmCanUseWidget(supabase, firmId, widget))) {
    throw new Error(WIDGET_NOT_IN_PLAN);
  }
}
