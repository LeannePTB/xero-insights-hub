import { createFileRoute } from "@tanstack/react-router";
import readme from "@/../docs/security/README.md?raw";
import accessControl from "@/../docs/security/access-control.md?raw";
import dataHosting from "@/../docs/security/data-hosting.md?raw";
import dataRetention from "@/../docs/security/data-retention.md?raw";
import incidentResponse from "@/../docs/security/incident-response.md?raw";
import monitoring from "@/../docs/security/monitoring.md?raw";
import sdlc from "@/../docs/security/sdlc.md?raw";
import vulnerabilityManagement from "@/../docs/security/vulnerability-management.md?raw";
import xeroAssessmentMapping from "@/../docs/security/xero-assessment-mapping.md?raw";

const DOCS: Record<string, string> = {
  "README.md": readme,
  "access-control.md": accessControl,
  "data-hosting.md": dataHosting,
  "data-retention.md": dataRetention,
  "incident-response.md": incidentResponse,
  "monitoring.md": monitoring,
  "sdlc.md": sdlc,
  "vulnerability-management.md": vulnerabilityManagement,
  "xero-assessment-mapping.md": xeroAssessmentMapping,
};

export const Route = createFileRoute("/api/public/docs/security/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const body = DOCS[params.file];
        if (!body) return new Response("Not found", { status: 404 });
        return new Response(body, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
