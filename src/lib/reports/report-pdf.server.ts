// Server-only: render the Monthly Management Report to PDF, store it in the
// private `client-reports` bucket and mint a short-lived signed URL.
//
// Invariants this file must hold (Access Control Spec §0):
//  - The report id from the request is a FILTER, never a GRANT. Access is
//    established by public.user_can_access_client (via
//    assertClientDataAccessForClient) plus platformStaffCanAccessFirm for
//    staff-only actions. A client viewer may only download a final or sent PDF.
//  - The PDF is rendered from the STORED payload. There is no Xero fetch here,
//    so the document and the stored figures can never disagree.
//  - A final or sent PDF is generated once and then served as-is.
//  - The bucket stays private; every download is a fresh short-lived signed URL
//    and nothing signed is ever persisted.
//  - Every download writes an audit_log row.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  SECTION_LABELS,
  renderableFailedSections,
  money,
  pct,
  pctMagnitude,
  resolveDisclaimer,
  type AgeingDetail,
  type MonthlyReportPayload,
} from "./monthly-report";

const BUCKET = "client-reports";
const SIGNED_URL_SECONDS = 300;

const PAGE = { w: 595.28, h: 841.89 };
const M = { left: 40, right: 40, top: 92, bottom: 52 };
import {
  judgeVariance,
  keyFigurePolarity,
  sectionPolarity,
  toneRgb,
} from "./variance-polarity";

// The PDF prints and may be photocopied, so a variance never relies on colour:
// an ASCII direction marker ("^" / "v") sits alongside the figure. Triangles
// are not in the standard PDF font encoding, hence the ASCII markers.
/** ASCII stand-in for the on-screen arrow, so direction survives greyscale. */
function marker(arrow: string) {
  if (arrow === "\u25B2") return "^ ";
  if (arrow === "\u25BC") return "v ";
  return "";
}

const INK = { text: [17, 24, 39], muted: [107, 114, 128], line: [226, 232, 240], bad: [185, 28, 28] };

const SPACING = {
  titleInner: 5, // extra breathing room between the title-block lines
  beforeSection: 18, // generous gap before every section heading
  afterSectionHeading: 8, // smaller gap between a heading and its content
};

type LogoImage = { data: Uint8Array; format: "PNG" | "JPEG"; w: number; h: number };

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return String(iso);
  }
}

/** Intrinsic size of a PNG/JPEG so the logo keeps its aspect ratio. */
function imageSize(bytes: Uint8Array): { format: "PNG" | "JPEG"; w: number; h: number } | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { format: "PNG", w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = bytes[i + 1];
      const len = dv.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { format: "JPEG", h: dv.getUint16(i + 5), w: dv.getUint16(i + 7) };
      }
      i += 2 + len;
    }
    return { format: "JPEG", w: 200, h: 60 };
  }
  return null;
}

async function loadLogo(path: string | null | undefined): Promise<LogoImage | null> {
  if (!path) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).storage.from(BUCKET).download(path);
    if (error || !data) return null;
    const bytes = new Uint8Array(await data.arrayBuffer());
    const size = imageSize(bytes);
    if (!size) return null;
    return { data: bytes, format: size.format, w: size.w, h: size.h };
  } catch {
    return null;
  }
}

function drawLogo(doc: jsPDF, logo: LogoImage, x: number, y: number, maxW: number, maxH: number) {
  const scale = Math.min(maxW / logo.w, maxH / logo.h);
  const w = logo.w * scale;
  const h = logo.h * scale;
  try {
    doc.addImage(logo.data, logo.format, x, y, w, h);
  } catch {
    /* a broken logo must never block the report */
  }
  return { w, h };
}

export type RenderInput = {
  payload: MonthlyReportPayload;
  status: string;
  version: number;
  title: string;
  orgLogo: LogoImage | null;
  clientLogo: LogoImage | null;
};

/** Deterministic render of the stored payload. No network, no Xero. */
export function renderMonthlyReportPdf(input: RenderInput): Uint8Array {
  const { payload, status, version } = input;
  const m = payload.meta;
  const isDraft = status !== "final" && status !== "sent";
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

  const drawHeader = () => {
    let textLeft = M.left;
    if (input.orgLogo) {
      const { w } = drawLogo(doc, input.orgLogo, M.left, 28, 110, 34);
      textLeft = M.left + w + 12;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK.text[0], INK.text[1], INK.text[2]);
    doc.text(m.organisationName, textLeft, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(INK.muted[0], INK.muted[1], INK.muted[2]);
    doc.text(`${m.clientName} · Monthly Management Report`, textLeft, 54);
    doc.text(`${m.monthLabel} · period ended ${fmtDate(m.periodEnd)}`, textLeft, 66);

    if (input.clientLogo) {
      const scale = Math.min(90 / input.clientLogo.w, 30 / input.clientLogo.h);
      const w = input.clientLogo.w * scale;
      drawLogo(doc, input.clientLogo, PAGE.w - M.right - w, 30, 90, 30);
    }
    doc.setDrawColor(INK.line[0], INK.line[1], INK.line[2]);
    doc.line(M.left, 76, PAGE.w - M.right, 76);
  };

  const drawFooter = (pageNo: number) => {
    doc.setDrawColor(INK.line[0], INK.line[1], INK.line[2]);
    doc.line(M.left, PAGE.h - 40, PAGE.w - M.right, PAGE.h - 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(INK.muted[0], INK.muted[1], INK.muted[2]);
    doc.text(
      `${m.clientName} · ${m.monthLabel} · generated ${fmtDate(m.generatedAt)} by Traction Advisory · Version ${version}`,
      M.left,
      PAGE.h - 28,
    );
    doc.text(`Page ${pageNo}`, PAGE.w - M.right, PAGE.h - 28, { align: "right" });
  };

  const drawWatermark = () => {
    if (!isDraft) return;
    doc.saveGraphicsState();
    // @ts-expect-error GState is provided by jsPDF at runtime.
    doc.setGState(new doc.GState({ opacity: 0.12 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(96);
    doc.setTextColor(185, 28, 28);
    doc.text("DRAFT", PAGE.w / 2, PAGE.h / 2, { align: "center", angle: 32 });
    doc.restoreGraphicsState();
  };

  // Cursor helpers -----------------------------------------------------------
  let y = M.top;
  let page = 1;
  drawHeader();

  const newPage = () => {
    drawFooter(page);
    drawWatermark();
    doc.addPage();
    page += 1;
    drawHeader();
    y = M.top;
  };

  const need = (h: number) => {
    if (y + h > PAGE.h - M.bottom) newPage();
  };

  const heading = (text: string) => {
    // Reserve space for the pre-heading gap, the heading itself, the post-heading
    // gap and at least the first row of content so the heading is never orphaned.
    need(SPACING.beforeSection + 14 + SPACING.afterSectionHeading + 14);
    y += SPACING.beforeSection;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(INK.text[0], INK.text[1], INK.text[2]);
    doc.text(text, M.left, y);
    y += 14 + SPACING.afterSectionHeading;
  };

  const paragraph = (text: string, opts: { colour?: number[]; size?: number } = {}) => {
    const size = opts.size ?? 8.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const c = opts.colour ?? INK.muted;
    doc.setTextColor(c[0], c[1], c[2]);
    const lines = doc.splitTextToSize(text, PAGE.w - M.left - M.right);
    for (const line of lines) {
      need(size + 4);
      doc.text(line, M.left, y);
      y += size + 3;
    }
    y += 3;
  };

  const table = (opts: {
    head: string[];
    body: (string | number)[][];
    align?: Record<number, "left" | "right">;
    boldRows?: Set<number>;
    colWidths?: Record<number, number>;
    /** Per-cell text colour, keyed `row:col`. Used for variance judgement. */
    cellColours?: Record<string, [number, number, number]>;
  }) => {
    const columnStyles: Record<number, any> = {};
    opts.head.forEach((_, i) => {
      columnStyles[i] = {
        halign: opts.align?.[i] ?? (i === 0 ? "left" : "right"),
        ...(opts.colWidths?.[i] ? { cellWidth: opts.colWidths[i] } : {}),
      };
    });
    autoTable(doc, {
      head: [opts.head],
      body: opts.body as any,
      startY: y,
      margin: { left: M.left, right: M.right, top: M.top, bottom: M.bottom },
      tableWidth: PAGE.w - M.left - M.right,
      styles: {
        font: "helvetica",
        fontSize: 7.5,
        cellPadding: 3,
        overflow: "linebreak",
        textColor: INK.text as any,
        lineColor: INK.line as any,
        lineWidth: 0.4,
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: INK.muted as any,
        fontStyle: "bold",
        fontSize: 7,
      },
      columnStyles,
      // Headers repeat on every page break, and a row is never split.
      showHead: "everyPage",
      rowPageBreak: "avoid",
      didParseCell: (data: any) => {
        if (data.section === "body" && opts.boldRows?.has(data.row.index)) {
          data.cell.styles.fontStyle = "bold";
        }
        if (data.section === "body") {
          const c = opts.cellColours?.[`${data.row.index}:${data.column.index}`];
          if (c) data.cell.styles.textColor = c as any;
        }
      },
      willDrawPage: () => {
        // autoTable added the page itself; keep header/footer consistent.
        if ((doc as any).getCurrentPageInfo().pageNumber > page) {
          page = (doc as any).getCurrentPageInfo().pageNumber;
          drawHeader();
        }
      },
      didDrawPage: () => {
        drawFooter((doc as any).getCurrentPageInfo().pageNumber);
        drawWatermark();
      },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 16;
  };

  const missing = (message: string) => {
    paragraph(message, { colour: INK.bad });
    y += 10;
  };

  // Title block --------------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(INK.text[0], INK.text[1], INK.text[2]);
  doc.text("Monthly Management Report", M.left, y);
  y += 20 + SPACING.titleInner;
  paragraph(
    `${m.clientName} · ${m.tenantName} · ${m.monthLabel} (period ended ${fmtDate(m.periodEnd)})`,
  );
  y += SPACING.titleInner;
  paragraph(
    `Generated ${fmtDate(m.generatedAt)} by Traction Advisory · Version ${version} · ${status} · payload v${payload.payloadVersion} · amounts in ${m.currency}${
      isDraft ? " · DRAFT — not for distribution" : ""
    }`,
    { size: 8 },
  );
  // The first section heading supplies the generous gap after the title block.

  // Incomplete banner, prominently on page one --------------------------------
  const shownFailures = renderableFailedSections(payload);
  if (!payload.complete && shownFailures.length > 0) {
    need(60);
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(INK.bad[0], INK.bad[1], INK.bad[2]);
    const lines = shownFailures.map(
      (f) => `${SECTION_LABELS[f.section] ?? f.section}: ${f.message}`,
    );
    const wrapped = lines.flatMap((l) => doc.splitTextToSize(l, PAGE.w - M.left - M.right - 24));
    const boxH = 30 + wrapped.length * 11;
    need(boxH);
    doc.rect(M.left, y - 10, PAGE.w - M.left - M.right, boxH, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(INK.bad[0], INK.bad[1], INK.bad[2]);
    doc.text("This report is incomplete — sections below could not be computed.", M.left + 12, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    let ly = y + 20;
    for (const line of wrapped) {
      doc.text(line, M.left + 12, ly);
      ly += 11;
    }
    y = y + boxH + 8;
  }

  const failed = new Map(renderableFailedSections(payload).map((f) => [f.section, f.message]));

  // 2. Notes -----------------------------------------------------------------
  heading("Notes");
  if (!payload.notes) {
    missing(failed.get("notes") ?? "Not computed.");
  } else if (!payload.notes.length) {
    paragraph("No notes recorded for this client.");
  } else {
    const sorted = [...payload.notes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    for (const n of sorted) {
      paragraph(n.body, { colour: INK.text, size: 8.5 });
      paragraph(`${n.author} · ${fmtDate(n.createdAt)}`, { size: 7.5 });
      y += 4;
    }
  }

  // 3. Key figures -----------------------------------------------------------
  heading("Key figures");
  if (!payload.keyFigures) {
    missing(failed.get("key_figures") ?? "Not computed.");
  } else {
    const f = (k: any, n: number) => (k.unit === "money" ? money(n) : pct(n));
    const kfColours: Record<string, [number, number, number]> = {};
    payload.keyFigures.forEach((k, i) => {
      const pol = keyFigurePolarity(k.key);
      const jm = judgeVariance({
        variance: k.monthVariance,
        prior: k.priorMonth,
        polarity: pol,
        variancePct: k.monthVariancePct,
        unit: k.unit,
      });
      const jy = judgeVariance({
        variance: k.ytdVariance,
        prior: k.priorFyYtd,
        polarity: pol,
        variancePct: k.ytdVariancePct,
        unit: k.unit,
      });
      if (jm.tone !== "neutral") kfColours[`${i}:3`] = toneRgb(jm.tone);
      if (jy.tone !== "neutral") kfColours[`${i}:6`] = toneRgb(jy.tone);
    });
    table({
      head: [
        "Measure",
        m.monthLabel,
        "Prior month",
        "Change",
        `${m.fyLabel} YTD`,
        `${m.priorFyLabel} YTD`,
        "Change",
      ],
      body: payload.keyFigures.map((k) => {
        const jm = judgeVariance({
          variance: k.monthVariance,
          prior: k.priorMonth,
          polarity: keyFigurePolarity(k.key),
          variancePct: k.monthVariancePct,
          unit: k.unit,
        });
        const jy = judgeVariance({
          variance: k.ytdVariance,
          prior: k.priorFyYtd,
          polarity: keyFigurePolarity(k.key),
          variancePct: k.ytdVariancePct,
          unit: k.unit,
        });
        return [
          k.label,
          f(k, k.month),
          f(k, k.priorMonth),
          `${marker(jm.arrow)}${f(k, k.monthVariance)}${jm.showPct ? ` (${pctMagnitude(k.monthVariancePct)})` : ""}`,
          f(k, k.fyYtd),
          f(k, k.priorFyYtd),
          `${marker(jy.arrow)}${f(k, k.ytdVariance)}${jy.showPct ? ` (${pctMagnitude(k.ytdVariancePct)})` : ""}`,
        ];
      }),
      cellColours: kfColours,
    });
    for (const k of payload.keyFigures) {
      const j = judgeVariance({
        variance: k.monthVariance,
        prior: k.priorMonth,
        polarity: keyFigurePolarity(k.key),
        variancePct: k.monthVariancePct,
        unit: k.unit,
      });
      paragraph(`${marker(j.arrow)}${k.sentence}`, { colour: toneRgb(j.tone) });
    }
  }

  // 4. Profit and Loss -------------------------------------------------------
  heading("Profit and Loss");
  if (!payload.profitAndLoss) {
    missing(failed.get("profit_and_loss") ?? "Not computed.");
  } else {
    const p = payload.profitAndLoss;
    const bold = new Set<number>();
    p.lines.forEach((l, i) => l.isTotal && bold.add(i));
    const judged = p.lines.map((l) =>
      judgeVariance({
        variance: l.variance,
        prior: l.priorMonth,
        polarity: sectionPolarity(l.section),
        variancePct: l.variancePct,
      }),
    );
    const pnlColours: Record<string, [number, number, number]> = {};
    judged.forEach((j, i) => {
      if (j.tone === "neutral") return;
      pnlColours[`${i}:3`] = toneRgb(j.tone);
      if (j.showPct) pnlColours[`${i}:4`] = toneRgb(j.tone);
    });
    table({
      head: ["Account", p.monthLabel, p.priorMonthLabel, "Variance", "Variance %", p.fyLabel],
      body: p.lines.map((l, i) => [
        l.name,
        money(l.month, { cents: true }),
        money(l.priorMonth, { cents: true }),
        `${marker(judged[i].arrow)}${money(l.variance, { cents: true })}`,
        judged[i].showPct ? pct(l.variancePct) : "—",
        money(l.fyYtd, { cents: true }),
      ]),
      boldRows: bold,
      colWidths: { 0: 150 },
      cellColours: pnlColours,
    });
    table({
      head: ["Summary", "Amount"],
      body: [
        ["Revenue (sales)", money(p.totals.revenue)],
        ["Other income", money(p.totals.otherIncome)],
        ["Cost of sales", money(p.totals.costOfSales)],
        ["Gross Profit", money(p.totals.grossProfit)],
        ["Expenses (excl. cost of sales)", money(p.totals.expenses)],
        ["Net Profit/Loss", money(p.totals.netProfit)],
        ["Net margin", pct(p.totals.netMargin)],
      ],
    });
  }

  // 3 & 4. Ageing ------------------------------------------------------------
  const ageing = (detail: AgeingDetail | null, title: string, label: string, section: string) => {
    heading(title);
    if (!detail) {
      missing(failed.get(section) ?? "Not computed.");
      return;
    }
    const bold = new Set<number>([detail.rows.length]);
    table({
      head: [label, ...detail.bucketLabels, "Total", "% of total"],
      body: [
        ...detail.rows.map((r) => [
          r.name,
          ...r.buckets.map((v) => money(v, { cents: true })),
          money(r.total, { cents: true }),
          pct(r.pctOfTotal),
        ]),
        [
          "Total",
          ...detail.totals.map((v) => money(v, { cents: true })),
          money(detail.total, { cents: true }),
          pct(detail.total === 0 ? 0 : 100),
        ],
      ],
      boldRows: bold,
      colWidths: { 0: 130 },
    });
    paragraph(detail.caveat, { size: 7.5 });
  };
  ageing(payload.receivables, "Receivables detail", "Customer", "receivables");
  ageing(payload.payables, "Payables detail", "Supplier", "payables");

  // 5. Disclaimer — fine print, last, no forced page break -------------------
  need(SPACING.beforeSection + 11 + SPACING.afterSectionHeading + 12);
  y += SPACING.beforeSection;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(INK.muted[0], INK.muted[1], INK.muted[2]);
  doc.text("Disclaimer", M.left, y);
  y += 11 + SPACING.afterSectionHeading;
  paragraph(resolveDisclaimer(payload), { size: 7.5 });

  drawFooter((doc as any).getCurrentPageInfo().pageNumber);
  drawWatermark();

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// Storage + access
// ---------------------------------------------------------------------------

function pdfObjectPath(r: { client_id: string; id: string; period_end: string; version: number }) {
  return `${r.client_id}/${r.id}/monthly-management-${r.period_end}-v${r.version}.pdf`;
}

type ReportRow = {
  id: string;
  client_id: string;
  firm_id: string;
  period_end: string;
  version: number;
  status: string;
  title: string | null;
  payload: MonthlyReportPayload;
  pdf_path: string | null;
};

/**
 * Build (or reuse) the PDF for a report and return a short-lived signed URL.
 * `isStaff` decides whether a draft may be rendered at all.
 */
export async function getReportPdfUrl(opts: {
  supabase: any;
  userId: string;
  reportId: string;
  /** Force a fresh render of a DRAFT. Ignored for final/sent. */
  regenerate?: boolean;
}): Promise<{ url: string; path: string; status: string; regenerated: boolean }> {
  const { data, error } = await opts.supabase
    .from("client_reports")
    .select("id, client_id, firm_id, period_end, version, status, title, payload, pdf_path")
    .eq("id", opts.reportId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Report not found.");
  const report = data as ReportRow;

  const { assertClientDataAccessForClient, platformStaffCanAccessFirm } = await import(
    "@/lib/support-access.server"
  );
  await assertClientDataAccessForClient(opts.userId, report.client_id);
  const isStaff = await platformStaffCanAccessFirm(opts.userId, report.firm_id);
  const isFinal = report.status === "final" || report.status === "sent";
  if (!isStaff && !isFinal) {
    throw new Error("This report is still a draft, so it is not available to download yet.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let path = report.pdf_path;
  let regenerated = false;

  // A final or sent PDF is generated once and never regenerated.
  const mustRender = !path || (!isFinal && (opts.regenerate ?? false));
  if (mustRender) {
    if (!isStaff) throw new Error("Ask your adviser to prepare this report for download.");
    const built = await buildAndStoreReportPdf(report);
    path = built.path;
    regenerated = true;
  }

  const { data: signed, error: signErr } = await (supabaseAdmin as any).storage
    .from(BUCKET)
    .createSignedUrl(path!, SIGNED_URL_SECONDS);
  if (signErr || !signed?.signedUrl) {
    throw new Error(signErr?.message ?? "Could not prepare the download link.");
  }

  const { writeAudit } = await import("@/lib/audit.server");
  await writeAudit({
    actorUserId: opts.userId,
    firmId: report.firm_id,
    action: "client_report_pdf_downloaded",
    targetType: "client_reports",
    targetId: report.id,
    meta: {
      client_id: report.client_id,
      period_end: report.period_end,
      version: report.version,
      status: report.status,
      pdf_path: path,
      regenerated,
      via: "dashboard",
    },
  });

  return { url: signed.signedUrl, path: path!, status: report.status, regenerated };
}

/**
 * Render the stored payload and upload it. Callers MUST have authorised the
 * actor first — this helper performs no access check of its own.
 */
export async function buildAndStoreReportPdf(report: ReportRow): Promise<{ path: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: firm }, { data: client }] = await Promise.all([
    (supabaseAdmin as any).from("firms").select("logo_path").eq("id", report.firm_id).maybeSingle(),
    (supabaseAdmin as any).from("clients").select("logo_path").eq("id", report.client_id).maybeSingle(),
  ]);
  const [orgLogo, clientLogo] = await Promise.all([
    loadLogo((firm as any)?.logo_path ?? null),
    loadLogo((client as any)?.logo_path ?? null),
  ]);

  const bytes = renderMonthlyReportPdf({
    payload: report.payload,
    status: report.status,
    version: report.version,
    title: report.title ?? "Monthly Management Report",
    orgLogo,
    clientLogo,
  });

  const path = pdfObjectPath(report);
  const { error: upErr } = await (supabaseAdmin as any).storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(upErr.message);

  const { error: setErr } = await (supabaseAdmin as any)
    .from("client_reports")
    .update({ pdf_path: path })
    .eq("id", report.id);
  if (setErr) throw new Error(setErr.message);

  return { path };
}

/** Called at finalisation so a sent report always has an immutable PDF. */
export async function ensureFinalReportPdf(reportId: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("client_reports")
      .select("id, client_id, firm_id, period_end, version, status, title, payload, pdf_path")
      .eq("id", reportId)
      .maybeSingle();
    if (!data) return null;
    const row = data as ReportRow;
    // Any PDF stored while the report was a draft carries a DRAFT watermark, so
    // finalisation always renders once more — and only once.
    const built = await buildAndStoreReportPdf(row);
    return built.path;
  } catch (e) {
    console.warn("[report-pdf] finalise render failed", e);
    return null;
  }
}
