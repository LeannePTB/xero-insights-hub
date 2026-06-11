import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- CSV parsing ----------
function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  let inQ = false;
  while (i < line.length) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 2; continue; }
      if (c === '"') { inQ = false; i++; continue; }
      cur += c; i++;
    } else {
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ",") { out.push(cur); cur = ""; i++; continue; }
      cur += c; i++;
    }
  }
  out.push(cur);
  return out;
}

function num(v: string | undefined): number | null {
  if (!v) return null;
  const cleaned = v.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function dateOrNull(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

type ParsedLine = {
  account_name: string;
  account_number: string | null;
  row_index: number;
  txn_date: string | null;
  payee: string | null;
  reference: string | null;
  spent: number | null;
  received: number | null;
  tax: string | null;
  source_comment: string | null;
};

function parseStatementCsv(text: string): ParsedLine[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[][] = [];
  let cur: string[] = [];
  for (const raw of lines) {
    if (raw.trim() === "") {
      if (cur.length) blocks.push(cur);
      cur = [];
    } else {
      cur.push(raw);
    }
  }
  if (cur.length) blocks.push(cur);

  const out: ParsedLine[] = [];
  let rowIdx = 0;
  for (const block of blocks) {
    if (block.length < 3) continue;
    const account_name = block[0].trim();
    const account_number = block[1].trim() || null;
    const headers = parseCsvRow(block[2]).map((h) => h.trim().toLowerCase());
    const idx = (label: string) => headers.findIndex((h) => h === label);
    const iDate = idx("date");
    const iPayee = idx("payee");
    // Reference: prefer "reference", fall back to particulars
    let iRef = idx("reference");
    if (iRef === -1) iRef = headers.findIndex((h) => h.startsWith("particulars"));
    const iSpent = idx("spent");
    const iReceived = idx("received");
    const iTax = idx("tax");
    // Comments: prefer "your comments" → "comments" → "description" → "analysis code"
    let iComment = idx("your comments");
    if (iComment === -1) iComment = idx("comments");
    if (iComment === -1) iComment = idx("description");
    if (iComment === -1) iComment = idx("analysis code");

    for (let r = 3; r < block.length; r++) {
      const cols = parseCsvRow(block[r]);
      // skip rows that are basically empty
      if (cols.every((c) => c.trim() === "")) continue;
      out.push({
        account_name,
        account_number,
        row_index: rowIdx++,
        txn_date: iDate >= 0 ? dateOrNull(cols[iDate]) : null,
        payee: iPayee >= 0 ? (cols[iPayee] ?? "").trim() || null : null,
        reference: iRef >= 0 ? (cols[iRef] ?? "").trim() || null : null,
        spent: iSpent >= 0 ? num(cols[iSpent]) : null,
        received: iReceived >= 0 ? num(cols[iReceived]) : null,
        tax: iTax >= 0 ? ((cols[iTax] ?? "").trim() || null) : null,
        source_comment: iComment >= 0 ? ((cols[iComment] ?? "").trim() || null) : null,
      });
    }
  }
  return out;
}

// ---------- Auth helpers ----------
async function assertAdvisor(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "advisor");
  if (!data || data.length === 0) throw new Error("Advisor only.");
}

async function assertClientAccess(supabase: any, userId: string, clientId: string) {
  // Advisor or has access row
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "advisor");
  if (roleRows && roleRows.length > 0) return;
  const { data: access } = await supabase
    .from("client_access")
    .select("client_id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!access) throw new Error("You don't have access to this client.");
}

// ---------- Server functions ----------
export const uploadStatementLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; filename: string; csv: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    if (!data.csv?.trim()) throw new Error("Empty file.");
    if (data.csv.length > 5_000_000) throw new Error("File too large (max 5MB).");

    const parsed = parseStatementCsv(data.csv);
    if (parsed.length === 0) throw new Error("No statement lines found in this file.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: upload, error: uErr } = await supabaseAdmin
      .from("unreconciled_uploads")
      .insert({
        client_id: data.clientId,
        uploaded_by: context.userId,
        filename: data.filename.slice(0, 255),
        line_count: parsed.length,
      })
      .select("id")
      .single();
    if (uErr) throw new Error(uErr.message);

    const rows = parsed.map((p) => ({
      upload_id: upload.id,
      client_id: data.clientId,
      ...p,
    }));
    // Insert in batches of 500 to stay safe
    for (let i = 0; i < rows.length; i += 500) {
      const slice = rows.slice(i, i + 500);
      const { error } = await supabaseAdmin.from("unreconciled_lines").insert(slice);
      if (error) throw new Error(error.message);
    }

    return { ok: true, uploadId: upload.id, lineCount: parsed.length };
  });

export const getLatestStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertClientAccess(context.supabase, context.userId, data.clientId);
    const { data: upload } = await context.supabase
      .from("unreconciled_uploads")
      .select("id, filename, line_count, created_at, uploaded_by")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!upload) return { upload: null, lines: [] as any[] };

    const { data: lines, error } = await context.supabase
      .from("unreconciled_lines")
      .select(
        "id, account_name, account_number, row_index, txn_date, payee, reference, spent, received, tax, source_comment, client_comment",
      )
      .eq("upload_id", upload.id)
      .order("account_name", { ascending: true })
      .order("row_index", { ascending: true });
    if (error) throw new Error(error.message);

    return { upload, lines: lines ?? [] };
  });

export const getStatementSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertClientAccess(context.supabase, context.userId, data.clientId);
    const { data: upload } = await context.supabase
      .from("unreconciled_uploads")
      .select("id, line_count, created_at")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { upload };
  });

export const updateLineComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { lineId: string; comment: string }) => i)
  .handler(async ({ data, context }) => {
    const comment = (data.comment ?? "").slice(0, 2000);
    // RLS allows advisors + viewers with client access to update.
    const { error } = await context.supabase
      .from("unreconciled_lines")
      .update({ client_comment: comment })
      .eq("id", data.lineId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { uploadId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("unreconciled_uploads")
      .delete()
      .eq("id", data.uploadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
