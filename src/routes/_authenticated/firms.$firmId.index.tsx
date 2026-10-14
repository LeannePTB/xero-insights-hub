import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyFirm } from "@/lib/firms.functions";
import { getMyContext } from "@/lib/roles.functions";
import { Loader2 } from "lucide-react";
import { ViewAsBanner } from "@/components/admin/ViewAsBanner";
import { OverviewView } from "@/components/overview/OverviewView";
import { XeroOnboardPickerDialog } from "@/components/admin/XeroOnboardPickerDialog";

import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/firms/$firmId/")({
  staticData: { sitemap: false },
  validateSearch: (
    search: Record<string, unknown>,
  ): { viewAs?: string; xero_onboarded?: string; xero_error?: string; xero_pick?: string } => ({
    ...(typeof search.viewAs === "string" ? { viewAs: search.viewAs } : {}),
    ...(typeof search.xero_onboarded === "string" ? { xero_onboarded: search.xero_onboarded } : {}),
    ...(typeof search.xero_error === "string" ? { xero_error: search.xero_error } : {}),
    ...(typeof search.xero_pick === "string" ? { xero_pick: search.xero_pick } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Organisation — Traction Advisory" },
      {
        name: "description",
        content: "Every client in this organisation, worst first, with what needs attention.",
      },
      { property: "og:title", content: "Organisation — Traction Advisory" },
      {
        property: "og:description",
        content: "Every client in this organisation, worst first, with what needs attention.",
      },
    ],
  }),
  component: FirmPage,
});

function FirmPage() {
  const { firmId } = Route.useParams();
  const {
    viewAs,
    xero_onboarded: xeroOnboarded,
    xero_error: xeroError,
    xero_pick: xeroPick,
  } = Route.useSearch();

  const requestedPreview = viewAs === "owner";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchFirm = useServerFn(getMyFirm);
  const fetchCtx = useServerFn(getMyContext);

  const firmQ = useQuery({
    queryKey: ["my-firm", firmId],
    queryFn: () => fetchFirm({ data: { firmId } }),
    retry: false,
  });

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  // Previewing is for platform admins and advisors only.
  const previewing = requestedPreview && (ctxQ.data?.canViewAs ?? false);
  // While previewing as the Organisation Owner, hide platform-admin-only controls.

  useEffect(() => {
    if (!xeroOnboarded && !xeroError) return;
    if (xeroOnboarded) toast.success(xeroOnboarded);
    if (xeroError) toast.error(xeroError);
    qc.invalidateQueries({ queryKey: ["clients", firmId] });
    navigate({
      to: "/firms/$firmId",
      params: { firmId },
      search: (prev: any) => ({ ...prev, xero_onboarded: undefined, xero_error: undefined }),
      replace: true,
    });
  }, [xeroOnboarded, xeroError, firmId, navigate, qc]);

  useEffect(() => {
    if (firmQ.error) {
      toast.error("You don't have access to that organisation.");
      navigate({ to: "/dashboard", replace: true });
    }
  }, [firmQ.error, navigate]);

  if (firmQ.isLoading || !firmQ.data) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const firm = firmQ.data.firm;

  return (
    <div className="min-h-screen bg-background">
      {previewing && (
        <ViewAsBanner
          label={`${firm.name} — as the Organisation Owner`}
          note="Layout and controls only; data access is unchanged"
        />
      )}
      {xeroPick && (
        <XeroOnboardPickerDialog
          firmId={firmId}
          state={xeroPick}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["clients", firmId] });
            navigate({
              to: "/firms/$firmId",
              params: { firmId },
              search: (prev: any) => ({ ...prev, xero_pick: undefined }),
              replace: true,
            });
          }}
        />
      )}
      {/* firmId is a filter inside the caller-scoped overview reader, never a grant. */}
      <OverviewView firmId={firmId} title={firm.name} />
    </div>
  );
}
