import { createFileRoute } from "@tanstack/react-router";

import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/security")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reporting a security issue — Traction Advisory" },
      {
        name: "description",
        content:
          "How to report a security problem in Traction Advisory: email security@tractionadvisory.com.au. Acknowledged within two business days.",
      },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <BrandMark logoHeightClass="h-9" />
        <h1 className="mt-8 font-display text-2xl font-semibold">Reporting a security issue</h1>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            If you believe you have found a security problem in Traction Advisory, email{" "}
            <a
              href="mailto:security@tractionadvisory.com.au"
              className="font-medium text-foreground underline underline-offset-2"
            >
              security@tractionadvisory.com.au
            </a>
            . Please include enough detail for us to reproduce it. We will acknowledge your
            report within two business days and keep you informed while we investigate.
          </p>
          <p>
            Please do not access, change or download other people's data while testing, and
            give us a reasonable opportunity to fix the issue before disclosing it publicly.
            We do not currently offer a paid bounty.
          </p>
          <p>
            Traction Advisory is a small practice. Reports are read by the whole team during
            business hours — there is no 24/7 security desk.
          </p>
          <p>
            Security researchers can also find these details in our{" "}
            <a
              href="/.well-known/security.txt"
              className="text-foreground underline underline-offset-2"
            >
              security.txt
            </a>
            .
          </p>
        </div>
        <p className="mt-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Traction Advisory
        </p>
      </div>
    </div>
  );
}
