import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, BarChart3, ShieldCheck, Zap, Building2, HardHat, HomeIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Traction Advisory — Clean Xero dashboards for builders & developers" },
      { name: "description", content: "Built for builders. Backed by numbers. Live Xero dashboards for property developers, trades and construction businesses — by Positive Traction." },
      { property: "og:title", content: "Traction Advisory — Xero dashboards by Positive Traction" },
      { property: "og:description", content: "Built for builders. Backed by numbers. Live Xero dashboards for property developers, trades and construction businesses." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Hero />
      <BuiltFor />
      <Features />
      <Pricing />
      <CtaBand />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <BrandMark />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#built-for" className="hover:text-foreground">Who it's for</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <a href="mailto:admin@positivetraction.com.au?subject=Traction%20Advisory%20demo">
            <Button size="sm">Book a demo</Button>
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-90"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-background/10" />
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-20 text-primary-foreground md:pt-28">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.32em] text-accent">
          Built for builders. Backed by numbers.
        </p>
        <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight md:text-6xl">
          The Xero dashboard your tradies, developers and builders actually open.
        </h1>
        <p className="mt-6 max-w-2xl text-base text-primary-foreground/85 md:text-lg">
          Traction Advisory turns your Xero file into clear, live dashboards — revenue,
          tax owed, P&amp;L, breakeven, payables and receivables — without the spreadsheet wrangling.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/auth">
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              Start free trial <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <a href="#features">
            <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
              See what's inside
            </Button>
          </a>
        </div>
        <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-primary-foreground/80">
          {["7-day free trial", "No credit card required", "Connect Xero in 60 seconds"].map((t) => (
            <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" />{t}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function BuiltFor() {
  const items = [
    { icon: HardHat, title: "Trades & subbies", body: "Know what's owed, what's owing, and what's actually profitable — without chasing your bookkeeper." },
    { icon: Building2, title: "Property developers", body: "Multi-entity Xero files rolled into one view. Track project P&L, GST and BAS in real time." },
    { icon: HomeIcon, title: "Builders & construction", body: "Aged receivables, breakeven and tax liabilities at a glance. Make decisions on Tuesday, not at quarter-end." },
  ];
  return (
    <section id="built-for" className="mx-auto max-w-6xl px-5 py-20">
      <h2 className="font-display text-3xl font-semibold md:text-4xl">Built for the way you actually run a build.</h2>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        We're Positive Traction, advisors to property developers, trades and construction
        businesses across Australia. We built this because our own clients needed it.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {items.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <Icon className="h-7 w-7 text-primary" />
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const features = [
    { icon: BarChart3, title: "Live Xero dashboards", body: "Revenue & expense KPIs, full P&L, breakeven analysis, aged payables and receivables — all sourced live from Xero." },
    { icon: ShieldCheck, title: "Tax & super at a glance", body: "Know your GST, PAYG and super liabilities before BAS time. No more nasty surprises." },
    { icon: Zap, title: "Connect in 60 seconds", body: "Secure OAuth straight into Xero. Add more organisations as you grow. Read-only by default." },
  ];
  return (
    <section id="features" className="bg-secondary/40 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">Numbers that actually mean something.</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Designed by accountants who got tired of explaining the same reports.
          Now your clients (or your own ops team) can self-serve the answers.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <Icon className="h-7 w-7" style={{ color: "var(--lavender)" }} />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    { name: "Starter", price: "$49", suffix: "/mo", features: ["Up to 5 Xero files", "Core dashboards", "Email support"], cta: "Start free trial" },
    { name: "Growth", price: "$99", suffix: "/mo", highlight: true, features: ["Up to 10 Xero files", "All dashboards", "Multi-entity rollups", "Priority support"], cta: "Start free trial" },
    { name: "Organisation", price: "Let's talk", suffix: "", features: ["50+ Xero files", "White-glove onboarding", "Dedicated advisor"], cta: "Contact us" },
  ];
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-20">
      <h2 className="font-display text-3xl font-semibold md:text-4xl">Simple pricing. 7-day free trial.</h2>
      <p className="mt-3 max-w-2xl text-muted-foreground">No credit card to start. Cancel anytime.</p>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`relative rounded-2xl border bg-card p-6 shadow-soft ${
              t.highlight ? "border-primary ring-2 ring-primary/20" : "border-border"
            }`}
          >
            {t.highlight && (
              <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-accent-foreground">
                Most popular
              </span>
            )}
            <h3 className="text-lg font-semibold">{t.name}</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-4xl font-semibold">{t.price}</span>
              <span className="text-sm text-muted-foreground">{t.suffix}</span>
            </div>
            <ul className="mt-5 space-y-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {t.name === "Organisation" ? (
                <a href="mailto:admin@positivetraction.com.au?subject=Traction%20Advisory%20Organisation%20plan">
                  <Button variant="outline" className="w-full">{t.cta}</Button>
                </a>
              ) : (
                <Link to="/auth">
                  <Button className="w-full">{t.cta}</Button>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="px-5 py-16">
      <div
        className="mx-auto max-w-6xl overflow-hidden rounded-3xl p-10 text-primary-foreground md:p-14"
        style={{ background: "var(--gradient-hero)" }}
      >
        <h2 className="font-display text-3xl font-semibold md:text-4xl">Ready to see your numbers clearly?</h2>
        <p className="mt-3 max-w-xl text-primary-foreground/85">
          Start a 7-day free trial. Connect Xero in under a minute.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/auth">
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              Start free trial <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <a href="mailto:admin@positivetraction.com.au?subject=Traction%20Advisory%20demo">
            <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
              Book a demo
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 text-sm text-muted-foreground md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <BrandMark logoHeightClass="h-8" />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a href="mailto:admin@positivetraction.com.au" className="hover:text-foreground">admin@positivetraction.com.au</a>
          <Link to="/auth" className="hover:text-foreground">Sign in</Link>
          <span>© {new Date().getFullYear()} Positive Traction</span>
        </div>
      </div>
    </footer>
  );
}
