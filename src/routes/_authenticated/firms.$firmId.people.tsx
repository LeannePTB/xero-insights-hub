import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/firms/$firmId/people")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/firms/$firmId/settings",
      params: { firmId: params.firmId },
      hash: "people",
    });
  },
});
