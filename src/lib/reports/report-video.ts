// Client-safe helpers for the optional personal video on a monthly report.
//
// The video lives in `client_reports` columns, deliberately OUTSIDE the frozen
// `payload`. The PDF is rendered from the payload alone, so the video can never
// reach it, and adding it bumps no payload version.

export const DEFAULT_VIDEO_HEADING = "A message from your adviser";

/**
 * The Loom video id from a share or embed URL, or null.
 *
 * Only loom.com (and subdomains) are accepted, so the embed src we build is
 * always a Loom URL and never attacker-chosen.
 */
export function parseLoomId(url: string | null | undefined): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  const host = parsed.hostname.toLowerCase();
  if (host !== "loom.com" && !host.endsWith(".loom.com")) return null;
  const m = parsed.pathname.match(/^\/(?:share|embed)\/([A-Za-z0-9]{16,64})\/?$/);
  return m ? m[1] : null;
}

export type ReportVideo = {
  url: string;
  heading?: string | null;
  message?: string | null;
};

/** The video to render for a report row, or null when there is nothing to show. */
export function reportVideoFrom(row: any): ReportVideo | null {
  const url = (row?.video_url as string | null) ?? null;
  if (!url || !parseLoomId(url)) return null;
  return {
    url,
    heading: (row?.video_heading as string | null) ?? null,
    message: (row?.video_message as string | null) ?? null,
  };
}

export const VIDEO_HEADING_MAX = 120;
export const VIDEO_MESSAGE_MAX = 600;
