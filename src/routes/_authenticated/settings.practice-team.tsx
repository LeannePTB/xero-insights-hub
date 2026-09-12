import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The practice team is now shown and managed on the advisors page — the same
 * people, one list, so the two cannot drift. This path is kept as a redirect so
 * existing links and bookmarks still work.
 */
export const Route = createFileRoute("/_authenticated/settings/practice-team")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/advisors" });
  },
});
