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
  namesEqual,
  uniqueNames,
  type AgeingDetail,
  type MonthlyReportPayload,
} from "./monthly-report";

import logoWhiteUrl from "@/assets/traction-advisory-logo-white.png?inline";

/** Intrinsic pixel size of the white wordmark, so it keeps its aspect ratio. */
const LOGO_WHITE = { w: 600, h: 69 };

const BUCKET = "client-reports";
const SIGNED_URL_SECONDS = 300;

const PAGE = { w: 595.28, h: 841.89 };
const M = { left: 40, right: 40, top: 96, bottom: 56 };

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

// Fixed Traction Advisory palette. These are the app's own theme tokens
// converted to sRGB — --primary (#53318D), --lavender (#6F60AA) and
// --accent (#C5AB71). Branding is never read from the organisation record.
const BRAND = {
  purple: [83, 49, 141], // --primary
  lavender: [111, 96, 170], // --lavender
  lavenderFill: [237, 234, 246], // light tint of --lavender, table header fill
  band: [246, 245, 250], // very light row banding
  gold: [197, 171, 113], // --accent, thin rules only — never text
  watermark: [203, 200, 214],
};

const SPACING = {
  titleInner: 5, // extra breathing room between the title-block lines
  // Headings now carry their own hierarchy (colour, size, gold rule), so the
  // pre-heading gap no longer has to do that work on its own.
  beforeSection: 14,
  afterSectionHeading: 9, // heading rule to first row of content
};




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

// Branding is fixed: the Traction Advisory wordmark, in Positive Traction's
// colours, on every report. Organisation and client logos are deliberately not
// drawn — this is a single-brand document, not a white-labelled one.


export type RenderInput = {
  payload: MonthlyReportPayload;
  status: string;
  version: number;
  title: string;
};

/** Deterministic render of the stored payload. No network, no Xero. */
export function renderMonthlyReportPdf(input: RenderInput): Uint8Array {
  const { payload, status, version } = input;
  const m = payload.meta;
  const isDraft = status !== "final" && status !== "sent";
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

  const BAND_H = 62;

  /**
   * Deep purple band across the top of every page: Traction Advisory wordmark
   * on the left, the document's identity on the right in white. Drawn in a
   * single decoration pass once the content is laid out.
   */
  const drawHeaderBand = () => {
    doc.setFillColor(BRAND.purple[0], BRAND.purple[1], BRAND.purple[2]);
    doc.rect(0, 0, PAGE.w, BAND_H, "F");
    // Thin gold rule closes the band off.
    doc.setDrawColor(BRAND.gold[0], BRAND.gold[1], BRAND.gold[2]);
    doc.setLineWidth(1.2);
    doc.line(0, BAND_H, PAGE.w, BAND_H);
    doc.setLineWidth(0.4);

    const logoW = 132;
    const logoH = (LOGO_WHITE.h / LOGO_WHITE.w) * logoW;
    let drewLogo = false;
    try {
      doc.addImage(logoWhiteUrl, "PNG", M.left, (BAND_H - logoH) / 2, logoW, logoH);
      drewLogo = true;
    } catch {
      /* fall back to a typographic wordmark below */
    }
    if (!drewLogo) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(255, 255, 255);
      doc.text("Traction Advisory", M.left, BAND_H / 2 + 5);
    }

    const right = PAGE.w - M.right;
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(m.clientName, right, 24, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("Monthly Management Report", right, 36, { align: "right" });
    doc.text(`${m.monthLabel} · period ended ${fmtDate(m.periodEnd)}`, right, 47, { align: "right" });
  };

  const drawFooter = (pageNo: number, pageCount: number) => {
    doc.setDrawColor(INK.line[0], INK.line[1], INK.line[2]);
    doc.setLineWidth(0.4);
    doc.line(M.left, PAGE.h - 40, PAGE.w - M.right, PAGE.h - 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(INK.muted[0], INK.muted[1], INK.muted[2]);
    doc.text(
      `${m.clientName} · ${m.monthLabel} · generated ${fmtDate(m.generatedAt)} by Traction Advisory · Version ${version}`,
      M.left,
      PAGE.h - 28,
    );
    doc.text(`Page ${pageNo} of ${pageCount}`, PAGE.w - M.right, PAGE.h - 28, { align: "right" });
  };

  /**
   * Drawn as the FIRST thing on a page, before any content, so it genuinely
   * sits behind the tables rather than obscuring them.
   */
  const watermarked = new Set<number>();
  const drawWatermark = () => {
    if (!isDraft) return;
    const pageNo = (doc as any).getCurrentPageInfo().pageNumber;
    if (watermarked.has(pageNo)) return; // exactly one watermark per page
    watermarked.add(pageNo);
    doc.saveGraphicsState();
    // @ts-expect-error GState is provided by jsPDF at runtime.
    doc.setGState(new doc.GState({ opacity: 0.18 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(120);
    doc.setTextColor(BRAND.watermark[0], BRAND.watermark[1], BRAND.watermark[2]);
    doc.text("DRAFT", PAGE.w / 2, PAGE.h / 2 + 40, { align: "center", angle: 34 });
    doc.restoreGraphicsState();
  };


  // Cursor helpers -----------------------------------------------------------
  // Page chrome (band + footer) is applied ONCE per page in a decoration pass
  // at the end, so it can never be drawn twice — the previous version called
  // drawFooter from newPage AND from every table's didDrawPage.
  let y = M.top;
  drawWatermark();

  const newPage = () => {
    doc.addPage();
    drawWatermark();
    y = M.top;
  };

  const need = (h: number) => {
    if (y + h > PAGE.h - M.bottom) newPage();
  };

  const heading = (text: string) => {
    // Reserve space for the pre-heading gap, the heading, its gold rule, the
    // post-heading gap and at least the first row of content.
    need(SPACING.beforeSection + 16 + SPACING.afterSectionHeading + 14);
    y += SPACING.beforeSection;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13.5);
    doc.setTextColor(BRAND.purple[0], BRAND.purple[1], BRAND.purple[2]);
    doc.text(text, M.left, y);
    y += 5;
    doc.setDrawColor(BRAND.gold[0], BRAND.gold[1], BRAND.gold[2]);
    doc.setLineWidth(1);
    doc.line(M.left, y, PAGE.w - M.right, y);
    doc.setLineWidth(0.4);
    y += SPACING.afterSectionHeading + 6;
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
        fillColor: BRAND.lavenderFill as any,
        textColor: BRAND.purple as any,
        fontStyle: "bold",
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: BRAND.band as any },
      columnStyles,
      // Headers repeat on every page break, and a row is never split.
      showHead: "everyPage",
      rowPageBreak: "avoid",
      didParseCell: (data: any) => {
        if (data.section === "body" && opts.boldRows?.has(data.row.index)) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [255, 255, 255];
        }
        if (data.section === "body") {
          const c = opts.cellColours?.[`${data.row.index}:${data.column.index}`];
          if (c) data.cell.styles.textColor = c as any;
        }
      },
      didDrawCell: (data: any) => {
        // A totals row gets a rule above it, so it reads as a total in
        // greyscale as well as in bold.
        if (data.section === "body" && opts.boldRows?.has(data.row.index)) {
          doc.setDrawColor(BRAND.purple[0], BRAND.purple[1], BRAND.purple[2]);
          doc.setLineWidth(0.8);
          doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
          doc.setLineWidth(0.4);
        }
      },
      willDrawPage: () => {
        // autoTable may add a page itself; the watermark must go down before
        // any content lands on it. Page chrome is applied later, once.
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
  doc.setTextColor(BRAND.purple[0], BRAND.purple[1], BRAND.purple[2]);
  doc.text("Monthly Management Report", M.left, y);
  y += 20 + SPACING.titleInner;
  const titleNames = uniqueNames([m.clientName, m.tenantName]).join(" · ");
  paragraph(
    `${titleNames} · ${m.monthLabel} (period ended ${fmtDate(m.periodEnd)})`,
  );
  y += SPACING.titleInner;
  paragraph(`Prepared by ${m.organisationName}`, { size: 8 });

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

    // Tiles, four across — this is the page clients actually read. Same
    // figures as before, presented rather than tabulated.
    const cols = 4;
    const gap = 10;
    const tileW = (PAGE.w - M.left - M.right - gap * (cols - 1)) / cols;
    const tileH = 72;
    const figures = payload.keyFigures;
    for (let row = 0; row < Math.ceil(figures.length / cols); row++) {
      need(tileH + 8);
      const top = y;
      for (let c = 0; c < cols; c++) {
        const k = figures[row * cols + c];
        if (!k) break;
        const x = M.left + c * (tileW + gap);
        doc.setFillColor(BRAND.band[0], BRAND.band[1], BRAND.band[2]);
        doc.setDrawColor(INK.line[0], INK.line[1], INK.line[2]);
        doc.rect(x, top, tileW, tileH, "FD");
        // Gold accent rule along the top edge of each tile.
        doc.setDrawColor(BRAND.gold[0], BRAND.gold[1], BRAND.gold[2]);
        doc.setLineWidth(1.2);
        doc.line(x, top, x + tileW, top);
        doc.setLineWidth(0.4);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(INK.muted[0], INK.muted[1], INK.muted[2]);
        const labelLines = doc.splitTextToSize(k.label.toUpperCase(), tileW - 16).slice(0, 2);
        let ly = top + 16;
        for (const line of labelLines) {
          doc.text(line, x + 8, ly);
          ly += 8;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(BRAND.purple[0], BRAND.purple[1], BRAND.purple[2]);
        doc.text(f(k, k.month), x + 8, top + 44);

        const jm = judgeVariance({
          variance: k.monthVariance,
          prior: k.priorMonth,
          polarity: keyFigurePolarity(k.key),
          variancePct: k.monthVariancePct,
          unit: k.unit,
        });
        const tone = toneRgb(jm.tone);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(tone[0], tone[1], tone[2]);
        doc.text(
          `${marker(jm.arrow)}${f(k, k.monthVariance)}${jm.showPct ? ` (${pctMagnitude(k.monthVariancePct)})` : ""} vs prior month`,
          x + 8,
          top + 56,
        );
        doc.setTextColor(INK.muted[0], INK.muted[1], INK.muted[2]);
        const jy = judgeVariance({
          variance: k.ytdVariance,
          prior: k.priorFyYtd,
          polarity: keyFigurePolarity(k.key),
          variancePct: k.ytdVariancePct,
          unit: k.unit,
        });
        doc.text(
          `${m.fyLabel} YTD ${f(k, k.fyYtd)} · ${marker(jy.arrow)}${f(k, k.ytdVariance)}`,
          x + 8,
          top + 66,
        );
      }
      y = top + tileH + gap;
    }
    y += 4;

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

  // Page chrome, applied exactly once per page now that the total is known.
  const pageCount = (doc as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawHeaderBand();
    drawFooter(i, pageCount);
  }


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

  // Single brand: no organisation or client logo is read or drawn.
  const bytes = renderMonthlyReportPdf({
    payload: report.payload,
    status: report.status,
    version: report.version,
    title: report.title ?? "Monthly Management Report",
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
