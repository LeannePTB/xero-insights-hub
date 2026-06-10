import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { LineChart, ShieldCheck, Zap, HardHat } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Traction Advisory — Xero dashboards for builders & developers" },
      { name: "description", content: "Built for builders. Backed by numbers. Clean Xero dashboards for property developers, trades and construction clients — by Positive Traction." },
      { property: "og:title", content: "Traction Advisory" },
      { property: "og:description", content: "Built for builders. Backed by numbers." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Landing,
});

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 ${className}`}>
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-soft)]">
        <HardHat className="h-4.5 w-4.5" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Traction</div>
        <div className="-mt-0.5 text-[10px] font-semibold uppercase tracking-[0.32em] text-accent">Advisory</div>
      </div>
    </Link>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandMark />
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
            <Link to="/auth"><Button>Get started</Button></Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero — purple bar, gold accent rule per brand spec */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-1.5" style={{ background: "var(--gradient-gold)" }} />
          <div className="mx-auto max-w-6xl px-6 pt-24 pb-28 text-center text-primary-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Specialist advisory for builders & developers
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold tracking-tight md:text-6xl">
              Built for builders.
              <br />
              <span className="font-serif italic text-accent">Backed by numbers.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/80">
              Give every client a calm, branded Xero dashboard. Clear P&L, cash position and job-cost visibility — without the spreadsheet chaos.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link to="/auth"><Button size="lg" variant="secondary" className="font-semibold">Start free</Button></Link>
              <a href="#features"><Button size="lg" variant="outline" className="border-white/30 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">See features</Button></a>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-12 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-accent">What you get</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Clear numbers. Clean books. Confident decisions.</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: LineChart, title: "P&L at a glance", body: "Revenue, gross profit and net profit with trend lines, on any period you pick." },
              { icon: ShieldCheck, title: "Per-client Xero login", body: "Each client authorises their own Xero org. Tokens stay encrypted server-side." },
              { icon: Zap, title: "Composable widgets", body: "Add new dashboard widgets without touching the rest. Tailor the view per client." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-lg">
                <div className="grid h-11 w-11 place-items-center rounded-lg" style={{ background: "var(--gradient-gold)" }}>
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} Positive Traction · Traction Advisory</div>
          <div className="font-serif italic">Built for builders. Backed by numbers.</div>
        </div>
      </footer>
    </div>
  );
}
