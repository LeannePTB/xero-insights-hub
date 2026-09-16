import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Plus,
} from "lucide-react";
import { AddClientFromXeroButton } from "@/components/admin/AddClientFromXeroButton";
import { SupportAccessCard } from "@/components/admin/SupportAccessCard";
import { TransferOwnershipCard } from "@/components/admin/TransferOwnershipCard";
import { FirmXeroFilesCard } from "@/components/admin/FirmXeroFilesCard";
import { OrgPurchaseCard } from "@/components/admin/OrgPurchaseCard";
import { PeopleSection } from "@/components/people/PeopleSection";
import { Button } from "@/components/ui/button";
import { getFirmSettingsSummary } from "@/lib/firm-subscription.functions";

export const Route = createFileRoute("/_authenticated/firms/$firmId/settings")({
  head: () => ({
    meta: [
      { title: "Organisation settings — Traction Advisory" },
      {
        name: "description",
        content:
          "Manage people, clients, Xero files, ownership and support access for this organisation.",
      },
      { property: "og:title", content: "Organisation settings — Traction Advisory" },
      {
        property: "og:description",
        content:
          "Manage people, clients, Xero files, ownership and support access for this organisation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FirmSettingsPage,
});

function FirmSettingsPage() {
  const { firmId } = Route.useParams();
  const navigate = useNavigate();
  const fetchSub = useServerFn(getFirmSettingsSummary);
  const q = useQuery({
    queryKey: ["firm-subscription", firmId],
    queryFn: () => fetchSub({ data: { firmId } }),
    retry: false,
  });

  if (q.isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (q.error || !q.data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-muted-foreground">
          You don&apos;t have access to this organisation&apos;s settings.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => navigate({ to: "/dashboard" })}
        >
          Back to organisations
        </Button>
      </main>
    );
  }

  const view = q.data;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/firms/$firmId" params={{ firmId }}>
          <ArrowLeft className="mr-1 h-4 w-4" /> {view.firm.name}
        </Link>
      </Button>

      <h1 className="font-display text-3xl font-semibold">Organisation settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage people, clients, Xero files and account settings for {view.firm.name}.
      </p>

      <div className="mt-6">
        <OrgPurchaseCard firmId={firmId} />
      </div>


      {/* Add clients */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-sm font-medium">Add clients</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {view.clientCount} of {view.clientLimit} clients used.
          {view.clientCount >= view.clientLimit
            ? " Client limit reached — increase the organisation's client allowance to add more."
            : " Connect a Xero file or set up a client manually."}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AddClientFromXeroButton
            firmId={firmId}
            disabled={view.clientCount >= view.clientLimit}
          />
          <Button
            variant="outline"
            asChild={view.clientCount < view.clientLimit}
            disabled={view.clientCount >= view.clientLimit}
          >
            {view.clientCount >= view.clientLimit ? (
              <span>
                <Plus className="mr-2 h-4 w-4" /> New client
              </span>
            ) : (
              <Link to="/clients/new" search={{ firmId } as any}>
                <Plus className="mr-2 h-4 w-4" /> New client
              </Link>
            )}
          </Button>
        </div>
      </section>

      {/* Xero organisations */}
      <div className="mt-6">
        <FirmXeroFilesCard firmId={firmId} />
      </div>

      {/* People follows resources and precedes ownership/support governance. Active
          membership is the same visibility boundary used by the former page. */}
      {view.isMember && (
        <section id="people" className="mt-8 scroll-mt-6">
          <h2 className="font-display text-2xl font-semibold">People &amp; access</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage Team members, Business owners and External advisers. Access is shown separately
            by relationship and scope.
          </p>
          <div className="mt-5">
            <PeopleSection firmId={firmId} />
          </div>
        </section>
      )}

      {/* Ownership handover */}
      <div className="mt-6">
        <TransferOwnershipCard firmId={firmId} />
      </div>

      {/* Support access */}
      <div className="mt-6">
        <SupportAccessCard firmId={firmId} />
      </div>

      {view.isSuperAdmin && (
        <div className="mt-6">
          <Link
            to="/admin/firms/$firmId"
            params={{ firmId }}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View audit log (Super Admin) <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

    </main>
  );
}
