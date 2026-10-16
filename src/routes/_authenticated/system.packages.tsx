import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ComingSoonAdmin } from "@/components/admin/ComingSoonAdmin";
import { FirmPageHeader } from "@/components/firm/FirmPageHeader";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCardCatalogue, moveCardModule, saveCardComingSoon, saveCardEntry, saveCardModule, saveCardStatus } from "@/lib/card-model.functions";
import { Switch } from "@/components/ui/switch";
import { adminGetBusinessHealthRelease, adminSetBusinessHealthRelease } from "@/lib/admin.functions";
import { PACKAGE_LABEL, type CardPackage, type CatalogueCard, type CatalogueModule } from "@/lib/cards/catalogue";

export const Route = createFileRoute("/_authenticated/system/packages")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Packages & modules — System Admin" },
      { name: "description", content: "Which package and Advisory module each dashboard card belongs to." },
      { property: "og:title", content: "Packages & modules — System Admin" },
      { property: "og:description", content: "Card packages, Advisory modules and descriptions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PackagesPage,
});

const KEY = ["card-catalogue", "with-wip"];

function PackagesPage() {
  const fetchCatalogue = useServerFn(getCardCatalogue);
  const q = useQuery({ queryKey: KEY, queryFn: () => fetchCatalogue({ data: { includeWip: true } }), retry: false });
  const catalogue = q.data?.catalogue;
  return (
    <PageContainer className="space-y-6">
      <FirmPageHeader
        title="Packages & modules"
        description="Moving a card changes what every organisation's purchase includes, immediately. Each change is recorded in the audit log."
      />
      <BusinessHealthRelease />
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />Loading…</p>
      ) : !catalogue ? (
        <p className="text-sm text-destructive">{(q.error as Error)?.message ?? "Not available"}</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Advisory modules</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr><th className="p-3">Module</th><th className="p-3">Description</th><th className="p-3" /></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {catalogue.modules.map((m, i) => (
                    <ModuleRow key={m.key} module={m} isFirst={i === 0} isLast={i === catalogue.modules.length - 1} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Cards</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr><th className="p-3">Card</th><th className="p-3">Status</th><th className="p-3">Coming soon</th><th className="p-3">Package</th><th className="p-3">Module</th><th className="p-3">What the client sees</th><th className="p-3" /></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {catalogue.cards.map((c) => <CardRow key={c.key} card={c} modules={catalogue.modules} />)}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Work in progress: not offered anywhere — hidden from dashboards, menus, reports, Trixie, upgrade offers and the website, and not tickable. Existing client ticks are kept and come back when it is switched to Available. Organisations with early access see it, labelled, on clients they tick.
            </p>
          </section>
          <ComingSoonAdmin catalogue={catalogue} />
        </>
      )}
    </PageContainer>
  );
}

function BusinessHealthRelease() {
  const qc = useQueryClient();
  const get = useServerFn(adminGetBusinessHealthRelease);
  const set = useServerFn(adminSetBusinessHealthRelease);
  const q = useQuery({ queryKey: ["business-health-release"], queryFn: () => get(), retry: false });
  const [saving, setSaving] = useState(false);
  const released = q.data?.released === true;
  const change = async (v: boolean) => {
    setSaving(true);
    try {
      await set({ data: { released: v } });
      toast.success(v ? "Business health released to clients" : "Business health is practice only again");
      await qc.invalidateQueries({ queryKey: ["business-health-release"] });
      await qc.invalidateQueries({ queryKey: ["business-health-visibility"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save that.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="min-w-0 max-w-2xl space-y-1">
        <h2 className="text-base font-semibold">Business health — release to clients</h2>
        <p className="text-sm text-muted-foreground">
          Off: the card and client-list badge show to the practice and Viewers only, labelled "Practice only", and new monthly reports leave it out.
          On: Business Owners see it too, and new monthly reports include it. Reports already finalised or sent never change. Each change is recorded in the audit log.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {saving || q.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
        <Switch
          id="bh-release"
          checked={released}
          disabled={saving || q.isLoading || !!q.error}
          onCheckedChange={(v) => change(v === true)}
          aria-label="Release Business health to clients"
        />
        <label htmlFor="bh-release" className="text-sm">{released ? "Released" : "Practice only"}</label>
      </div>
      {q.error ? <p className="w-full text-sm text-destructive">The setting could not be read.</p> : null}
    </section>
  );
}

function ModuleRow({ module, isFirst, isLast }: { module: CatalogueModule; isFirst: boolean; isLast: boolean }) {
  const qc = useQueryClient();
  const save = useServerFn(saveCardModule);
  const move = useServerFn(moveCardModule);
  const [label, setLabel] = useState(module.label);
  const [desc, setDesc] = useState(module.description);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setLabel(module.label); setDesc(module.description); }, [module.label, module.description]);
  const dirty = label !== module.label || desc !== module.description;
  const onMove = async (direction: "up" | "down") => {
    setBusy(true);
    try { await move({ data: { moduleKey: module.key, direction } }); await qc.invalidateQueries({ queryKey: KEY }); }
    catch (e: any) { toast.error(e?.message ?? "Could not move"); } finally { setBusy(false); }
  };
  return (
    <tr className="align-top">
      <td className="p-3">
        <div className="flex items-center gap-1">
          <div className="flex flex-col">
            <Button variant="ghost" size="icon" className="h-5 w-5" disabled={busy || isFirst} onClick={() => onMove("up")} aria-label={`Move ${module.label} up`}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" disabled={busy || isLast} onClick={() => onMove("down")} aria-label={`Move ${module.label} down`}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input value={label} maxLength={60} className="w-44" onChange={(e) => setLabel(e.target.value)} aria-label="Module name" />
        </div>
      </td>
      <td className="p-3"><Textarea value={desc} maxLength={300} rows={1} className="min-w-64" onChange={(e) => setDesc(e.target.value)} aria-label={`${module.label} description`} /></td>
      <td className="p-3">
        <Button size="sm" disabled={!dirty || busy || !label.trim()} onClick={async () => {
          setBusy(true);
          try { await save({ data: { moduleKey: module.key, label, description: desc } }); toast.success("Module saved"); await qc.invalidateQueries({ queryKey: KEY }); }
          catch (e: any) { toast.error(e?.message ?? "Could not save"); } finally { setBusy(false); }
        }}>Save</Button>
      </td>
    </tr>
  );
}

function ComingSoonTick({ card }: { card: CatalogueCard }) {
  const qc = useQueryClient();
  const save = useServerFn(saveCardComingSoon);
  const [busy, setBusy] = useState(false);
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <Checkbox
        checked={!card.comingSoonHidden}
        disabled={busy}
        aria-label={`${card.label} listed in Coming soon`}
        onCheckedChange={async (v) => {
          setBusy(true);
          try {
            await save({ data: { cardKey: card.key, hidden: v !== true } });
            toast.success(`${card.label}: ${v === true ? "left out of Coming soon" : "listed in Coming soon"}`);
            await qc.invalidateQueries({ queryKey: KEY });
          } catch (e: any) { toast.error(e?.message ?? "Could not save"); } finally { setBusy(false); }
        }}
      />
      Listed
    </label>
  );
}

function StatusSelect({ card }: { card: CatalogueCard }) {
  const qc = useQueryClient();
  const save = useServerFn(saveCardStatus);
  const [busy, setBusy] = useState(false);
  return (
    <Select value={card.status ?? "available"} disabled={busy} onValueChange={async (v) => {
      setBusy(true);
      try { await save({ data: { cardKey: card.key, status: v as "available" | "wip" } }); toast.success(`${card.label}: ${v === "wip" ? "Work in progress" : "Available"}`); await qc.invalidateQueries({ queryKey: ["card-catalogue"] }); }
      catch (e: any) { toast.error(e?.message ?? "Could not save"); } finally { setBusy(false); }
    }}>
      <SelectTrigger className="w-40" aria-label={`${card.label} status`}><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="available">Available</SelectItem><SelectItem value="wip">Work in progress</SelectItem></SelectContent>
    </Select>
  );
}

function CardRow({ card, modules }: { card: CatalogueCard; modules: CatalogueModule[] }) {
  const qc = useQueryClient();
  const save = useServerFn(saveCardEntry);
  const [pkg, setPkg] = useState<CardPackage>(card.package);
  const [mod, setMod] = useState<string | null>(card.module);
  const [desc, setDesc] = useState(card.description);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPkg(card.package); setMod(card.module); setDesc(card.description); }, [card.package, card.module, card.description]);
  const dirty = pkg !== card.package || (pkg === "advisory" && mod !== card.module) || desc !== card.description;
  const valid = pkg !== "advisory" || !!mod;
  return (
    <tr className="align-top">
      <td className="p-3 font-medium">{card.label}</td>
      <td className="p-3"><StatusSelect card={card} /></td>
      <td className="p-3">{card.status === "wip" ? <ComingSoonTick card={card} /> : <span className="text-muted-foreground">—</span>}</td>
      <td className="p-3">
        <Select value={pkg} onValueChange={(v) => { setPkg(v as CardPackage); if (v !== "advisory") setMod(null); }}>
          <SelectTrigger className="w-36" aria-label={`${card.label} package`}><SelectValue /></SelectTrigger>
          <SelectContent>{(Object.keys(PACKAGE_LABEL) as CardPackage[]).map((p) => <SelectItem key={p} value={p}>{PACKAGE_LABEL[p]}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="p-3">
        {pkg === "advisory" ? (
          <Select value={mod ?? ""} onValueChange={setMod}>
            <SelectTrigger className="w-44" aria-label={`${card.label} module`}><SelectValue placeholder="Choose module" /></SelectTrigger>
            <SelectContent>{modules.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        ) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="p-3"><Textarea value={desc} maxLength={300} rows={2} className="min-w-64" onChange={(e) => setDesc(e.target.value)} aria-label={`${card.label} description`} /></td>
      <td className="p-3">
        <Button size="sm" disabled={!dirty || !valid || busy} onClick={async () => {
          setBusy(true);
          try { await save({ data: { cardKey: card.key, package: pkg, moduleKey: pkg === "advisory" ? mod : null, description: desc } }); toast.success(`${card.label} saved`); await qc.invalidateQueries({ queryKey: KEY }); }
          catch (e: any) { toast.error(e?.message ?? "Could not save"); } finally { setBusy(false); }
        }}>Save</Button>
      </td>
    </tr>
  );
}
