import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateOrganisation } from "@/lib/invites.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, UserPlus, Copy, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Super-admin dialog that creates an organisation, its plan and (optionally) its owner login. */
export function AddOrganisationDialog({
  onCreated,
  variant = "default",
  size = "sm",
  label = "Add organisation",
}: {
  onCreated?: () => void;
  variant?: "default" | "outline";
  size?: "sm" | "default";
  label?: string;
}) {
  const create = useServerFn(adminCreateOrganisation);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tier, setTier] = useState("starter");
  const [status, setStatus] = useState("trialing");
  const [endDate, setEndDate] = useState(isoDate(new Date(Date.now() + 7 * 864e5)));
  const [alwaysFree, setAlwaysFree] = useState(false);
  const [ownerMode, setOwnerMode] = useState<"password" | "invite" | "none">("none");
  const [email, setEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState<null | { mode: "password" | "invite" | "none"; email?: string | null; password?: string; inviteUrl?: string; emailStatus?: string | null }>(null);
  const [copied, setCopied] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      create({
        data: {
          name,
          tier,
          status,
          trialEndsAt: status === "trialing" ? endDate : null,
          currentPeriodEnd: status === "active" ? endDate : null,
          isAlwaysFree: alwaysFree,
          ownerEmail: ownerMode === "none" ? null : email,
          ownerMode,
          ownerPassword: ownerMode === "password" ? password : null,
          ownerName: ownerName || null,
        },
      }),
    onMutate: () => setErrorMsg(null),
    onSuccess: (res: any) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setDone(
        res.mode === "none"
          ? { mode: "none" }
          : res.mode === "password"
          ? { mode: "password", email: res.email, password }
          : { mode: "invite", email: res.email, inviteUrl: `${origin}/signup/${res.token}`, emailStatus: res.emailStatus },
      );

      toast.success("Organisation created");
      qc.invalidateQueries({ queryKey: ["firms-admin"] });
      qc.invalidateQueries({ queryKey: ["firms-overview"] });
      qc.invalidateQueries({ queryKey: ["my-firms"] });
      onCreated?.();
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Could not create the organisation";
      setErrorMsg(msg);
      toast.error(msg);
    },
  });

  function reset() {
    setName(""); setTier("starter"); setStatus("trialing");
    setEndDate(isoDate(new Date(Date.now() + 7 * 864e5)));
    setAlwaysFree(false); setOwnerMode("none"); setEmail(""); setOwnerName("");
    setPassword(""); setDone(null); setCopied(false); setErrorMsg(null);
  }

  function generatePassword() {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    const bytes = new Uint32Array(14);
    crypto.getRandomValues(bytes);
    for (const b of bytes) out += chars[b % chars.length];
    setPassword(out + "7a");
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied");
  }

  const canSubmit =
    name.trim().length >= 2 &&
    (ownerMode === "none" ||
      (email.includes("@") && (ownerMode === "invite" || password.length >= 8)));

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4 mr-2" /> {label}
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add an organisation</DialogTitle>
          <DialogDescription>
            Creates the organisation, its plan and (optionally) its owner login in one step.
          </DialogDescription>
        </DialogHeader>

        {!done ? (
          <div className="space-y-5">
            {errorMsg && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="o-name">Organisation name</Label>
              <Input id="o-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Accounting" />
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Plan</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tier</Label>
                  <Select value={tier} onValueChange={setTier}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["starter", "growth", "scale", "firm", "free", "legacy"].map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trialing">Trialing</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-date">{status === "trialing" ? "Trial ends" : "Next bill date"}</Label>
                <Input id="o-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="o-free" className="font-normal">Always free</Label>
                <Switch id="o-free" checked={alwaysFree} onCheckedChange={setAlwaysFree} />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Owner access</p>
              <p className="text-xs text-muted-foreground">Optional — you can add the owner later from the organisation page.</p>
              <div className="grid grid-cols-3 gap-2">
                <Button type="button" variant={ownerMode === "none" ? "default" : "outline"} size="sm" onClick={() => setOwnerMode("none")}>
                  Add later
                </Button>
                <Button type="button" variant={ownerMode === "password" ? "default" : "outline"} size="sm" onClick={() => setOwnerMode("password")}>
                  Create login now
                </Button>
                <Button type="button" variant={ownerMode === "invite" ? "default" : "outline"} size="sm" onClick={() => setOwnerMode("invite")}>
                  Send invite
                </Button>
              </div>
              {ownerMode !== "none" && (
                <div className="space-y-1.5">
                  <Label htmlFor="o-email">Owner email</Label>
                  <Input id="o-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              )}
              {ownerMode === "password" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="o-owner">Owner name (optional)</Label>
                    <Input id="o-owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="o-pw">Password</Label>
                    <div className="flex gap-2">
                      <Input id="o-pw" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters, letters and numbers" />
                      <Button type="button" variant="outline" size="sm" onClick={generatePassword}>Generate</Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : done.mode === "none" ? (
          <div className="space-y-2">
            <p className="text-sm">✓ Organisation created with no owner yet. Open the organisation to invite the owner or create their login when you're ready.</p>
          </div>
        ) : done.mode === "password" ? (
          <div className="space-y-2">
            <p className="text-sm">✓ Organisation created. The owner can sign in right now with these details.</p>
            <div className="rounded-md border border-border bg-muted/40 p-3 font-mono text-xs space-y-1">
              <div>{done.email}</div>
              <div>{done.password}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => copyText(`${done.email}\n${done.password}`)}>
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />} Copy credentials
            </Button>
            <p className="text-xs text-muted-foreground">This password is shown once — copy it before closing.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">
              {done.emailStatus === "queued"
                ? "✓ Invite email sent to the owner."
                : done.emailStatus === "suppressed"
                ? "⚠ This address is on the suppression list — share the link manually."
                : "Organisation created. The email couldn't be sent — share this link manually."}
            </p>
            <div className="flex gap-2">
              <Input readOnly value={done.inviteUrl} className="font-mono text-xs" />
              <Button size="icon" variant="outline" onClick={() => copyText(done.inviteUrl!)}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Backup link — expires in 14 days.</p>
          </div>
        )}

        <DialogFooter>
          {!done ? (
            <Button onClick={() => mut.mutate()} disabled={mut.isPending || !canSubmit}>
              {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create organisation
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setOpen(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
