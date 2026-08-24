import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldAlert, Download } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MonthlyReportPreview } from "@/components/reports/MonthlyReportPreview";
import { describeReportLink, openReportLink } from "@/lib/reports/report-link.functions";

export const Route = createFileRoute("/report/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "View your management report — Traction Advisory" },
      {
        name: "description",
        content:
          "Open the management report shared with you. The link is personal and expires; confirm your email address to view it.",
      },
      { property: "og:title", content: "View your management report — Traction Advisory" },
      {
        property: "og:description",
        content: "A private, recipient-bound link to a monthly management report.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReportLinkPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center px-6 py-4">
          <BrandMark />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}

function Invalid({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
      <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
      <h1 className="mt-3 font-display text-xl font-semibold">{message}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ask whoever sent it to share a new link.
      </p>
    </div>
  );
}

function ReportLinkPage() {
  const { token } = Route.useParams();
  const describeFn = useServerFn(describeReportLink);
  const openFn = useServerFn(openReportLink);
  const [email, setEmail] = useState("");

  const linkQ = useQuery({
    queryKey: ["report-link", token],
    queryFn: () => describeFn({ data: { token } }),
    retry: false,
  });

  const openMut = useMutation({
    mutationFn: () => openFn({ data: { token, email } }),
  });

  if (linkQ.isLoading) {
    return (
      <Shell>
        <p className="flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking your link…
        </p>
      </Shell>
    );
  }

  if (linkQ.error || !linkQ.data) {
    return (
      <Shell>
        <Invalid message={(linkQ.error as Error)?.message ?? "This link is no longer valid."} />
      </Shell>
    );
  }
  const link = linkQ.data;

  const opened = openMut.data;
  if (opened) {
    return (
      <Shell>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">{opened.report.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Version {opened.report.version} · shared with you privately.
            </p>
          </div>
          {opened.pdfUrl && (
            <Button asChild variant="outline">
              <a href={opened.pdfUrl} target="_blank" rel="noreferrer">
                <Download className="mr-2 h-4 w-4" /> Download PDF
              </a>
            </Button>
          )}
        </div>
        <MonthlyReportPreview
          payload={opened.report.payload as any}
          status={opened.report.status}
          version={opened.report.version}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8">
        <h1 className="font-display text-xl font-semibold">{linkQ.data.reportTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This link is personal. Confirm the email address it was sent to ({linkQ.data.emailHint})
          to open the report.
        </p>
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            openMut.mutate();
          }}
        >
          <div>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          {openMut.error && (
            <p className="text-sm text-destructive">{(openMut.error as Error).message}</p>
          )}
          <Button type="submit" className="w-full" disabled={openMut.isPending || !email}>
            {openMut.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening…
              </>
            ) : (
              "View report"
            )}
          </Button>
        </form>
      </div>
    </Shell>
  );
}
