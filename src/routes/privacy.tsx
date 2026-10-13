import { createFileRoute, Link } from "@tanstack/react-router";

import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — Traction Advisory" },
      {
        name: "description",
        content:
          "How Traction Advisory collects, stores and protects your information, including where your data is hosted and who can see it.",
      },
      { property: "og:title", content: "Privacy policy — Traction Advisory" },
      {
        property: "og:description",
        content:
          "How Traction Advisory collects, stores and protects your information, including where your data is hosted and who can see it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col items-center p-6 py-12">
      <div className="w-full max-w-2xl">
        <BrandMark logoHeightClass="h-9" />
        <h1 className="mt-8 font-display text-lg font-semibold">Privacy policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated 13 October 2026.</p>

        <Section title="Who we are">
          <p>
            Traction Advisory is operated by Positive Traction Bookkeeping, an Australian
            bookkeeping practice. This policy explains what information we hold, why, where it
            is stored, and who can see it.
          </p>
          <p>
            Questions about this policy or your information:{" "}
            <a
              href="mailto:privacy@tractionadvisory.com.au"
              className="font-medium text-foreground underline underline-offset-2"
            >
              privacy@tractionadvisory.com.au
            </a>
            .
          </p>
        </Section>

        <Section title="What we hold">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="text-foreground">Account details</span> — your name, email
              address and sign-in credentials (including a second factor), so you can sign in
              securely.
            </li>
            <li>
              <span className="text-foreground">Business financial information</span> — when a
              Xero file is connected, we read accounting and (where payroll is enabled) payroll
              information from Xero to show dashboards and reports. Our access to Xero is
              read-only; we cannot change anything in your Xero file.
            </li>
            <li>
              <span className="text-foreground">Notes and settings</span> — classifications,
              comments and preferences you enter in the app.
            </li>
            <li>
              <span className="text-foreground">Billing details</span> — handled by our payment
              provider, Stripe. We never see or store your card number.
            </li>
          </ul>
        </Section>

        <Section title="Overseas storage and disclosure">
          <p>
            Traction Advisory is delivered using cloud infrastructure located outside Australia.
            Specifically:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Your data — including your Xero accounting data, and payroll information where a
              payroll-enabled Xero file is connected — is stored in a database hosted by
              Supabase in <span className="text-foreground">Singapore</span>.
            </li>
            <li>The service is delivered through Cloudflare's global network.</li>
            <li>Where you use our billing features, payment details are handled by Stripe.</li>
            <li>Emails we send you are delivered through our email provider.</li>
          </ul>
          <p>
            These providers store and process information on our behalf. They do not use your
            accounting data for their own purposes.
          </p>
          <p>
            Your information is encrypted while it travels and while it is stored. Access to
            your Xero data requires a second factor at sign-in, and is limited to people you
            have authorised: our bookkeeping team while we work with you, anyone you invite to
            view your business, and — only with your specific approval and for a maximum of 72
            hours — read-only support access. Every time someone views your figures, we record
            who, when and what kind of information, and keep that record for two years.
          </p>
          <p>
            We remain accountable for your information wherever it is held. If you would prefer
            your data to be stored in Australia, please talk to us before connecting your Xero
            file, as this is not something we can change once your account is set up.
          </p>
        </Section>

        <Section title="Who can see your information">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="text-foreground">Your organisation's members</span> — the people
              in your practice or business who have been given access.
            </li>
            <li>
              <span className="text-foreground">Viewers you invite</span> — read-only, only for
              the clients you choose, and only while the invitation stands.
            </li>
            <li>
              <span className="text-foreground">Support access</span> — a named person,
              read-only, for at most 72 hours, and only with the organisation owner's approval.
            </li>
            <li>
              <span className="text-foreground">Platform administrators</span> — can see account
              and billing metadata to run the service, but cannot see your clients' financial
              figures.
            </li>
          </ul>
          <p>
            We do not sell your information, and we do not share it with anyone else except the
            providers listed above, or where the law requires it.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            While your account is active we keep your information so the service works. Security
            and access records are kept for two years. When a client is removed, their stored
            figures, notes and settings are deleted with them; the record that access happened
            (never the figures themselves) is kept for the audit period.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can ask us what information we hold about you, ask us to correct it, or ask us
            to delete it. You can disconnect a Xero file at any time from the app's settings —
            disconnecting revokes our access at Xero immediately.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we change this policy we will update the date at the top and, for significant
            changes, let you know by email.
          </p>
        </Section>

        <div className="mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t pt-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Traction Advisory</span>
          <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms of service
          </Link>
          <Link to="/security" className="underline underline-offset-2 hover:text-foreground">
            Report a security issue
          </Link>
        </div>
      </div>
    </div>
  );
}
