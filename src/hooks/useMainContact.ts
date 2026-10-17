import { useQuery } from "@tanstack/react-query";
import { DEFAULT_MAIN_CONTACT, getMainContactEmail } from "@/lib/platform-contact.functions";

export const MAIN_CONTACT_KEY = ["platform-main-contact"];

/** Traction Advisory's main contact address (platform setting, public display metadata). */
export function useMainContact(): string {
  const q = useQuery({ queryKey: MAIN_CONTACT_KEY, queryFn: () => getMainContactEmail(), staleTime: 10 * 60_000, retry: false });
  return q.data?.email ?? DEFAULT_MAIN_CONTACT;
}
