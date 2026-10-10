import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import defaultLogo from "@/assets/traction-advisory-logo.png";
import defaultLogoDark from "@/assets/traction-advisory-logo-white.png";

export type PlatformBranding = {
  productName: string;
  logoLight: string;
  logoDark: string;
  favicon: string | null;
  emailSenderName: string;
  isCustom: boolean;
};

export const DEFAULT_BRANDING: PlatformBranding = {
  productName: "Traction Advisory",
  logoLight: defaultLogo,
  logoDark: defaultLogoDark,
  favicon: null,
  emailSenderName: "Traction Advisory",
  isCustom: false,
};

export const PLATFORM_BRANDING_KEY = ["platform-branding"] as const;

/** Public display branding; falls back to the bundled assets. */
export function usePlatformBranding(): PlatformBranding {
  const q = useQuery({
    queryKey: PLATFORM_BRANDING_KEY,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_platform_branding");
      if (error) return null;
      return ((data ?? []) as any[])[0] ?? null;
    },
  });
  const row = q.data;
  if (!row) return DEFAULT_BRANDING;
  return {
    productName: row.product_name || DEFAULT_BRANDING.productName,
    logoLight: row.logo_light || DEFAULT_BRANDING.logoLight,
    logoDark: row.logo_dark || row.logo_light || DEFAULT_BRANDING.logoDark,
    favicon: row.favicon || null,
    emailSenderName: row.email_sender_name || DEFAULT_BRANDING.emailSenderName,
    isCustom: true,
  };
}
