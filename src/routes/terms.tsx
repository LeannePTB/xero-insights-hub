import { createFileRoute, Link } from "@tanstack/react-router";

import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of service — Traction Advisory" },
      {
        name: "description",
        content:
          "The terms that apply when you use Traction Advisory: your subscription, your data, read-only Xero access, and fair use.",
      },
      { property: "og:title", content: "Terms of service — Traction Advisory" },
      {
        property: "og:description",
        content:
          "The terms that apply when you use Traction Advisory: your subscription, your data, read-only Xero access, and fair use.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
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

function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col items-center p-6 py-12">
      <div className="w-full max-w-2xl">
        <BrandMark logoHeightClass="h-9" />
        <h1 className="mt-8 font-display text-lg font-semibold">Terms of service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated 13 October 2026.</p>

        <Section title="The service">
          <p>
            Traction Advisory is a reporting dashboard operated by Positive Traction
            Bookkeeping. It reads accounting and payroll information from Xero files you
            authorise, and presents dashboards, reports and insights to the people you allow.
          </p>
          <p>
            Access to Xero is <span className="text-foreground">read-only</span>. The service
            cannot create, change or delete anything in your Xero file.
          </p>
        </Section>

        <Section title="Your account">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              You must keep your sign-in details and second factor private, and tell us promptly
              if you think someone else has access.
            </li>
            <li>
              You are responsible for who you invite. Viewers and business owners you add can
              see the clients you select for them, read-only.
            </li>
            <li>
              Support access is read-only, time-limited to 72 hours, and only starts with the
              organisation owner's approval.
            </li>
          </ul>
        </Section>

        <Section title="Your data">
          <p>
            Your business's financial information remains yours. We use it only to provide the
            service to you and the people you authorise. Our{" "}
            <Link to="/privacy" className="text-foreground underline underline-offset-2">
              privacy policy
            </Link>{" "}
            explains where it is stored (including overseas hosting in Singapore) and who can
            see it.
          </p>
          <p>
            You can disconnect a Xero file at any time; disconnecting revokes our access at
            Xero immediately. When a client is removed, their stored figures, notes and
            settings are deleted.
          </p>
        </Section>

        <Section title="Subscription and payment">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Paid plans are billed in advance through our payment provider, Stripe. Prices are
              shown before you confirm.
            </li>
            <li>
              Trials, where offered, have a stated end date. When a trial ends, the features it
              unlocked stop unless the option has been purchased.
            </li>
            <li>
              You can cancel at any time; the service runs to the end of the paid period.
            </li>
          </ul>
        </Section>

        <Section title="Fair use">
          <p>
            Some features carry fair-use limits (for example, a monthly question allowance for
            the AI assistant). Limits are shown in the app. We may apply them to keep the
            service reliable for everyone.
          </p>
          <p>
            You must not use the service to access data you are not authorised to see, to probe
            or disrupt the service, or for anything unlawful.
          </p>
        </Section>

        <Section title="What we don't promise">
          <p>
            Figures shown in the service come from your Xero file and depend on it being
            connected, up to date and correctly coded. The service supports your decisions; it
            is not accounting, tax or financial advice, and it does not replace your adviser
            reviewing the underlying records.
          </p>
          <p>
            We aim for a reliable service but do not guarantee uninterrupted availability. To
            the extent the law allows, we are not liable for indirect losses arising from use
            of the service.
          </p>
        </Section>

        <Section title="Ending the service">
          <p>
            You can stop using the service at any time. We may suspend or end access where these
            terms are breached. On termination, your stored data is handled as described in the
            privacy policy.
          </p>
        </Section>

        <Section title="Changes and contact">
          <p>
            If we change these terms we will update the date at the top and, for significant
            changes, let you know by email. Questions:{" "}
            <a
              href="mailto:hello@tractionadvisory.com.au"
              className="font-medium text-foreground underline underline-offset-2"
            >
              hello@tractionadvisory.com.au
            </a>
            .
          </p>
        </Section>

        <div className="mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t pt-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Traction Advisory</span>
          <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy policy
          </Link>
          <Link to="/security" className="underline underline-offset-2 hover:text-foreground">
            Report a security issue
          </Link>
        </div>
      </div>
    </div>
  );
}
