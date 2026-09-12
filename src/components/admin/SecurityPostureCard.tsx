import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw } from "lucide-react";
import {
  getSecurityChecks,
  getOnlineUsers,
  recordAttestation,
  type PostureCheck,
  type PostureStatus,
} from "@/lib/security-posture.functions";
import { OnlineChip, relativeMinutes } from "@/components/admin/SecurityStatusCard";

/**
 * A control no system can read: the only honest evidence is a recorded human
 * confirmation. The wording makes plain that the person pressing Confirm is
 * asserting they checked the backend setting themselves.
 */
function AttestationControl({
  check,
  onRecorded,
}: {
  check: PostureCheck;
  onRecorded: () => void;
}) {
  const att = check.attestable!;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const record = useServerFn(recordAttestation);

  const mutation = useMutation({
    mutationFn: () => record({ data: { checkKey: att.checkKey, note: note.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Confirmation recorded against your name.");
      setOpen(false);
      setNote("");
      onRecorded();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mt-2 rounded-md border border-dashed p-3 text-xs">
      <p className="text-muted-foreground">
        This setting cannot be read by this application, so it is evidenced by a recorded human
        confirmation rather than an automated check.
        {att.confirmedByEmail
          ? ` Last confirmed by ${att.confirmedByEmail} on ${new Date(att.confirmedAt!).toISOString().slice(0, 10)}.`
          : " Nobody has confirmed it yet."}
      </p>
      {att.note && <p className="mt-1 text-muted-foreground/80">Note: {att.note}</p>}
      {open ? (
        <div className="mt-2 space-y-2">
          <p className="font-medium">{att.claim}</p>
          <Input
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note (what you saw, where)"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              I confirm this myself
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(true)}>
          {att.confirmedAt ? "Re-confirm" : "Confirm"}
        </Button>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: PostureStatus }) {
  if (status === "ok") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">All OK</Badge>;
  }
  if (status === "warn") {
    return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Warn</Badge>;
  }
  return <Badge variant="destructive">Action</Badge>;
}

export function SecurityPostureCard() {
  const fn = useServerFn(getSecurityChecks);
  const onlineFn = useServerFn(getOnlineUsers);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["security-checks"],
    queryFn: () => fn(),
    retry: false,
  });

  const online = useQuery({
    queryKey: ["online-users"],
    queryFn: () => onlineFn(),
    retry: false,
    enabled: !error,
  });

  const onlineList = online.data ?? [];

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Posture</h2>
            <p className="text-sm text-muted-foreground">
              Live checks run against the database and server on every load — no stored or
              assumed results.
              {data ? ` Checked ${relativeMinutes(data.generatedAt)}.` : ""}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refetch();
              void online.refetch();
            }}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Re-run
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running checks…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {data?.ok ?? 0} OK · {data?.warn ?? 0} Warn · {data?.action ?? 0} Action ·{" "}
              {onlineList.length} online
            </p>

            {onlineList.length > 0 && (
              <div className="rounded-lg border p-3">
                <div className="text-sm font-medium">Online now</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {onlineList.map((u) => (
                    <OnlineChip
                      key={u.userId}
                      displayName={u.displayName}
                      email={u.email}
                      isSuperAdmin={u.isSuperAdmin}
                      hasMfa={u.hasMfa}
                      lastSeenAt={u.lastSeenAt}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="divide-y">
              {(data?.checks ?? []).map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{c.title}</div>
                    <div className="text-sm text-muted-foreground">{c.detail}</div>
                    <div className="text-xs text-muted-foreground/80 mt-1 break-words">
                      Evidence: {c.evidence}
                    </div>
                    {c.matches && c.matches.length > 0 && (
                      <details className="mt-2 text-xs text-muted-foreground">
                        <summary className="cursor-pointer">
                          Guard matched per function ({c.matches.length})
                        </summary>
                        <ul className="mt-1 space-y-0.5">
                          {c.matches.map((m) => (
                            <li key={m.fn} className="break-words">
                              <code>{m.fn}</code> —{" "}
                              {m.pattern === "none" ? "no guard found" : <code>{m.pattern}</code>}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {c.attestable && (
                      <AttestationControl check={c} onRecorded={() => void refetch()} />
                    )}
                  </div>
                  <div className="shrink-0">
                    <StatusPill status={c.status} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
