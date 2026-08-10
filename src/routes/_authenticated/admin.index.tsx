import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listFirmsAdmin } from "@/lib/admin.functions";
import { listMyFirms } from "@/lib/firms.functions";
import { adminCreateOrganisation } from "@/lib/invites.functions";
import { getMyContext } from "@/lib/roles.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Building2, Loader2, ShieldAlert, UserPlus, Copy, Check, Shield, SlidersHorizontal, Users, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Organisations Admin — Traction Advisory" },
      { name: "description", content: "Manage Traction Advisory organisations, advisors and dashboard settings." },
      { property: "og:title", content: "Organisations Admin — Traction Advisory" },
      { property: "og:description", content: "Manage Traction Advisory organisations, advisors and dashboard settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type FirmRow = {
  firm_id: string;
  firm_name: string;
  is_always_free: boolean;
  firm_created_at: string;
  tier: string | null;
  status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  connection_count: number;
  recent_error_count: number;
};

const TIER_LIMITS: Record<string, number> = { starter: 5, growth: 10, scale: 20, firm: 50, legacy: 9999 };

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString();
}

function AdminPage() {
  const fetchCtx = useServerFn(getMyContext);
  const fetchFirms = useServerFn(listFirmsAdmin);
  const fetchMyFirms = useServerFn(listMyFirms);
  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const isSuper = ctxQ.data?.isSuperAdmin ?? false;
  const hasAdminAreaAccess = ctxQ.data?.hasAdminAreaAccess ?? isSuper;
  const myFirmsQ = useQuery({
    queryKey: ["my-firms"],
    queryFn: () => fetchMyFirms(),
    enabled: hasAdminAreaAccess,
  });
  const firmsQ = useQuery({
    queryKey: ["admin-firms"],
    queryFn: () => fetchFirms(),
    enabled: isSuper,
  });

  if (ctxQ.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAdminAreaAccess) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Admin access required</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This area is for advisor or admin accounts. Your login is currently a viewer account.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
            </Button>
            <h1 className="text-xl font-semibold">Admin</h1>
            {isSuper ? <Badge variant="secondary">super-admin</Badge> : <Badge variant="outline">advisor admin</Badge>}
          </div>
          {isSuper && <AddOrganisationDialog onCreated={() => firmsQ.refetch()} />}
        </div>

      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <OrganisationsSection
          isSuper={isSuper}
          firms={firmsQ.data?.firms as FirmRow[] | undefined}
          firmsLoading={isSuper ? firmsQ.isLoading : myFirmsQ.isLoading}
          firmsError={isSuper ? firmsQ.error : myFirmsQ.error}
          myFirms={myFirmsQ.data?.firms ?? []}
          onCreated={() => firmsQ.refetch()}
        />

        <AdminQuickLinks isSuper={isSuper} />

        {!isSuper && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Your account has advisor admin access. Organisation-wide billing, security documentation and compliance settings require the super-admin role.
          </div>
        )}

        {isSuper && (
          <p className="text-sm text-muted-foreground">
            Organisation name, tier, usage, billing and error counts only. No Xero org names, balances, or client data are visible from this page — enforced at the database level.
          </p>
        )}

      </main>
    </div>
  );
}

function OrganisationsSection({
  isSuper,
  firms,
  firmsLoading,
  firmsError,
  myFirms,
  onCreated,
}: {
  isSuper: boolean;
  firms: FirmRow[] | undefined;
  firmsLoading: boolean;
  firmsError: unknown;
  myFirms: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const ownFirmIds = new Set(myFirms.map((firm) => firm.id));

  if (firmsLoading) {
    return (
      <section className="space-y-3">
        <SectionTitle />
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading organisations…</div>
      </section>
    );
  }

  if (firmsError) {
    return (
      <section className="space-y-3">
        <SectionTitle />
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Organisations could not load</p>
            <p className="text-sm text-muted-foreground">{(firmsError as Error).message}</p>
          </div>
        </div>
      </section>
    );
  }

  if (!isSuper) {
    return (
      <section className="space-y-3">
        <SectionTitle />
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Organisation name</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {myFirms.map((firm) => (
                <tr key={firm.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{firm.name}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/firms/$firmId" params={{ firmId: firm.id }}>Clients &amp; plan</Link>
                    </Button>
                  </td>

                </tr>
              ))}
              {myFirms.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">No organisations yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <SectionTitle />
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Organisation name</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Usage</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Next bill / trial</th>
              <th className="px-4 py-3">Errors (7d)</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(firms ?? []).map((f) => {
              const limit = f.tier ? TIER_LIMITS[f.tier] ?? null : null;
              return (
                <tr key={f.firm_id} className="border-t">
                  <td className="px-4 py-3">
                    <span className="font-medium">{f.firm_name}</span>
                    {f.is_always_free && <Badge variant="outline" className="mt-1 ml-2">always free</Badge>}
                  </td>
                  <td className="px-4 py-3 capitalize">{f.tier ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {f.connection_count}{limit && limit < 9999 ? ` / ${limit}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={f.status === "active" || f.status === "trialing" ? "default" : "secondary"} className="capitalize">
                      {f.status ?? "—"}
                    </Badge>
                    {f.cancel_at_period_end && <Badge variant="outline" className="ml-1">cancelling</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {f.status === "trialing"
                      ? `trial ends ${fmtDate(f.trial_ends_at)}`
                      : fmtDate(f.current_period_end)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {f.recent_error_count > 0 ? (
                      <span className="text-destructive font-medium">{f.recent_error_count}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {ownFirmIds.has(f.firm_id) && (
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/firms/$firmId" params={{ firmId: f.firm_id }}>Clients</Link>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/admin/firms/$firmId" params={{ firmId: f.firm_id }}>Plan &amp; members</Link>
                      </Button>

                    </div>
                  </td>
                </tr>
              );
            })}
            {(firms ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  <p>No organisations yet.</p>
                  <div className="mt-3 flex justify-center">
                    <AddOrganisationDialog onCreated={onCreated} variant="outline" />
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SectionTitle() {
  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-5 w-5 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Organisations</h2>
    </div>
  );
}

function AdminQuickLinks({ isSuper }: { isSuper: boolean }) {
  const links = [
    ...(isSuper
      ? [
          { title: "Security & Compliance", description: "Open the Xero security documentation and compliance tools.", to: "/admin/security" as const, icon: Shield },
        ]
      : []),
    { title: "Tier widgets", description: "Choose which dashboard cards belong in each tier.", to: "/settings/tiers" as const, icon: SlidersHorizontal },
    { title: "Advisors", description: "Invite advisors and manage advisor access.", to: "/settings/advisors" as const, icon: Users },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((item) => (
        <Link
          key={item.title}
          to={item.to}
          className="group rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </div>
          </div>
          <h2 className="mt-4 font-display text-lg font-semibold leading-tight">{item.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
        </Link>
      ))}
    </div>
  );
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function AddOrganisationDialog({ onCreated, variant = "default" }: { onCreated: () => void; variant?: "default" | "outline" }) {
  const create = useServerFn(adminCreateOrganisation);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tier, setTier] = useState("starter");
  const [status, setStatus] = useState("trialing");
  const [endDate, setEndDate] = useState(isoDate(new Date(Date.now() + 7 * 864e5)));
  const [alwaysFree, setAlwaysFree] = useState(false);
  const [ownerMode, setOwnerMode] = useState<"password" | "invite">("password");
  const [email, setEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState<null | { mode: "password" | "invite"; email: string; password?: string; inviteUrl?: string; emailStatus?: string | null }>(null);
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
          ownerEmail: email,
          ownerMode,
          ownerPassword: ownerMode === "password" ? password : null,
          ownerName: ownerName || null,
        },
      }),
    onSuccess: (res: any) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setDone(
        res.mode === "password"
          ? { mode: "password", email: res.email, password }
          : { mode: "invite", email: res.email, inviteUrl: `${origin}/signup/${res.token}`, emailStatus: res.emailStatus },
      );
      toast.success("Organisation created");
      onCreated();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create the organisation"),
  });

  function reset() {
    setName(""); setTier("starter"); setStatus("trialing");
    setEndDate(isoDate(new Date(Date.now() + 7 * 864e5)));
    setAlwaysFree(false); setOwnerMode("password"); setEmail(""); setOwnerName("");
    setPassword(""); setDone(null); setCopied(false);
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
    email.includes("@") &&
    (ownerMode === "invite" || password.length >= 8);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4 mr-2" /> Add organisation
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add an organisation</DialogTitle>
          <DialogDescription>
            Creates the organisation, its plan and its owner login in one step.
          </DialogDescription>
        </DialogHeader>

        {!done ? (
          <div className="space-y-5">
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

