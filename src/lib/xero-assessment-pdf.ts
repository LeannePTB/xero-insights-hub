import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { XeroAssessmentContact } from "@/lib/xero-assessment.functions";

type SectionTable = {
  heading: string;
  number: string;
  headers: string[];
  rows: string[][];
};

export type XeroPolicyDocs = {
  readme: string;
  accessControl: string;
  dataHosting: string;
  dataRetention: string;
  incidentResponse: string;
  monitoring: string;
  sdlc: string;
  vulnerabilityManagement: string;
};

const SECTION_DOCS: Record<string, Array<{ title: string; key: keyof XeroPolicyDocs }>> = {
  "2": [
    { title: "Security overview (README)", key: "readme" },
    { title: "SDLC & secrets management", key: "sdlc" },
  ],
  "3": [{ title: "Access control policy", key: "accessControl" }],
  "4": [{ title: "Data hosting & sub-processors", key: "dataHosting" }],
  "5": [{ title: "SDLC & server hardening", key: "sdlc" }],
  "6": [{ title: "Vulnerability management policy", key: "vulnerabilityManagement" }],
  "7": [{ title: "Data retention policy", key: "dataRetention" }],
  "8": [
    { title: "Security monitoring policy", key: "monitoring" },
    { title: "Incident response policy", key: "incidentResponse" },
  ],
};

function parseSections(md: string): SectionTable[] {
  const lines = md.split(/\r?\n/);
  const sections: SectionTable[] = [];
  let current: SectionTable | null = null;
  let headerSeen = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^##\s+(.+)$/);
    if (h) {
      if (current) sections.push(current);
      const heading = h[1].trim();
      const num = heading.match(/Section\s+(\d+)/i)?.[1] ?? "";
      current = { heading, number: num, headers: [], rows: [] };
      headerSeen = false;
      continue;
    }
    if (!current) continue;
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length === 0) continue;
    if (cells.every((c) => /^:?-{3,}:?$/.test(c))) continue;
    if (!headerSeen) {
      current.headers = cells;
      headerSeen = true;
    } else {
      current.rows.push(cells);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function stripInlineMd(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/<(https?:[^>]+)>/g, "$1");
}

type Ctx = {
  doc: jsPDF;
  margin: number;
  contentW: number;
  pageH: number;
  y: number;
  sectionLabel: string;
};

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y + needed > ctx.pageH - ctx.margin) {
    ctx.doc.addPage();
    ctx.y = ctx.margin + 24;
    ctx.doc.setFont("helvetica", "italic");
    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(120);
    ctx.doc.text(ctx.sectionLabel, ctx.margin, ctx.margin);
    ctx.doc.setTextColor(0);
  }
}

function writeWrapped(
  ctx: Ctx,
  text: string,
  opts: { size: number; bold?: boolean; mono?: boolean; lineGap?: number; indent?: number; color?: number },
) {
  const indent = opts.indent ?? 0;
  ctx.doc.setFont(opts.mono ? "courier" : "helvetica", opts.bold ? "bold" : "normal");
  ctx.doc.setFontSize(opts.size);
  if (opts.color !== undefined) ctx.doc.setTextColor(opts.color);
  const lines = ctx.doc.splitTextToSize(text, ctx.contentW - indent) as string[];
  const lh = opts.size + (opts.lineGap ?? 3);
  for (const line of lines) {
    ensureSpace(ctx, lh);
    ctx.doc.text(line, ctx.margin + indent, ctx.y);
    ctx.y += lh;
  }
  if (opts.color !== undefined) ctx.doc.setTextColor(0);
}

function renderMarkdown(ctx: Ctx, md: string) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    const text = stripInlineMd(para.join(" ").trim());
    if (text) {
      writeWrapped(ctx, text, { size: 10, lineGap: 3 });
      ctx.y += 4;
    }
    para = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushPara();
      i++;
      const buf: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      ctx.y += 2;
      for (const code of buf) {
        writeWrapped(ctx, code || " ", { size: 9, mono: true, lineGap: 2, color: 60 });
      }
      ctx.y += 4;
      continue;
    }

    const h = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      flushPara();
      const level = h[1].length;
      const text = stripInlineMd(h[2]);
      const size = level === 1 ? 14 : level === 2 ? 12 : 11;
      ctx.y += 6;
      writeWrapped(ctx, text, { size, bold: true, lineGap: 3 });
      ctx.y += 2;
      i++;
      continue;
    }

    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      flushPara();
      ensureSpace(ctx, 10);
      ctx.doc.setDrawColor(200);
      ctx.doc.line(ctx.margin, ctx.y, ctx.margin + ctx.contentW, ctx.y);
      ctx.y += 8;
      i++;
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushPara();
      writeWrapped(ctx, "• " + stripInlineMd(bullet[1]), { size: 10, lineGap: 3, indent: 8 });
      i++;
      continue;
    }

    const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      flushPara();
      writeWrapped(ctx, "• " + stripInlineMd(numbered[1]), { size: 10, lineGap: 3, indent: 8 });
      i++;
      continue;
    }

    if (trimmed.startsWith("|") && i + 1 < lines.length && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1].trim())) {
      flushPara();
      const header = trimmed.split("|").slice(1, -1).map((c) => stripInlineMd(c.trim()));
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(
          lines[i]
            .trim()
            .split("|")
            .slice(1, -1)
            .map((c) => stripInlineMd(c.trim())),
        );
        i++;
      }
      ensureSpace(ctx, 40);
      autoTable(ctx.doc, {
        startY: ctx.y,
        head: [header],
        body: rows,
        theme: "grid",
        margin: { left: ctx.margin, right: ctx.margin },
        headStyles: { fillColor: [70, 80, 110], textColor: 255, fontStyle: "bold", fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
      });
      // @ts-expect-error autoTable attaches lastAutoTable
      ctx.y = ctx.doc.lastAutoTable.finalY + 8;
      continue;
    }

    if (trimmed === "") {
      flushPara();
      i++;
      continue;
    }

    para.push(trimmed);
    i++;
  }
  flushPara();
}

export function buildXeroAssessmentPdf(
  contact: XeroAssessmentContact,
  mappingMd: string,
  policyDocs: XeroPolicyDocs,
): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Xero API Consumer", margin, 110);
  doc.text("Annual Security Assessment", margin, 140);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(
    "Assessment responses with full supporting policies embedded for each section.",
    margin,
    170,
    { maxWidth: contentW },
  );
  doc.setTextColor(0);

  const v = (s?: string | null) =>
    s && String(s).trim().length > 0 ? String(s) : "(not provided)";

  autoTable(doc, {
    startY: 210,
    head: [["Section 1 — Contact details", ""]],
    body: [
      ["Company legal name", v(contact.legal_name)],
      ["Trading name", v(contact.trading_name)],
      ["ABN / ACN", v(contact.abn_acn)],
      ["Registered address", v(contact.address)],
      ["Website", v(contact.website)],
      ["App name", v(contact.app_name)],
      ["Xero app ID / client ID", v(contact.xero_client_id)],
      ["Primary contact name", v(contact.contact_name)],
      ["Primary contact role", v(contact.contact_role)],
      ["Primary contact email", v(contact.contact_email)],
      ["Primary contact phone", v(contact.contact_phone)],
      ["Assessment date", v(contact.assessment_date)],
    ],
    theme: "grid",
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [33, 47, 90], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 6, overflow: "linebreak" },
    columnStyles: { 0: { cellWidth: 180, fontStyle: "bold" } },
  });

  // @ts-expect-error autoTable attaches lastAutoTable
  let cursorY: number = doc.lastAutoTable.finalY + 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("1.5 How your application uses the Xero API", margin, cursorY);
  cursorY += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const desc = v(contact.api_usage_description);
  const wrapped = doc.splitTextToSize(desc, contentW);
  doc.text(wrapped, margin, cursorY);
  cursorY += wrapped.length * 13 + 8;

  const sections = parseSections(mappingMd);

  for (const s of sections) {
    if (s.headers.length === 0 || s.rows.length === 0) continue;

    doc.addPage();
    cursorY = margin + 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(s.heading, margin, cursorY);
    cursorY += 22;

    autoTable(doc, {
      startY: cursorY,
      head: [s.headers.map(stripInlineMd)],
      body: s.rows.map((r) => r.map(stripInlineMd)),
      theme: "grid",
      margin: { left: margin, right: margin, top: margin + 20 },
      headStyles: { fillColor: [33, 47, 90], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 5, overflow: "linebreak" },
      columnStyles:
        s.headers.length === 4
          ? { 0: { cellWidth: 32 }, 1: { cellWidth: 170 }, 2: { cellWidth: 130 } }
          : undefined,
      didDrawPage: () => {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(s.heading, margin, margin);
        doc.setTextColor(0);
      },
    });
    // @ts-expect-error autoTable attaches lastAutoTable
    cursorY = doc.lastAutoTable.finalY + 22;

    const refs = SECTION_DOCS[s.number] ?? [];
    if (refs.length > 0) {
      const ctx: Ctx = {
        doc,
        margin,
        contentW,
        pageH,
        y: cursorY,
        sectionLabel: s.heading,
      };
      ensureSpace(ctx, 24);
      ctx.doc.setFont("helvetica", "bold");
      ctx.doc.setFontSize(13);
      ctx.doc.text("Detailed answer — supporting policy", ctx.margin, ctx.y);
      ctx.y += 18;

      for (const ref of refs) {
        ensureSpace(ctx, 28);
        ctx.doc.setFont("helvetica", "bold");
        ctx.doc.setFontSize(11);
        ctx.doc.setTextColor(60);
        ctx.doc.text(ref.title, ctx.margin, ctx.y);
        ctx.doc.setTextColor(0);
        ctx.y += 14;
        renderMarkdown(ctx, policyDocs[ref.key]);
        ctx.y += 10;
      }
      cursorY = ctx.y;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(140);
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 20, { align: "right" });
    doc.setTextColor(0);
  }

  return doc;
}
