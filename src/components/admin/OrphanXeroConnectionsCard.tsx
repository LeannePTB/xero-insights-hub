/**
 * Unassigned Xero connections (super admin only).
 *
 * Path C platform metadata: Xero organisation name, status, who authorised it.
 * Nothing from any client's financial data, and no tokens.
 *
 * Hidden entirely while empty: since Phase 5 the database prevents unassigned
 * connections from being created, so the normal state is none. The capability
 * stays here — if one ever appears, this card returns and offers assign or
 * disconnect. The Security page posture check covers the same ground.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignOrphanXeroConnection,
  disconnectOrphanXeroConnection,
  listOrphanXeroConnections,
} from "@/lib/xero/orphan-connections.functions";

type FirmOption = { id: string; name: string };

export function OrphanXeroConnectionsCard({ firms }: { firms: FirmOption[] }) {
  const qc = useQueryClient();
  const fetchOrphans = useServerFn(listOrphanXeroConnections);
  const assign = useServerFn(assignOrphanXeroConnection);
  const disconnect = useServerFn(disconnectOrphanXeroConnection);
  const [choice, setChoice] = useState<Record<string, string>>({});

  const orphansQ = useQuery({
    queryKey: ["orphan-xero-connections"],
    queryFn: () => fetchOrphans(),
  });

  const assignMut = useMutation({
    mutationFn: (vars: { connectionId: string; firmId: string }) => assign({ data: vars }),
    onSuccess: () => {
      toast.success("Xero organisation assigned");
      qc.invalidateQueries({ queryKey: ["orphan-xero-connections"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not assign that Xero organisation."),
  });

  const disconnectMut = useMutation({
    mutationFn: (connectionId: string) => disconnect({ data: { connectionId } }),
    onSuccess: () => {
      toast.success("Xero organisation disconnected");
      qc.invalidateQueries({ queryKey: ["orphan-xero-connections"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not disconnect that Xero organisation."),
  });

  const rows = orphansQ.data ?? [];

  // Nothing to do — render nothing at all (also while loading, so an empty
  // state never flashes). Visibility is gated by the caller (super admin only).
  if (orphansQ.isLoading || rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Unassigned Xero connections</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
      <p className="mb-3 text-xs text-muted-foreground">
        Xero files that were authorised but never placed with an organisation. Assign one to an
        organisation, or disconnect it. Assignment is subject to that organisation's plan.
      </p>

      <ul className="space-y-2">
        {rows.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background/60 p-3"
          >
            <div className="min-w-[14rem]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{c.tenantName}</span>
                <Badge variant={c.status === "connected" ? "default" : "secondary"} className="capitalize">
                  {c.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Authorised by {c.authorisedBy ?? "an unknown user"} on{" "}
                {new Date(c.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={choice[c.id] ?? ""}
                onValueChange={(v) => setChoice((prev) => ({ ...prev, [c.id]: v }))}
              >
                <SelectTrigger className="h-9 w-56">
                  <SelectValue placeholder="Choose an organisation" />
                </SelectTrigger>
                <SelectContent>
                  {firms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!choice[c.id] || assignMut.isPending}
                onClick={() =>
                  assignMut.mutate({ connectionId: c.id, firmId: choice[c.id] as string })
                }
              >
                Assign
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={disconnectMut.isPending}>
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect {c.tenantName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Our access is revoked at Xero and the file is marked as needing
                      reconnection. It isn't placed with any organisation, so no dashboard is
                      affected, and it can be connected again at any time.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => disconnectMut.mutate(c.id)}>
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </li>
        ))}
      </ul>
      </CardContent>
    </Card>
  );
}
