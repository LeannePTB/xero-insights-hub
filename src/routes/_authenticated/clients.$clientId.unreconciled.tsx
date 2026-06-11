import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  uploadStatementLines,
  getLatestStatement,
  updateLineComment,
  deleteUpload,
} from "@/lib/unreconciled.functions";
import { getMyContext } from "@/lib/roles.functions";
import { getClient } from "@/lib/clients.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  FileSpreadsheet,
  Loader2,
  Upload,
  Save,
  Trash2,
  Check,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients/$clientId/unreconciled")({
  head: () => ({ meta: [{ title: "Uncoded statement lines — Traction Advisory" }] }),
  component: UnreconciledPage,
});

function fmtMoney(n: number | null) {
  if (n == null) return "";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string | null) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

function UnreconciledPage() {
  const { clientId } = Route.useParams();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchCtx = useServerFn(getMyContext);
  const fetchClient = useServerFn(getClient);
  const fetchLatest = useServerFn(getLatestStatement);
  const uploadFn = useServerFn(uploadStatementLines);
  const deleteFn = useServerFn(deleteUpload);

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const clientQ = useQuery({ queryKey: ["client", clientId], queryFn: () => fetchClient({ data: { clientId } }) });
  const latestQ = useQuery({
    queryKey: ["unreconciled", clientId],
    queryFn: () => fetchLatest({ data: { clientId } }),
  });

  const isAdvisor = ctxQ.data?.isAdvisor ?? false;

  const uploadMut = useMutation({
    mutationFn: (v: { filename: string; csv: string }) =>
      uploadFn({ data: { clientId, filename: v.filename, csv: v.csv } }),
    onSuccess: ({ lineCount }) => {
      toast.success(`Uploaded ${lineCount} line${lineCount === 1 ? "" : "s"}`);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["unreconciled", clientId] });
      qc.invalidateQueries({ queryKey: ["unreconciled-summary", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (uploadId: string) => deleteFn({ data: { uploadId } }),
    onSuccess: () => {
      toast.success("Upload removed");
      qc.invalidateQueries({ queryKey: ["unreconciled", clientId] });
      qc.invalidateQueries({ queryKey: ["unreconciled-summary", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function handlePick() { fileRef.current?.click(); }
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      toast.error("Please upload a .csv file exported from Xero.");
      return;
    }
    if (file.size > 5_000_000) {
      toast.error("File too large (max 5MB).");
      return;
    }
    const csv = await file.text();
    uploadMut.mutate({ filename: file.name, csv });
  }

  const lines = latestQ.data?.lines ?? [];
  const upload = latestQ.data?.upload;

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const l of lines) {
      const key = `${l.account_name}|||${l.account_number ?? ""}`;
      const arr = map.get(key) ?? [];
      arr.push(l);
      map.set(key, arr);
    }
    return [...map.entries()].map(([k, items]) => {
      const [name, number] = k.split("|||");
      return { name, number, items };
    });
  }, [lines]);

  if (ctxQ.isLoading || clientQ.isLoading) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>;
  }
  const client = clientQ.data?.client;
  if (!client) return <p className="p-6 text-sm text-destructive">Client not found.</p>;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/clients/$clientId" params={{ clientId }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to dashboard
          </Link>
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-3xl font-semibold">Uncoded statement lines</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">{client.name}</p>
              </div>
            </div>
          </div>
          {isAdvisor && (
            <div className="flex items-center gap-2">
              <Input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="hidden"
              />
              <Button onClick={handlePick} disabled={uploadMut.isPending}>
                {uploadMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Upload CSV
              </Button>
            </div>
          )}
        </div>

        {isAdvisor && (
          <p className="text-xs text-muted-foreground">
            Export the Statement Lines report from Xero (Banking → Statements → Export) and upload the CSV here. New uploads replace the previous list for this client.
          </p>
        )}

        {latestQ.isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading lines…
          </div>
        ) : !upload ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
            <p className="text-sm text-muted-foreground">
              {isAdvisor
                ? "No statement file uploaded yet. Click Upload CSV to get started."
                : "No statement file has been uploaded for this client yet."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-3 text-sm">
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{upload.filename}</span> · {upload.line_count} {upload.line_count === 1 ? "line" : "lines"} · uploaded {fmtDate(upload.created_at)}
              </span>
              {isAdvisor && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { if (confirm("Remove this upload and all its lines?")) deleteMut.mutate(upload.id); }}
                  disabled={deleteMut.isPending}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                </Button>
              )}
            </div>

            {grouped.map((g) => (
              <AccountTable key={`${g.name}-${g.number}`} name={g.name} number={g.number} items={g.items} clientId={clientId} />
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function AccountTable({
  name, number, items, clientId,
}: { name: string; number: string; items: any[]; clientId: string }) {
  if (items.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
      <header className="flex items-baseline justify-between border-b border-border bg-muted/30 px-5 py-3">
        <h3 className="font-display text-base font-semibold">{name}</h3>
        {number && <span className="text-xs text-muted-foreground">{number}</span>}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Payee</th>
              <th className="px-4 py-2 font-medium">Reference</th>
              <th className="px-4 py-2 text-right font-medium">Spent</th>
              <th className="px-4 py-2 text-right font-medium">Received</th>
              <th className="px-4 py-2 font-medium" style={{ minWidth: 200 }}>Comments</th>
              <th className="px-4 py-2 font-medium" style={{ minWidth: 240 }}>Your comments</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <LineRow key={l.id} line={l} clientId={clientId} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LineRow({ line, clientId }: { line: any; clientId: string }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateLineComment);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(line.client_comment ?? "");

  useEffect(() => { if (!editing) setValue(line.client_comment ?? ""); }, [line.client_comment, editing]);

  const saveMut = useMutation({
    mutationFn: () => updateFn({ data: { lineId: line.id, comment: value } }),
    onSuccess: () => {
      toast.success("Comment saved");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["unreconciled", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <tr className="border-b border-border/60 align-top last:border-0">
      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(line.txn_date)}</td>
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{line.payee ?? "—"}</div>
        {line.source_comment && (
          <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{line.source_comment}</div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{line.reference ?? ""}</td>
      <td className="px-4 py-3 text-right tabular-nums">{line.spent != null ? fmtMoney(line.spent) : ""}</td>
      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{line.received != null ? fmtMoney(line.received) : ""}</td>
      <td className="px-4 py-3" style={{ minWidth: 240 }}>
        {editing ? (
          <div className="space-y-1.5">
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Add a comment…"
              className="text-sm"
            />
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setValue(line.client_comment ?? ""); }} disabled={saveMut.isPending}>
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || value === (line.client_comment ?? "")}>
                {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="group flex w-full min-h-[2rem] items-start gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted/60"
          >
            {line.client_comment ? (
              <span className="whitespace-pre-wrap text-foreground">{line.client_comment}</span>
            ) : (
              <span className="text-muted-foreground italic">Click to add…</span>
            )}
            <Pencil className="ml-auto mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </button>
        )}
      </td>
    </tr>
  );
}
