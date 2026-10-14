import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ComingSoonAdmin } from "@/components/admin/ComingSoonAdmin";
import { FirmPageHeader } from "@/components/firm/FirmPageHeader";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCardCatalogue, saveCardEntry, saveCardModule, saveCardStatus } from "@/lib/card-model.functions";
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
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />Loading…</p>
      ) : !catalogue ? (
        <p className="text-sm text-destructive">{(q.error as Error)?.message ?? "Not available"}</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Advisory modules</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {catalogue.modules.map((m) => <ModuleRow key={m.key} module={m} />)}
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Cards</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr><th className="p-3">Card</th><th className="p-3">Status</th><th className="p-3">Package</th><th className="p-3">Module</th><th className="p-3">What the client sees</th><th className="p-3" /></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {catalogue.cards.map((c) => <CardRow key={c.key} card={c} modules={catalogue.modules} />)}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Work in progress: not offered anywhere — hidden from dashboards, menus, reports, Trixie, upgrade offers and the website, and not tickable. Existing client ticks are kept and come back when it is switched to Available. System Administrators see it, labelled, on clients they can already open.
            </p>
          </section>
          <ComingSoonAdmin catalogue={catalogue} />
        </>
      )}
    </PageContainer>
  );
}

function ModuleRow({ module }: { module: CatalogueModule }) {
  const qc = useQueryClient();
  const save = useServerFn(saveCardModule);
  const [label, setLabel] = useState(module.label);
  const [desc, setDesc] = useState(module.description);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setLabel(module.label); setDesc(module.description); }, [module.label, module.description]);
  const dirty = label !== module.label || desc !== module.description;
  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <Input value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} aria-label="Module name" />
      <Textarea value={desc} maxLength={300} rows={2} onChange={(e) => setDesc(e.target.value)} aria-label={`${module.label} description`} />
      <Button size="sm" disabled={!dirty || busy || !label.trim()} onClick={async () => {
        setBusy(true);
        try { await save({ data: { moduleKey: module.key, label, description: desc } }); toast.success("Module saved"); await qc.invalidateQueries({ queryKey: KEY }); }
        catch (e: any) { toast.error(e?.message ?? "Could not save"); } finally { setBusy(false); }
      }}>Save</Button>
    </div>
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
