import { createFileRoute } from "@tanstack/react-router";
import { readFileSync } from "fs";
import { join } from "path";

const ALLOWED = new Set([
  "README.md",
  "access-control.md",
  "data-hosting.md",
  "data-retention.md",
  "incident-response.md",
  "monitoring.md",
  "sdlc.md",
  "vulnerability-management.md",
  "xero-assessment-mapping.md",
]);

export const Route = createFileRoute("/api/public/docs/security/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const file = params.file;
        if (!ALLOWED.has(file)) return new Response("Not found", { status: 404 });
        try {
          const buf = readFileSync(join(process.cwd(), "docs", "security", file), "utf8");
          return new Response(buf, {
            headers: {
              "Content-Type": "text/markdown; charset=utf-8",
              "Cache-Control": "public, max-age=300",
            },
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
