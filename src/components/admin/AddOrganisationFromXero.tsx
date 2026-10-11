import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createOrganisationFromXero, listAdminOnboardCandidates, startAdminOnboardConnect } from "@/lib/xero/admin-onboard.functions";
import { PackageFields, packagePayload, type OrganisationPackage } from "@/components/admin/OrganisationPackageFields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";

/** The package survives the Xero round trip in this tab only; it is not secret and the server re-checks it. */
export const ONBOARD_PACKAGE_KEY = "ta.adminOnboard.package";

export function savePackage(pkg: OrganisationPackage) {
  try {
    window.sessionStorage.setItem(
      ONBOARD_PACKAGE_KEY,
      JSON.stringify({ clientLimit: pkg.clientLimit, billingMode: pkg.billingMode, advisory: pkg.advisory, consolidation: pkg.consolidation, branding: pkg.branding, whiteLabel: pkg.whiteLabel, addTractionTeam: pkg.addTractionTeam, unticked: pkg.unticked }),
    );
  } catch {
    /* storage unavailable */
  }
}

export function restorePackage(pkg: OrganisationPackage) {
  try {
    const raw = window.sessionStorage.getItem(ONBOARD_PACKAGE_KEY);
    if (!raw) return;
    const v = JSON.parse(raw);
    if (typeof v.clientLimit === "string") pkg.setClientLimit(v.clientLimit.replace(/[^0-9]/g, ""));
    if (v.billingMode === "external" || v.billingMode === "bookkeeping") pkg.setBillingMode(v.billingMode);
    pkg.setAdvisory(!!v.advisory);
    pkg.setConsolidation(!!v.consolidation);
    pkg.setBranding(!!v.branding);
    pkg.setWhiteLabel(!!v.whiteLabel);
    pkg.setAddTractionTeam(v.addTractionTeam !== false);
    if (Array.isArray(v.unticked)) pkg.setUnticked(v.unticked.filter((x: unknown) => typeof x === "string"));
  } catch {
    /* ignore */
  }
}

export function AddOrganisationFromXero({ pkg, pendingId, onBack, onFinished }: { pkg: OrganisationPackage; pendingId: string | null; onBack: () => void; onFinished: () => void }) {
  const start = useServerFn(startAdminOnboardConnect);
  const list = useServerFn(listAdminOnboardCandidates);
  const create = useServerFn(createOrganisationFromXero);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<string[]>([]); // order matters: first = organisation
  const [orgName, setOrgName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [review, setReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidatesQ = useQuery({
    queryKey: ["admin-onboard-candidates", pendingId],
    queryFn: () => list({ data: { pendingId: pendingId! } }),
    enabled: !!pendingId,
    retry: false,
    staleTime: Infinity,
  });
  const candidates = candidatesQ.data?.candidates ?? [];
  const byId = useMemo(() => new Map(candidates.map((c) => [c.tenantId, c])), [candidates]);
  const cap = pkg.limitNum;

  useEffect(() => {
    if (nameTouched) return;
    const first = picked[0] ? byId.get(picked[0]) : undefined;
    setOrgName(first?.name ?? "");
  }, [picked, byId, nameTouched]);

  const connect = useMutation({
    mutationFn: () => start({ data: { origin: window.location.origin } }),
    onSuccess: (res) => {
      savePackage(pkg);
      window.location.href = res.authorizeUrl;
    },
    onError: (e: any) => setError(e?.message ?? "Could not start the Xero sign-in."),
  });

  const submit = useMutation({
    mutationFn: () =>
      create({
        data: {
          pendingId: pendingId!,
          firstTenantId: picked[0]!,
          extraTenantIds: picked.slice(1),
          orgName: orgName.trim(),
          ...packagePayload(pkg),
          ownerEmail: ownerEmail.trim() ? ownerEmail.trim() : null,
        },
      }),
    onSuccess: (res) => {
      try { window.sessionStorage.removeItem(ONBOARD_PACKAGE_KEY); } catch { /* ignore */ }
      if (res.invite?.emailStatus === "queued") toast.success("Organisation created and owner invite sent");
      else if (res.invite) toast.warning(`Organisation created. The owner invite email couldn't be sent${res.invite.inviteUrl ? ` — share this link: ${res.invite.inviteUrl}` : "; invite them from the organisation's settings."}`, { duration: 20000 });
      else toast.success("Organisation created");
      qc.invalidateQueries({ queryKey: ["admin-firms"] });
      qc.invalidateQueries({ queryKey: ["my-firms"] });
      onFinished();
      void navigate({ to: "/firms/$firmId/overview", params: { firmId: res.firmId } });
    },
    onError: (e: any) => setError(e?.message ?? "Could not create the organisation."),
  });

  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => (on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));

  const errorBox = error ? (
    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error}</span>
    </div>
  ) : null;

  // Step 1: package, then Connect to Xero.
  if (!pendingId) {
    return (
      <div className="space-y-5">
        {errorBox}
        <PackageFields pkg={pkg} />
        <p className="text-xs text-muted-foreground">
          Next you'll sign in to Xero. The Xero login is only used to read the files — it never creates or links an owner account.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
          <Button onClick={() => connect.mutate()} disabled={connect.isPending || cap < 1}>
            {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Connect to Xero
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (candidatesQ.isLoading) {
    return <div className="flex items-center justify-center p-6 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading Xero files…</div>;
  }
  if (candidatesQ.error) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{(candidatesQ.error as Error).message}</span>
        </div>
        <DialogFooter><Button variant="outline" onClick={onBack}>Start again</Button></DialogFooter>
      </div>
    );
  }

  const canReview = picked.length >= 1 && picked.length <= cap && orgName.trim().length >= 2 && (!ownerEmail.trim() || ownerEmail.includes("@"));

  if (review) {
    return (
      <div className="space-y-4">
        {errorBox}
        <dl className="space-y-2 rounded-lg border border-border p-3 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Organisation</dt><dd className="font-medium">{orgName.trim()}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Clients</dt><dd className="text-right">{picked.map((id) => byId.get(id)?.name ?? "").join(", ")}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Package</dt><dd className="text-right">{cap} client{cap === 1 ? "" : "s"} · {pkg.billingMode === "external" ? "External" : "Bookkeeping"}{pkg.advisory ? " · Advisory" : ""}{pkg.whiteLabel ? " · White label" : ""}{pkg.advisory && pkg.consolidation ? " · Consolidation" : ""}{pkg.advisory && pkg.branding ? " · Report branding" : ""}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Owner</dt><dd>{ownerEmail.trim() ? `Invite ${ownerEmail.trim()}` : "Invite later from settings"}</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground">Everything is created in one step — if any part fails, nothing is created.</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setReview(false)} disabled={submit.isPending}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
          <Button onClick={() => { setError(null); submit.mutate(); }} disabled={submit.isPending}>
            {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create organisation
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {errorBox}
      <div className="space-y-2">
        <p className="text-sm font-medium">Pick the Xero files</p>
        <p className="text-xs text-muted-foreground">
          The first file you tick names the organisation and becomes its first client. Each extra file becomes another client — up to {cap} in this package.
        </p>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">That Xero login didn't share any files.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {candidates.map((c) => {
              const checked = picked.includes(c.tenantId);
              const full = !checked && picked.length >= cap;
              return (
                <li key={c.tenantId} className={`flex items-center gap-3 px-3 py-2 text-sm ${c.alreadyLinked ? "opacity-60" : ""}`}>
                  <Checkbox id={`t-${c.tenantId}`} checked={checked} disabled={c.alreadyLinked || full} onCheckedChange={(v) => toggle(c.tenantId, !!v)} />
                  <label htmlFor={`t-${c.tenantId}`} className="min-w-0 flex-1 truncate">{c.name}</label>
                  {c.alreadyLinked ? <span className="text-xs text-muted-foreground">Already linked</span> : checked && picked[0] === c.tenantId ? <span className="text-xs text-muted-foreground">First file</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ox-name">Organisation name</Label>
        <Input id="ox-name" value={orgName} onChange={(e) => { setNameTouched(true); setOrgName(e.target.value); }} placeholder="Named from the first file" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ox-owner">Owner email (optional)</Label>
        <Input id="ox-owner" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="Leave blank to invite them later" />
        <p className="text-xs text-muted-foreground">If filled, they get the normal owner invite. Leave blank to invite them later from the organisation's settings.</p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onBack}>Cancel</Button>
        <Button onClick={() => setReview(true)} disabled={!canReview}>Review</Button>
      </DialogFooter>
    </div>
  );
}
