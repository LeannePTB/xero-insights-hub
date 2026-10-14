import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/firms/$firmId")({
  staticData: { sitemap: false },
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/system/organisations/$firmId", params: { firmId: params.firmId }, search: { tab: "overview" }, replace: true });
  },
});
