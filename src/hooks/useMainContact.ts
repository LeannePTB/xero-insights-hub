import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_MAIN_CONTACT } from "@/lib/platform-contact.functions";

export const MAIN_CONTACT_KEY = ["platform-main-contact"];

/** Traction Advisory's main contact address: anon-safe database reader (platform metadata only). */
export function useMainContact(): string {
  const q = useQuery({
    queryKey: MAIN_CONTACT_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_platform_contact");
      const email = !error ? ((data ?? []) as any[])[0]?.main_contact_email : null;
      return typeof email === "string" && email ? email : DEFAULT_MAIN_CONTACT;
    },
    staleTime: 10 * 60_000,
    retry: false,
  });
  return q.data ?? DEFAULT_MAIN_CONTACT;
}
