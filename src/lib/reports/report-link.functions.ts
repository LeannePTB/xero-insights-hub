// Thin wrapper: PUBLIC, unauthenticated endpoints for a recipient-bound report
// link. There is deliberately no Supabase auth middleware — the token IS the
// credential, and it reaches exactly one report.
//
// Every failure returns the same generic message; both endpoints are rate
// limited by IP (and the open endpoint additionally by token).
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

function callerIp(): string | null {
  return (
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

export const describeReportLink = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const { describeLink } = await import("./report-delivery.server");
    return describeLink(String(data.token ?? ""), callerIp());
  });

export const openReportLink = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; email: string }) => input)
  .handler(async ({ data }) => {
    const { openLink } = await import("./report-delivery.server");
    return openLink(
      String(data.token ?? ""),
      String(data.email ?? ""),
      callerIp(),
      getRequestHeader("user-agent") ?? null,
    );
  });
