import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ServerPlatformBranding = {
  productName: string;
  logoLight: string | null;
  logoDark: string | null;
  favicon: string | null;
  emailSenderName: string;
};

const FALLBACK: ServerPlatformBranding = {
  productName: "Traction Advisory",
  logoLight: null,
  logoDark: null,
  favicon: null,
  emailSenderName: "Traction Advisory",
};

/** Public metadata only. Call from an existing server-only boundary. */
export async function getPlatformBrandingServer(): Promise<ServerPlatformBranding> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return FALLBACK;
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await (client as any).rpc("get_platform_branding");
  if (error) return FALLBACK;
  const row = ((data ?? []) as any[])[0];
  if (!row) return FALLBACK;
  return {
    productName: row.product_name || FALLBACK.productName,
    logoLight: row.logo_light || null,
    logoDark: row.logo_dark || row.logo_light || null,
    favicon: row.favicon || null,
    emailSenderName: row.email_sender_name || FALLBACK.emailSenderName,
  };
}