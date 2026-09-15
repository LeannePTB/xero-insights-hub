import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { handleIfSessionEnded } from "./lib/session-ended";

export const getRouter = () => {
  // A session the server has ended must never surface as a broken page or as
  // an access error. Caught once here, so every query and every mutation in the
  // application ends the session cleanly and lands on the sign-in form.
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error) => void handleIfSessionEnded(error) }),
    mutationCache: new MutationCache({ onError: (error) => void handleIfSessionEnded(error) }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
