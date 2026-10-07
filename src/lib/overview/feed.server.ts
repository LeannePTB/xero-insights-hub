// "What changed — last 7 days": events only, computed on read from the same
// context as the overview. Zero Xero calls. Staff-only.

import { addDays, addMonths } from "@/lib/sydney-time";
import { BIG_MOVE, REPORT_NOT_SENT } from "./thresholds";
import { bucketOf, evaluateMove, nthBusinessDay, verdictRank } from "./changes";
import { moveFor, seriesFor, verdictFor, type FigureKey, type OverviewContext } from "./overview.server";

export type FeedEvent = {
  /** Stable per client: what Batch 4 acknowledges or snoozes. */
  eventKey: string;
  clientId: string;
  clientName: string;
  firmName: string;
  kind: "escalation" | "big_move" | "data" | "report";
  /** 0–4, higher is worse; used for ordering and for re-showing after acknowledgement. */
  severity: number;
  headline: string;
  before: string | null;
  after: string | null;
  date: string;
  /** Present when an acknowledgement or snooze hides this item. */
  cleared?: { how: "acknowledged" | "snoozed"; by: string; at: string; until?: string | null };
};

const FIGURE_LABEL: Partial<Record<FigureKey, string>> = {
  cash: "Cash at bank",
  protectedMoney: "Protected money",
  revenueMtd: "Month-to-date revenue",
};

function money(n: number | null): string {
  if (n === null) return "—";
  const s = `$${Math.abs(Math.round(n)).toLocaleString("en-AU")}`;
  return n < 0 ? `(${s})` : s;
}

export function buildFeed(ctx: OverviewContext): { events: FeedEvent[]; cleared: FeedEvent[]; notes: string[] } {
  const events: FeedEvent[] = [];
  const notes = new Set<string>();
  let kfShort = false;

  for (const c of ctx.clients) {
    const base = { clientId: c.client_id, clientName: c.client_name, firmName: c.firm_name };
    const now = verdictFor(ctx, c.client_id);
    const s = seriesFor(ctx, c.client_id);

    // Escalation: the verdict as at 7 days ago against now. Only a worsening counts.
    if (s.anchor) {
      const thenDate = addDays(s.anchor, -7);
      const then = verdictFor(ctx, c.client_id, thenDate);
      const rNow = verdictRank(now as any);
      const rThen = verdictRank(then as any);
      const thenAssessable = bucketOf(then as any) !== "cant_assess";
      if (thenAssessable && now.state === "issues" && rNow > rThen) {
        events.push({
          ...base,
          eventKey: `escalation:${(now as any).severity}`,
          kind: "escalation",
          severity: rNow,
          headline: `Status worsened: ${now.label}`,
          before: then.label,
          after: now.label,
          date: s.anchor,
        });
      }
      if (!thenAssessable) notes.add("Some clients had no assessable snapshot 7 days ago, so escalations could not be checked for them.");
    }

    // Big moves over 1 and 7 days.
    for (const key of Object.keys(FIGURE_LABEL) as FigureKey[]) {
      for (const days of BIG_MOVE.windowsDays) {
        if (!s.anchor) continue;
        // Month-to-date revenue resets on the 1st: never compare across a month start.
        if (key === "revenueMtd" && addDays(s.anchor, -days).slice(0, 7) !== s.anchor.slice(0, 7)) continue;
        const m = moveFor(s, key, days);
        if (m.state !== "evaluated" || !m.big) continue;
        if (!m.routineTested) notes.add("Where there is less than a month of history, the 'same point last month' check was skipped.");
        const before = s.byDate.get(addDays(s.anchor, -days))?.[key] ?? null;
        const after = s.byDate.get(s.anchor)?.[key] ?? null;
        events.push({
          ...base,
          eventKey: `move:${key}:${days}d:${m.change < 0 ? "down" : "up"}`,
          kind: "big_move",
          severity: 2,
          headline: `${FIGURE_LABEL[key]} ${m.change < 0 ? "fell" : "rose"} ${money(Math.abs(m.change))} over ${days === 1 ? "1 day" : `${days} days`}${m.routineTested ? "" : " (no prior-month comparison available)"}`,
          before: money(before),
          after: money(after),
          date: s.anchor,
        });
      }
    }

    // Debtors and creditors moves, from the nightly key figures (Batch 3).
    const kf = new Map((ctx.keyFigures.get(c.client_id) ?? []).map((k: any) => [String(k.as_at), k]));
    const kAnchor = [ctx.today, addDays(ctx.today, -1)].find((d) => kf.has(d));
    const KF_LABEL = { debtors_total: "Debtors", debtors_overdue: "Debtors overdue", creditors: "Creditors" } as const;
    if (!kAnchor || !kf.has(addDays(kAnchor, -1))) kfShort = true;
    if (kAnchor) {
      for (const key of Object.keys(KF_LABEL) as (keyof typeof KF_LABEL)[]) {
        for (const days of BIG_MOVE.windowsDays) {
          const val = (d: string) => (kf.get(d)?.[key] == null ? null : Number(kf.get(d)[key]));
          const pm = addMonths(kAnchor, -1);
          const m = evaluateMove({ now: val(kAnchor), before: val(addDays(kAnchor, -days)), priorEnd: val(pm), priorStart: val(addDays(pm, -days)), avgMonthlyRevenue: s.avgMonthlyRevenue });
          if (m.state !== "evaluated" || !m.big) continue;
          events.push({
            ...base,
            eventKey: `move:${key}:${days}d:${m.change < 0 ? "down" : "up"}`,
            kind: "big_move",
            severity: 2,
            headline: `${KF_LABEL[key]} ${m.change < 0 ? "fell" : "rose"} ${money(Math.abs(m.change))} over ${days === 1 ? "1 day" : `${days} days`}${m.routineTested ? "" : " (no prior-month comparison available)"}`,
            before: money(val(addDays(kAnchor, -days))),
            after: money(val(kAnchor)),
            date: kAnchor,
          });
        }
      }
    }

    // Data events.
    const conns = ctx.connections.get(c.client_id) ?? [];
    if (conns.length && !conns.some((x) => x.status === "connected")) {
      events.push({ ...base, eventKey: "data:disconnected", kind: "data", severity: 1, headline: "Xero disconnected", before: "Connected", after: "Disconnected", date: ctx.today });
    }
    const failed = (ctx.runs.get(c.client_id) ?? [])
      .filter((r) => r.status === "failed" && r.started_at >= addDays(ctx.today, -7))
      .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))[0];
    if (failed) {
      events.push({ ...base, eventKey: `data:refresh_failed`, kind: "data", severity: 1, headline: "Overnight refresh failed", before: null, after: null, date: failed.started_at.slice(0, 10) });
    }
    if (now.state === "stale") {
      events.push({ ...base, eventKey: "data:stale", kind: "data", severity: 1, headline: "Snapshot out of date", before: null, after: now.detail, date: ctx.today });
    }

    // Monthly report not sent by the 15th business day.
    const due = nthBusinessDay(ctx.today, REPORT_NOT_SENT.businessDay);
    const prevMonth = addMonths(`${ctx.today.slice(0, 7)}-01`, -1).slice(0, 7);
    if (ctx.today > due && !ctx.sentMonths.get(c.client_id)?.has(prevMonth)) {
      events.push({ ...base, eventKey: `report:${prevMonth}`, kind: "report", severity: 1, headline: `Monthly report for ${prevMonth} not sent`, before: null, after: `Due by ${due}`, date: due });
    }
  }
  if (kfShort) notes.add("Debtors and creditors moves need daily history from the nightly key figures, which started on 8 October 2026. Some clients do not have enough yet.");
  events.sort((a, b) => b.severity - a.severity || (a.date < b.date ? 1 : -1));
  const { visible, cleared } = applyAlertStates(events, ctx);
  return { events: visible, cleared, notes: [...notes] };
}

/**
 * Shared acknowledge/snooze. An item stays hidden while it is acknowledged, or
 * snoozed and the snooze has not ended, AND its severity has not risen above
 * the severity recorded when it was cleared.
 */
export function applyAlertStates(events: FeedEvent[], ctx: Pick<OverviewContext, "alertStates" | "people" | "now">) {
  const visible: FeedEvent[] = [];
  const cleared: FeedEvent[] = [];
  for (const e of events) {
    const st = (ctx.alertStates.get(e.clientId) ?? []).find((x: any) => x.event_key === e.eventKey);
    const notWorse = st && e.severity <= Number(st.severity_at_ack ?? 0);
    const snoozed = st?.snoozed_until && new Date(st.snoozed_until) > ctx.now;
    if (st && notWorse && (st.acknowledged_at || snoozed)) {
      const how = st.acknowledged_at ? "acknowledged" : "snoozed";
      const by = (how === "acknowledged" ? st.acknowledged_by : st.snoozed_by) as string | null;
      cleared.push({
        ...e,
        cleared: {
          how,
          by: (by && ctx.people.get(by)) || "A colleague",
          at: (st.acknowledged_at ?? st.snoozed_until) as string,
          until: how === "snoozed" ? st.snoozed_until : null,
        },
      });
    } else visible.push(e);
  }
  return { visible, cleared };
}
