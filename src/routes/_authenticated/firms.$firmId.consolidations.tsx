import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Building2, Layers, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getConsolidationsAccess } from "@/lib/consolidations.functions";

export const Route = createFileRoute("/_authenticated/firms/$firmId/consolidations")({
  head: () => ({
    meta: [
      { title: "Company consolidations — Traction Advisory" },
      {
        name: "description",
        content:
          "Consolidation tools spanning an organisation's clients, including inter-company loan reconciliation.",
      },
      { property: "og:title", content: "Company consolidations — Traction Advisory" },
      {
        property: "og:description",
        content: "Organisation-wide consolidation tools for Traction Advisory clients.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsolidationsPage,
});

/**
 * All consolidation tools for one organisation. Built as a list so further
 * tools can be added without redesigning the page.
 */
const TOOLS = [
  {
    key: "loan_consolidation",
    title: "Loan Consolidation",
    description: "Reconcile inter-company loan accounts across the organisation.",
    icon: Building2,
  },
] as const;

function ConsolidationsPage() {
  const { firmId } = Route.useParams();
  const fetchAccess = useServerFn(getConsolidationsAccess);

  // The gate lives on the server; this query only renders its answer.
  const accessQ = useQuery({
    queryKey: ["consolidations-access", firmId],
    queryFn: () => fetchAccess({ data: { firmId } }),
    retry: false,
  });

  const backButton = (
    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
      <Link to="/firms/$firmId" params={{ firmId }} search={{}}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to organisation
      </Link>
    </Button>
  );

  if (accessQ.isLoading) {
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-6xl place-items-center px-6 py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const access = accessQ.data;

  if (!access?.allowed) {
    const message =
      access?.message ??
      (accessQ.error as Error | null)?.message ??
      "Consolidation tools aren't available for this organisation.";
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        {backButton}
        <div className="mt-4 flex max-w-xl items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <h1 className="font-display text-lg font-semibold">Company consolidations</h1>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {backButton}

      <div className="flex items-center gap-2 text-muted-foreground">
        <Layers className="h-5 w-5" />
        <span className="text-xs font-semibold uppercase tracking-wider">
          {access.firmName ?? "Organisation"}
        </span>
      </div>
      <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
        Company consolidations
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Organisation-level tools that span this organisation's clients and their Xero files,
        rather than a single client dashboard.
      </p>

      <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Consolidation tools
      </p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {TOOLS.map((tool) => (
          <div
            key={tool.key}
            className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <tool.icon className="h-4 w-4 text-muted-foreground" /> {tool.title}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{tool.description}</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/firms/$firmId/loans" params={{ firmId }} search={{ group: undefined }}>
                  Open
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
