// Server-only builders for Loan Consolidation single-file reconciliation
// export (PDF + Excel). Renders whatever the client already has, so no extra
// Xero calls are required.

export type ReconRowSide = {
  tenantCrmName: string;
  tenantName: string;
  accountCode: string | null;
  accountName: string;
  direction: "payable" | "receivable";
  balance: number | null;
  error?: string;
};

export type ReconRow = {
  id: string;
  account: ReconRowSide;
  counterparty: ReconRowSide | null;
  net: number;
  status: "balanced" | "mismatch" | "unpaired" | "missing";
};

export type ReconSection = {
  tenant: { tenantId: string; tenantName: string; crmCompanyName: string };
  rows: ReconRow[];
};

export type ReconExportInput = {
  groupName: string;
  asAt: string;
  /** One entry per Xero file. A single-file export has exactly one section. */
  sections: ReconSection[];
};


const PURPLE: [number, number, number] = [0x53 / 255, 0x31 / 255, 0x8d / 255];
const GOLD: [number, number, number] = [0xc5 / 255, 0xab / 255, 0x71 / 255];
const INK: [number, number, number] = [0.11, 0.1, 0.16];
const MUTED: [number, number, number] = [0.42, 0.4, 0.48];
const RULE: [number, number, number] = [0.85, 0.85, 0.88];

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `(${abs})` : abs;
}

function statusLabel(s: ReconRow["status"]): string {
  return s === "balanced"
    ? "Balanced"
    : s === "mismatch"
      ? "Mismatch"
      : s === "unpaired"
        ? "Unpaired"
        : "Missing";
}

export async function buildLoanReconciliationPdf(
  input: ReconExportInput,
): Promise<Uint8Array> {
  const pdfLib = (await import(
    "pdf-lib/dist/pdf-lib.esm.js" as string
  )) as typeof import("pdf-lib");
  const { PDFDocument, StandardFonts, rgb } = pdfLib;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(...INK);
  const muted = rgb(...MUTED);
  const rule = rgb(...RULE);
  const purple = rgb(...PURPLE);
  const gold = rgb(...GOLD);
  const red = rgb(0.75, 0.15, 0.15);

  // Landscape A4
  const PAGE_W = 841.89;
  const PAGE_H = 595.28;
  const MARGIN_X = 32;
  const TOP = PAGE_H - 44;
  const BOTTOM = 50;

  // Column widths
  const colAccountW = 220;
  const colBalW = 82;
  const colDirW = 30;
  const colCptyFileW = 150;
  const colCptyAcctW = 190;
  const colCptyBalW = 82;
  const colNetW = 60;
  // Status uses the remainder.
  const TABLE_W = PAGE_W - MARGIN_X * 2;
  const colStatusW =
    TABLE_W -
    (colAccountW + colBalW + colDirW + colCptyFileW + colCptyAcctW + colCptyBalW + colNetW);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = TOP;

  function truncate(
    s: string,
    maxW: number,
    f: import("pdf-lib").PDFFont,
    size: number,
  ): string {
    if (!s) return "";
    if (f.widthOfTextAtSize(s, size) <= maxW) return s;
    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      const cand = s.slice(0, mid) + "…";
      if (f.widthOfTextAtSize(cand, size) <= maxW) lo = mid;
      else hi = mid - 1;
    }
    return s.slice(0, lo) + "…";
  }

  let currentSectionLabel = "";

  function newPage() {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = TOP;
    drawHeader(true);
  }

  function drawHeader(continuation: boolean) {
    page.drawText("Loan Consolidation Reconciliation", {
      x: MARGIN_X,
      y,
      size: 16,
      font: bold,
      color: purple,
    });
    const sub = `${input.groupName}  ·  ${currentSectionLabel}  ·  As at ${input.asAt}${continuation ? "  (continued)" : ""}`;

    page.drawText(sub, {
      x: MARGIN_X,
      y: y - 16,
      size: 9,
      font,
      color: muted,
    });
    y -= 34;

    // Header band
    page.drawRectangle({
      x: MARGIN_X,
      y: y - 26,
      width: TABLE_W,
      height: 26,
      color: purple,
    });
    const headers: Array<{ text: string; x: number; align: "left" | "right" }> = [
      { text: "This file — Account", x: MARGIN_X + 6, align: "left" },
      { text: "Balance", x: MARGIN_X + colAccountW + colBalW - 4, align: "right" },
      { text: "Dir", x: MARGIN_X + colAccountW + colBalW + colDirW - 4, align: "right" },
      {
        text: "Counterparty file",
        x: MARGIN_X + colAccountW + colBalW + colDirW + 6,
        align: "left",
      },
      {
        text: "Counterparty account",
        x: MARGIN_X + colAccountW + colBalW + colDirW + colCptyFileW + 6,
        align: "left",
      },
      {
        text: "Balance",
        x:
          MARGIN_X +
          colAccountW +
          colBalW +
          colDirW +
          colCptyFileW +
          colCptyAcctW +
          colCptyBalW -
          4,
        align: "right",
      },
      {
        text: "Net",
        x:
          MARGIN_X +
          colAccountW +
          colBalW +
          colDirW +
          colCptyFileW +
          colCptyAcctW +
          colCptyBalW +
          colNetW -
          4,
        align: "right",
      },
      {
        text: "Status",
        x:
          MARGIN_X +
          colAccountW +
          colBalW +
          colDirW +
          colCptyFileW +
          colCptyAcctW +
          colCptyBalW +
          colNetW +
          6,
        align: "left",
      },
    ];
    for (const h of headers) {
      const w = h.align === "right" ? bold.widthOfTextAtSize(h.text, 8.5) : 0;
      page.drawText(h.text, {
        x: h.x - w,
        y: y - 17,
        size: 8.5,
        font: bold,
        color: rgb(1, 1, 1),
      });
    }
    y -= 30;
  }

  currentSectionLabel = input.sections[0]?.tenant.crmCompanyName ?? "";
  drawHeader(false);


  function drawRow(row: ReconRow) {
    if (y < BOTTOM + 24) newPage();
    const rowH = 20;

    // This file — account
    const acctLabel = `${row.account.accountCode ? row.account.accountCode + " · " : ""}${row.account.accountName}`;
    page.drawText(truncate(acctLabel, colAccountW - 8, bold, 8.5), {
      x: MARGIN_X + 4,
      y: y - 13,
      size: 8.5,
      font: bold,
      color: ink,
    });

    // This file — balance
    let balTxt = "—";
    let balColor = muted;
    if (row.account.error) {
      balTxt = "missing";
      balColor = red;
    } else if (row.account.balance !== null) {
      balTxt = fmt(row.account.balance);
      balColor = ink;
    }
    let tw = font.widthOfTextAtSize(balTxt, 8);
    page.drawText(balTxt, {
      x: MARGIN_X + colAccountW + colBalW - 4 - tw,
      y: y - 13,
      size: 8,
      font,
      color: balColor,
    });

    // Dir
    const dirTxt = row.account.direction === "receivable" ? "R" : "P";
    tw = bold.widthOfTextAtSize(dirTxt, 8);
    page.drawText(dirTxt, {
      x: MARGIN_X + colAccountW + colBalW + colDirW - 4 - tw,
      y: y - 13,
      size: 8,
      font: bold,
      color: muted,
    });

    // Counterparty file
    if (row.counterparty) {
      page.drawText(
        truncate(row.counterparty.tenantCrmName, colCptyFileW - 8, bold, 8),
        {
          x: MARGIN_X + colAccountW + colBalW + colDirW + 6,
          y: y - 13,
          size: 8,
          font: bold,
          color: gold,
        },
      );
      // Counterparty account
      const cAcct = `${row.counterparty.accountCode ? row.counterparty.accountCode + " · " : ""}${row.counterparty.accountName}`;
      page.drawText(truncate(cAcct, colCptyAcctW - 8, font, 8), {
        x: MARGIN_X + colAccountW + colBalW + colDirW + colCptyFileW + 6,
        y: y - 13,
        size: 8,
        font,
        color: ink,
      });
      // Counterparty balance
      let cBalTxt = "—";
      let cBalColor = muted;
      if (row.counterparty.error) {
        cBalTxt = "missing";
        cBalColor = red;
      } else if (row.counterparty.balance !== null) {
        cBalTxt = fmt(row.counterparty.balance);
        cBalColor = ink;
      }
      const cbw = font.widthOfTextAtSize(cBalTxt, 8);
      page.drawText(cBalTxt, {
        x:
          MARGIN_X +
          colAccountW +
          colBalW +
          colDirW +
          colCptyFileW +
          colCptyAcctW +
          colCptyBalW -
          4 -
          cbw,
        y: y - 13,
        size: 8,
        font,
        color: cBalColor,
      });
    } else {
      page.drawText("(no counterparty set)", {
        x: MARGIN_X + colAccountW + colBalW + colDirW + 6,
        y: y - 13,
        size: 8,
        font,
        color: muted,
      });
    }

    // Net
    const isMismatch = row.status === "mismatch";
    const netTxt = fmt(row.net);
    const nw = bold.widthOfTextAtSize(netTxt, 8.5);
    page.drawText(netTxt, {
      x:
        MARGIN_X +
        colAccountW +
        colBalW +
        colDirW +
        colCptyFileW +
        colCptyAcctW +
        colCptyBalW +
        colNetW -
        4 -
        nw,
      y: y - 13,
      size: 8.5,
      font: bold,
      color: isMismatch ? red : muted,
    });

    // Status
    const statusColor =
      row.status === "balanced"
        ? rgb(0.15, 0.55, 0.3)
        : row.status === "mismatch"
          ? red
          : row.status === "missing"
            ? red
            : gold;
    page.drawText(statusLabel(row.status), {
      x:
        MARGIN_X +
        colAccountW +
        colBalW +
        colDirW +
        colCptyFileW +
        colCptyAcctW +
        colCptyBalW +
        colNetW +
        6,
      y: y - 13,
      size: 8,
      font: bold,
      color: statusColor,
    });

    page.drawLine({
      start: { x: MARGIN_X, y: y - rowH },
      end: { x: PAGE_W - MARGIN_X, y: y - rowH },
      thickness: 0.4,
      color: rule,
    });
    y -= rowH;
  }

  const NET_X =
    MARGIN_X +
    colAccountW +
    colBalW +
    colDirW +
    colCptyFileW +
    colCptyAcctW +
    colCptyBalW +
    colNetW -
    4;

  function drawTotal(label: string, value: number, emphasize: boolean) {
    if (y < BOTTOM + 30) newPage();
    page.drawRectangle({
      x: MARGIN_X,
      y: y - 22,
      width: TABLE_W,
      height: 22,
      color: emphasize ? rgb(0.91, 0.88, 0.96) : rgb(0.96, 0.95, 0.98),
    });
    page.drawText(label, {
      x: MARGIN_X + 6,
      y: y - 15,
      size: 9,
      font: bold,
      color: purple,
    });
    const txt = fmt(value);
    const w = bold.widthOfTextAtSize(txt, 9);
    page.drawText(txt, {
      x: NET_X - w,
      y: y - 15,
      size: 9,
      font: bold,
      color: Math.abs(value) > 0.005 ? red : purple,
    });
    y -= 24;
  }

  const multi = input.sections.length > 1;

  input.sections.forEach((section, si) => {
    if (si > 0) {
      currentSectionLabel = section.tenant.crmCompanyName;
      newPage();
    }
    for (const row of section.rows) drawRow(row);
    const sectionNet = section.rows.reduce((s, r) => s + r.net, 0);
    drawTotal(multi ? `TOTAL NET — ${section.tenant.crmCompanyName}` : "TOTAL NET", sectionNet, false);
  });


  // Footer
  const pages = pdf.getPages();
  const stamp = `Generated ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}`;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawText(stamp, { x: MARGIN_X, y: 22, size: 7, font, color: muted });
    const pg = `Page ${i + 1} of ${pages.length}`;
    const w = font.widthOfTextAtSize(pg, 7);
    p.drawText(pg, { x: PAGE_W - MARGIN_X - w, y: 22, size: 7, font, color: muted });
  }

  return await pdf.save();
}

export async function buildLoanReconciliationXlsx(
  input: ReconExportInput,
): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Traction Advisory";
  wb.created = new Date();

  const purpleFill = "FF53318D";
  const goldFill = "FFC5AB71";
  const zebra = "FFF6F4FA";

  const multi = input.sections.length > 1;
  const usedNames = new Set<string>();

  function sheetName(base: string): string {
    const cleaned = base.replace(/[\\/*?:[\]]/g, " ").trim().slice(0, 28) || "File";
    let name = cleaned;
    let n = 2;
    while (usedNames.has(name)) name = `${cleaned.slice(0, 26)} ${n++}`;
    usedNames.add(name);
    return name;
  }

  function renderSection(section: ReconSection) {
    const ws = wb.addWorksheet(
      multi ? sheetName(section.tenant.crmCompanyName) : "Loan Reconciliation",
      { views: [{ state: "frozen", ySplit: 4 }] },
    );

    ws.getCell("A1").value = "Loan Consolidation Reconciliation";
    ws.getCell("A1").font = { bold: true, size: 16, color: { argb: purpleFill } };
    ws.getCell("A2").value = `${input.groupName}  ·  ${section.tenant.crmCompanyName}  ·  As at ${input.asAt}`;
    ws.getCell("A2").font = { italic: true, color: { argb: "FF6B6873" } };
    ws.mergeCells(1, 1, 1, 8);
    ws.mergeCells(2, 1, 2, 8);

    const headerRow = 4;
    const headers = [
      "This file — Account",
      "Balance",
      "Dir",
      "Counterparty file",
      "Counterparty account",
      "Balance",
      "Net",
      "Status",
    ];
    headers.forEach((h, i) => {
      const cell = ws.getCell(headerRow, i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: purpleFill } };
      cell.alignment = {
        horizontal: [1, 3, 4, 7].includes(i) ? "left" : "right",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = { bottom: { style: "thin", color: { argb: goldFill } } };
    });
    ws.getRow(headerRow).height = 26;
    ws.getColumn(1).width = 36;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 6;
    ws.getColumn(4).width = 24;
    ws.getColumn(5).width = 34;
    ws.getColumn(6).width = 14;
    ws.getColumn(7).width = 12;
    ws.getColumn(8).width = 14;

    let r = headerRow + 1;
    section.rows.forEach((row, idx) => {
      const alt = idx % 2 === 1;

      const acctLabel = `${row.account.accountCode ? row.account.accountCode + " · " : ""}${row.account.accountName}`;
      const c1 = ws.getCell(r, 1);
      c1.value = acctLabel;
      c1.font = { bold: true, color: { argb: "FF1B1826" } };
      c1.alignment = { horizontal: "left", vertical: "middle" };

      const c2 = ws.getCell(r, 2);
      if (row.account.error) {
        c2.value = "Account missing in Xero";
        c2.font = { color: { argb: "FFC02020" } };
      } else if (row.account.balance !== null) {
        c2.value = row.account.balance;
        c2.numFmt = '#,##0.00;(#,##0.00);"—"';
      }
      c2.alignment = { horizontal: "right" };

      const c3 = ws.getCell(r, 3);
      c3.value = row.account.direction === "receivable" ? "R" : "P";
      c3.alignment = { horizontal: "right" };
      c3.font = { bold: true, color: { argb: "FF6B6873" } };

      const c4 = ws.getCell(r, 4);
      if (row.counterparty) {
        c4.value = row.counterparty.tenantCrmName;
        c4.font = { bold: true, color: { argb: goldFill } };
      } else {
        c4.value = "(no counterparty set)";
        c4.font = { color: { argb: "FF9E9AA8" }, italic: true };
      }
      c4.alignment = { horizontal: "left", vertical: "middle" };

      const c5 = ws.getCell(r, 5);
      if (row.counterparty) {
        c5.value = `${row.counterparty.accountCode ? row.counterparty.accountCode + " · " : ""}${row.counterparty.accountName}`;
      }
      c5.alignment = { horizontal: "left", vertical: "middle" };

      const c6 = ws.getCell(r, 6);
      if (row.counterparty) {
        if (row.counterparty.error) {
          c6.value = "Account missing in Xero";
          c6.font = { color: { argb: "FFC02020" } };
        } else if (row.counterparty.balance !== null) {
          c6.value = row.counterparty.balance;
          c6.numFmt = '#,##0.00;(#,##0.00);"—"';
        }
      }
      c6.alignment = { horizontal: "right" };

      const c7 = ws.getCell(r, 7);
      c7.value = row.net;
      c7.numFmt = '#,##0.00;(#,##0.00);"—"';
      c7.font = {
        bold: true,
        color: { argb: row.status === "mismatch" ? "FFC02020" : "FF6B6873" },
      };
      c7.alignment = { horizontal: "right" };

      const c8 = ws.getCell(r, 8);
      c8.value = statusLabel(row.status);
      c8.font = {
        bold: true,
        color: {
          argb:
            row.status === "balanced"
              ? "FF267A3B"
              : row.status === "mismatch" || row.status === "missing"
                ? "FFC02020"
                : goldFill,
        },
      };
      c8.alignment = { horizontal: "left", vertical: "middle" };

      if (alt) {
        for (let i = 1; i <= 8; i++) {
          const cc = ws.getCell(r, i);
          if (!cc.fill || (cc.fill as any).type !== "pattern") {
            cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebra } };
          }
        }
      }
      r += 1;
    });

    // Total net row
    const totalNet = section.rows.reduce((s, x) => s + x.net, 0);
    const totalRow = r;
    ws.mergeCells(totalRow, 1, totalRow, 6);
    const tl = ws.getCell(totalRow, 1);
    tl.value = "TOTAL NET";
    tl.font = { bold: true, color: { argb: purpleFill } };
    tl.alignment = { horizontal: "right", vertical: "middle" };
    const tn = ws.getCell(totalRow, 7);
    tn.value = totalNet;
    tn.numFmt = '#,##0.00;(#,##0.00);"—"';
    tn.font = {
      bold: true,
      color: { argb: Math.abs(totalNet) > 0.005 ? "FFC02020" : purpleFill },
    };
    tn.alignment = { horizontal: "right" };

    return totalNet;
  }

  if (multi) {
    const summary = wb.addWorksheet("Summary", {
      views: [{ state: "frozen", ySplit: 4 }],
    });
    usedNames.add("Summary");
    summary.getCell("A1").value = "Loan Consolidation Reconciliation — All Xero files";
    summary.getCell("A1").font = { bold: true, size: 16, color: { argb: purpleFill } };
    summary.getCell("A2").value = `${input.groupName}  ·  As at ${input.asAt}`;
    summary.getCell("A2").font = { italic: true, color: { argb: "FF6B6873" } };
    summary.mergeCells(1, 1, 1, 3);
    summary.mergeCells(2, 1, 2, 3);
    ["Xero file", "Accounts", "Net"].forEach((h, i) => {
      const cell = summary.getCell(4, i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: purpleFill } };
      cell.alignment = { horizontal: i === 0 ? "left" : "right", vertical: "middle" };
    });
    summary.getColumn(1).width = 44;
    summary.getColumn(2).width = 12;
    summary.getColumn(3).width = 16;

    let sr = 5;
    for (const section of input.sections) {
      const net = renderSection(section);
      summary.getCell(sr, 1).value = section.tenant.crmCompanyName;
      summary.getCell(sr, 2).value = section.rows.length;
      summary.getCell(sr, 2).alignment = { horizontal: "right" };
      const nc = summary.getCell(sr, 3);
      nc.value = net;
      nc.numFmt = '#,##0.00;(#,##0.00);"—"';
      nc.font = { color: { argb: Math.abs(net) > 0.005 ? "FFC02020" : "FF1B1826" } };
      nc.alignment = { horizontal: "right" };
      sr += 1;
    }
  } else {
    renderSection(input.sections[0]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

