const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export type StripeEnv = "sandbox" | "live";

export function getStripeEnvironment(): StripeEnv {
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  if (clientToken?.startsWith("pk_live_")) return "live";
  throw new Error(
    "Payments are not configured for this build. Complete go-live in your Lovable project to accept live payments.",
  );
}
