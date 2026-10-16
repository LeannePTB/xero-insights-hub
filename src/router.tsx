import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { getGlobalStartContext } from "@tanstack/react-start";
import { routeTree } from "./routeTree.gen";
import { handleIfSessionEnded } from "./lib/session-ended";
import { USER_ACTION_EVENT } from "./lib/session-activity-policy";

export const getRouter = () => {
  // A session the server has ended must never surface as a broken page or as
  // an access error. Caught once here, so every query and every mutation in the
  // application ends the session cleanly and lands on the sign-in form.
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error) => void handleIfSessionEnded(error) }),
    mutationCache: new MutationCache({
      onError: (error) => void handleIfSessionEnded(error),
      // A completed user action is real activity (see SessionIdleGuard).
      onSuccess: () => {
        if (typeof window !== "undefined") window.dispatchEvent(new Event(USER_ACTION_EVENT));
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Server: the per-request CSP nonce from the security-headers middleware.
    // Browser: the router reads it back from the csp-nonce meta tag itself.
    ssr: typeof window === "undefined"
      ? { nonce: readRequestNonce() }
      : undefined,
  });

  return router;
};

function readRequestNonce(): string | undefined {
  try {
    return (getGlobalStartContext() as { cspNonce?: string } | undefined)?.cspNonce;
  } catch {
    return undefined;
  }
}
