import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BarChart3, LineChart, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ledgerlight — Xero dashboards for your clients" },
      { name: "description", content: "Give every client a clean, branded Xero dashboard. Multi-tenant, secure, and built for accountants." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <BarChart3 className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-semibold">Ledgerlight</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
            <Link to="/auth"><Button>Get started</Button></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pt-24 pb-20 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Built for accountants & bookkeepers
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
            Clear Xero dashboards for every client.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Each client connects their own Xero organisation in one click and sees a calm, customisable view of the numbers that matter.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth"><Button size="lg">Start free</Button></Link>
            <a href="#features"><Button size="lg" variant="outline">See features</Button></a>
          </div>
        </section>

        <section id="features" className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
          {[
            { icon: LineChart, title: "P&L at a glance", body: "Revenue, gross profit and net profit with trend lines, on any period you pick." },
            { icon: ShieldCheck, title: "Per-client OAuth", body: "Each client authorises their own Xero org. Tokens stay encrypted server-side." },
            { icon: Zap, title: "Composable widgets", body: "Add new dashboard widgets without touching the rest. Tailor the view per client." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Ledgerlight
      </footer>
    </div>
  );
}
