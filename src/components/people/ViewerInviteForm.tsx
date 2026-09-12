import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Mail, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteViewer } from "@/lib/viewers.functions";
import { ALL_TIERS, tierLabel } from "@/lib/tiers";
import type { DashboardTier } from "@/lib/tiers";

type Client = { id: string; name: string };

/**
 * One invitation, one level, two scopes. The wording is deliberately plain:
 * "Only the clients I tick" versus "Every client in this organisation,
 * including ones added later".
 */
export function ViewerInviteForm({ firmId, clients }: { firmId: string; clients: Client[] }) {
  const qc = useQueryClient();
  const send = useServerFn(inviteViewer);

  const [email, setEmail] = useState("");
  const [scope, setScope] = useState<"selected" | "all_clients">("selected");
  const [tier, setTier] = useState<DashboardTier>("basic");
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [link, setLink] = useState<string | null>(null);

  const showSearch = clients.length > 8;
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients;
  }, [clients, search]);

  const allPicked = picked.length === clients.length && clients.length > 0;

  const mut = useMutation({
    mutationFn: () =>
      send({
        data: {
          firmId,
          email,
          scope,
          tier,
          clientIds: scope === "selected" ? picked : [],
        },
      }),
    onSuccess: (res: any) => {
      setEmail("");
      setPicked([]);
      if (res?.invited && res?.token) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        setLink(`${origin}/signup/${res.token}`);
        toast.success("Invitation sent.");
      } else {
        setLink(null);
        toast.success("Access given — that person already has an account.");
      }
      qc.invalidateQueries({ queryKey: ["standing-viewers", firmId] });
      qc.invalidateQueries({ queryKey: ["viewer-invites", firmId] });
      qc.invalidateQueries({ queryKey: ["client-access"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not send that invitation."),
  });

  const summary =
    scope === "all_clients"
      ? `${email || "This person"} will see every client in this organisation, including ones added later, at ${tierLabel(tier)} level. They will never be able to change anything.`
      : `${email || "This person"} will see ${picked.length} of ${clients.length} client${clients.length === 1 ? "" : "s"} at ${tierLabel(tier)} level. They will never be able to change anything.`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[16rem] flex-1 space-y-1.5">
          <Label htmlFor="viewer-email">Their email address</Label>
          <Input
            id="viewer-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@business.com.au"
          />
        </div>
        <div className="min-w-[11rem] space-y-1.5">
          <Label>Dashboard level</Label>
          <Select value={tier} onValueChange={(v) => setTier(v as DashboardTier)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_TIERS.map((t) => (
                <SelectItem key={t} value={t}>
                  {tierLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            One level for the whole selection. You can change it for a single client afterwards.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Which clients should they see?</Label>
        <RadioGroup value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="selected" id="scope-selected" className="mt-1" />
            <Label htmlFor="scope-selected" className="font-normal">
              Only the clients I tick
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="all_clients" id="scope-all" className="mt-1" />
            <Label htmlFor="scope-all" className="font-normal">
              Every client in this organisation, including ones added later
            </Label>
          </div>
        </RadioGroup>
      </div>

      {scope === "selected" && (
        <div className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => setPicked(allPicked ? [] : clients.map((c) => c.id))}
            >
              {allPicked ? "Untick all" : "Tick all"}
            </button>
            {showSearch && (
              <div className="relative w-56">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search clients"
                  className="h-8 pl-7 text-xs"
                />
              </div>
            )}
          </div>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {visible.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Checkbox
                  id={`pick-${c.id}`}
                  checked={picked.includes(c.id)}
                  onCheckedChange={(v) =>
                    setPicked((prev) =>
                      v === true ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                    )
                  }
                />
                <Label htmlFor={`pick-${c.id}`} className="font-normal">
                  {c.name}
                </Label>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="text-sm text-muted-foreground">No clients match that search.</li>
            )}
          </ul>
        </div>
      )}

      <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{summary}</p>

      <Button
        onClick={() => mut.mutate()}
        disabled={
          mut.isPending || !email || (scope === "selected" && picked.length === 0)
        }
      >
        {mut.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Mail className="mr-2 h-4 w-4" />
        )}
        Send invitation
      </Button>

      {link && (
        <div className="space-y-1.5">
          <Input readOnly value={link} className="font-mono text-xs" />
          <p className="text-xs text-muted-foreground">
            Backup link if the email doesn't arrive — expires in 14 days.
          </p>
        </div>
      )}
    </div>
  );
}
