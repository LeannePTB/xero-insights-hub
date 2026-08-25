import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listFirmXeroFiles, startXeroReconnectAll } from "@/lib/xero/reconnect-all.functions";

/**
 * Xero organisations panel for an organisation, with a bulk reconnect.
 * Reconnecting refreshes tokens and permissions for the files that are
 * already linked here — it never links anything new.
 */
export function FirmXeroFilesCard({
  firmId,
  variant = "card",
}: {
  firmId: string;
  /** "plain" matches the bordered sections on the admin organisation page. */
  variant?: "card" | "plain";
}) {
  const fetchFiles = useServerFn(listFirmXeroFiles);
  const startAll = useServerFn(startXeroReconnectAll);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["firm-xero-files", firmId],
    queryFn: () => fetchFiles({ data: { firmId } }),
  });
  const files = data?.files ?? [];

  // Report the outcome of a bulk reconnect honestly: Xero only returns the
  // organisations the user actually ticked on the consent screen.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("xero") !== "reconnected" || !params.get("requested")) return;
    const refreshed = Number(params.get("refreshed") ?? "0");
    const requested = Number(params.get("requested") ?? "0");
    const missed = (params.get("missed") ?? "").split("|").filter(Boolean);
    const ungranted = (params.get("ungranted") ?? "").split("|").filter(Boolean);
    if (ungranted.length > 0) {
      // A successful token exchange is not a full grant. Say what is missing.
      toast.warning(`Reconnected, but Xero did not grant: ${ungranted.join(", ")}`, {
        description:
          "Run the reconnect again and approve every permission on Xero's consent screen, otherwise the cards that need them will keep failing.",
        duration: 14000,
      });
    } else if (missed.length > 0) {
      toast.warning(`${refreshed} of ${requested} Xero files reconnected`, {
        description: `Not authorised on the Xero screen: ${missed.join(", ")}. Run it again and tick those.`,
        duration: 12000,
      });
    } else {
      toast.success(`${refreshed} of ${requested} Xero files reconnected`);
    }
    params.delete("xero");
    params.delete("refreshed");
    params.delete("requested");
    params.delete("missed");
    params.delete("ungranted");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

  async function reconnectAll() {
    setStarting(true);
    try {
      const res = await startAll({ data: { firmId, origin: window.location.origin } });
      window.location.href = res.authorizeUrl;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start the reconnect.");
      setStarting(false);
    }
  }

  const needsAttention = files.filter((f) => f.missingScopes.length > 0);

  return (
    <section
      className={
        variant === "plain"
          ? "rounded-lg border p-6"
          : "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={variant === "plain" ? "text-lg font-semibold" : "text-sm font-medium"}>
            Xero organisations
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Files already linked to this organisation. Reconnecting refreshes their permissions —
            it never links anything new.
          </p>
        </div>
        {files.length > 1 && (
          <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)} disabled={starting}>
            {starting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Reconnect all Xero files
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      ) : files.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">No Xero files linked yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {files.map((f) => (
            <li key={f.connectionId} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="truncate text-sm">{f.tenantName}</span>
              {f.missingScopes.length > 0 ? (
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-amber-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Missing permissions ({f.missingScopes.length})
                </span>
              ) : f.status !== "connected" ? (
                <span className="shrink-0 text-xs text-muted-foreground">{f.status}</span>
              ) : (
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Connected
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {needsAttention.length > 0 && (
        <p className="mt-3 text-xs text-amber-500">
          {needsAttention.length} file{needsAttention.length === 1 ? "" : "s"} still need
          reauthorising: {needsAttention.map((f) => f.tenantName).join(", ")}.
        </p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reconnect all Xero files</AlertDialogTitle>
            <AlertDialogDescription>
              You'll be sent to Xero's consent screen. Tick <strong>all {files.length}</strong>{" "}
              organisations you want reconnected — anything you leave unticked will not be
              refreshed, and you'd need to run this again. Nothing new is linked either way.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={reconnectAll}>Continue to Xero</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
