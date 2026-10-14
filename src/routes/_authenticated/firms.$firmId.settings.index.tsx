import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/firms/$firmId/settings/")({
  staticData: { sitemap: false },
  beforeLoad: ({ params, location }) => {
    // Old "#people" links now go to the People & access page.
    if (location.hash === "people") {
      throw redirect({ to: "/firms/$firmId/people", params: { firmId: params.firmId }, replace: true });
    }
    throw redirect({ to: "/firms/$firmId/settings/general", params: { firmId: params.firmId }, replace: true });
  },
});
