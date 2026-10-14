import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getClientCardSetup,
  setClientCardTick,
  copyClientCardSetup,
  setClientModuleTick,
} from "@/lib/card-model.functions";
import {
  activeModules,
  EMPTY_CATALOGUE,
  moduleCards,
  moduleState,
  packageCards,
  REPORT_SECTION_LABEL,
  reportSectionsForCards,
  type CardCatalogue,
} from "@/lib/cards/catalogue";
import { getPublicWebsiteSettings } from "@/lib/website-settings.functions";
import { listClients } from "@/lib/clients.functions";
import { cardLabel } from "@/lib/card-labels";
import { AdvisoryEnquiry } from './AdvisoryEnquiry';

/**
 * Client "Package": Standard (included), Advisory modules and Consolidation,
 * from the database card catalogue. Module ticks write the same client_cards
 * list through public.set_client_module; per-card overrides through
 * public.set_client_card_enabled. Both re-check aal2 and Organisation Owner or
 * System Administrator, and audit. canManage is a presentation signal only.
 */
export function ClientCardSetupPanel({
  clientId,
  firmId,
}: {
  clientId: string;
  firmId?: string | null;
}) {
  const qc = useQueryClient();
  const fetchSetup = useServerFn(getClientCardSetup);
  const tick = useServerFn(setClientCardTick);
  const tickModule = useServerFn(setClientModuleTick);
  const [busy, setBusy] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const q = useQuery({
    queryKey: ["client-card-setup", clientId],
    queryFn: () => fetchSetup({ data: { clientId } }),
    retry: false,
  });

  const visible = useMemo(
    () => new Set<string>((q.data as any)?.visible ?? []),
    [(q.data as any)?.visible],
  );

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["client-card-setup", clientId] }),
      qc.invalidateQueries({ queryKey: ["client-widgets", clientId] }),
      qc.invalidateQueries({ queryKey: ["effective-widgets", clientId] }),
      qc.invalidateQueries({ queryKey: ["client-widget-matrix", clientId] }),
    ]);

  async function onToggle(card: string, next: boolean) {
    if (busy) return;
    setBusy(card);
    try {
      await tick({ data: { clientId, card, enabled: next } });
      await refresh();
      toast.success(`${cardLabel(card)} switched ${next ? "on" : "off"} for this client.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not change this card");
    } finally {
      setBusy(null);
    }
  }

  async function onModule(moduleKey: string, label: string, next: boolean) {
    if (busy) return;
    setBusy(`module:${moduleKey}`);
    try {
      await tickModule({ data: { clientId, moduleKey, enabled: next } });
      await refresh();
      toast.success(`${label} switched ${next ? "on" : "off"} for this client.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not change this module");
    } finally {
      setBusy(null);
    }
  }

  if (q.isLoading) {
    return (
      <p className="text-xs text-muted-foreground">
        <Loader2 className="mr-2 inline h-3 w-3 animate-spin" /> Loading package…
      </p>
    );
  }
  if (q.error || !q.data || (q.data as any).modelActive !== true) {
    return (
      <p className="text-xs text-muted-foreground">
        {(q.error as Error)?.message ?? "Package not available for this client."}
      </p>
    );
  }

  const d = q.data as any;
  const catalogue = (d.catalogue ?? EMPTY_CATALOGUE) as CardCatalogue;
  const canManage = d.canManage === true;
  const available = new Set((d.available ?? []) as string[]);
  const standard = catalogue.cards.filter((c) => c.package === "standard");
  const modules = activeModules(catalogue)
    .map((m) => ({ ...m, cards: moduleCards(catalogue, m.key).filter((c) => available.has(c)) }))
    .filter((m) => m.cards.length > 0);
  const consolidation = packageCards(catalogue, "consolidation").filter((c) => available.has(c));
  const advancedCards = catalogue.cards.filter((c) => available.has(c.key));

  return (
    <div className="space-y-5">
      {firmId && <AdvisoryEnquiry firmId={firmId} compact/>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-xs text-muted-foreground">
          What this client's dashboard includes. Only what the organisation has bought is shown.
          {canManage
            ? " Ticking a module switches on all its cards for this client."
            : " Only the Organisation Owner can change this."}
        </p>
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => setCopyOpen(true)}>
            <Copy className="mr-2 h-3.5 w-3.5" />
            Copy to other clients
          </Button>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Standard — included</p>
        <ul className="space-y-1 rounded-xl border border-border px-4 py-3">
          {standard.map((c) => (
            <li key={c.key} className="text-sm">
              <span className="font-medium">{c.label}</span>
              <span className="text-muted-foreground"> — {c.description}</span>
            </li>
          ))}
        </ul>
      </div>

      {modules.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Advisory modules</p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {modules.map((m) => {
              const state = moduleState(m.cards, visible);
              return (
                <li key={m.key} className="flex items-start gap-3 px-4 py-3">
                  <Checkbox
                    id={`module-${m.key}`}
                    className="mt-0.5"
                    checked={state === "on" ? true : state === "partial" ? "indeterminate" : false}
                    disabled={!canManage || busy !== null}
                    onCheckedChange={() => onModule(m.key, m.label, state !== "on")}
                    aria-label={`${m.label} module for this client`}
                  />
                  <label htmlFor={`module-${m.key}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block text-sm font-medium">
                      {m.label}
                      {state === "partial" && <span className="ml-2 text-xs font-normal text-muted-foreground">Some cards on</span>}
                    </span>
                    <span className="block text-xs text-muted-foreground">{m.description}</span>
                    <span className="block text-xs text-muted-foreground">
                      {m.cards.map((c) => catalogue.cards.find((x) => x.key === c)?.label ?? cardLabel(c)).join(" · ")}
                    </span>
                    {canManage && <ModuleReportLine catalogue={catalogue} cards={m.cards} />}
                  </label>
                  {busy === `module:${m.key}` && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {canManage && modules.length === 0 && <AdvisoryTalkToUs />}

      {consolidation.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Consolidation</p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {consolidation.map((card) => {
              const entry = catalogue.cards.find((c) => c.key === card);
              return (
                <li key={card} className="flex items-start gap-3 px-4 py-3">
                  <Checkbox
                    id={`cons-${card}`}
                    className="mt-0.5"
                    checked={visible.has(card)}
                    disabled={!canManage || busy !== null}
                    onCheckedChange={(v) => onToggle(card, v === true)}
                  />
                  <label htmlFor={`cons-${card}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block text-sm font-medium">{entry?.label ?? cardLabel(card)}</span>
                    <span className="block text-xs text-muted-foreground">{entry?.description}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {canManage && (
        <details className="rounded-xl border border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Advanced — individual cards</summary>
          <ul className="divide-y divide-border border-t border-border">
            {advancedCards.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{visible.has(c.key) ? "On" : "Off for this client"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {busy === c.key && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  <Switch
                    checked={visible.has(c.key)}
                    disabled={busy !== null}
                    onCheckedChange={(v) => onToggle(c.key, v)}
                    aria-label={`${c.label} for this client`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {canManage && (
        <CopyToClientsDialog
          open={copyOpen}
          onOpenChange={setCopyOpen}
          clientId={clientId}
          firmId={firmId}
          onCopied={() => {
            qc.invalidateQueries({ queryKey: ["client-card-setup"] });
            qc.invalidateQueries({ queryKey: ["client-widgets"] });
          }}
        />
      )}
    </div>
  );
}

function CopyToClientsDialog({
  open,
  onOpenChange,
  clientId,
  firmId,
  onCopied,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  firmId?: string | null;
  onCopied: () => void;
}) {
  const fetchClients = useServerFn(listClients);
  const copy = useServerFn(copyClientCardSetup);
  const [chosen, setChosen] = useState<string[]>([]);

  const q = useQuery({
    queryKey: ["clients-for-card-copy", firmId ?? "mine"],
    queryFn: () => fetchClients({ data: firmId ? { firmId } : {} }),
    enabled: open,
    retry: false,
  });

  const others = (((q.data as any)?.clients ?? []) as any[]).filter((c) => c.id !== clientId);

  const mut = useMutation({
    mutationFn: () => copy({ data: { fromClientId: clientId, toClientIds: chosen } }),
    onSuccess: (r: any) => {
      toast.success(
        `Card setup copied to ${r.copied} client${r.copied === 1 ? "" : "s"}.`,
      );
      setChosen([]);
      onOpenChange(false);
      onCopied();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not copy the card setup"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Copy this card setup</DialogTitle>
          <DialogDescription>
            Replaces the ticked cards on each client you choose with this client's. Only clients in
            the same organisation can be chosen, and each still shows only what the organisation has
            bought.
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" /> Loading clients…
          </p>
        ) : others.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            There are no other clients in this organisation.
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setChosen(others.map((c) => c.id))}
              >
                Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setChosen([])}>
                Clear
              </Button>
            </div>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {others.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm">
                    <Checkbox
                      checked={chosen.includes(c.id)}
                      onCheckedChange={() =>
                        setChosen((prev) =>
                          prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                        )
                      }
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={mut.isPending || chosen.length === 0}
            onClick={() => mut.mutate()}
          >
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Copy to {chosen.length || "…"} client{chosen.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Practice-only: which monthly report sections a module adds. */
function ModuleReportLine({ catalogue, cards }: { catalogue: CardCatalogue; cards: string[] }) {
  const standard = reportSectionsForCards(catalogue, packageCards(catalogue, "standard"));
  const adds = reportSectionsForCards(catalogue, cards).filter((s) => !standard.includes(s));
  return (
    <span className="mt-1 block text-xs text-muted-foreground">
      Monthly report:{" "}
      {adds.length ? `adds ${adds.map((s) => REPORT_SECTION_LABEL[s] ?? s).join(", ")}` : "adds no report sections yet (dashboard only)"}
    </span>
  );
}

/** Practice-only note when the organisation hasn't bought Advisory. */
function AdvisoryTalkToUs() {
  const fetchSettings = useServerFn(getPublicWebsiteSettings);
  const q = useQuery({ queryKey: ["public-website-settings"], queryFn: () => fetchSettings(), retry: false, staleTime: 300_000 });
  const url = (q.data as any)?.calendlyUrl as string | null | undefined;
  return (
    <p className="rounded-xl border border-border px-4 py-3 text-xs text-muted-foreground">
      Cash flow, Profit, Tax & compliance and Bookkeeping checks modules are available with Advisory.{" "}
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
          Talk to us
        </a>
      ) : (
        "Talk to us."
      )}
    </p>
  );
}

/**
 * Report editor note for the practice (Organisation Owner / System
 * Administrator only — canManage from me_can_manage_cards). Business Owners,
 * Staff and Viewers never see it. Never printed in the client-facing report.
 */
export function ReportSectionsUpsell({ clientId }: { clientId: string }) {
  const fetchSetup = useServerFn(getClientCardSetup);
  const q = useQuery({ queryKey: ["client-card-setup", clientId], queryFn: () => fetchSetup({ data: { clientId } }), retry: false });
  const d = q.data as any;
  if (!d || d.modelActive !== true || d.canManage !== true) return null;
  const catalogue = (d.catalogue ?? EMPTY_CATALOGUE) as CardCatalogue;
  const visible = new Set<string>(d.visible ?? []);
  const available = new Set<string>(d.available ?? []);
  const unticked = activeModules(catalogue)
    .map((m) => ({ ...m, cards: moduleCards(catalogue, m.key).filter((c) => available.has(c)) }))
    .filter((m) => m.cards.length > 0 && moduleState(m.cards, visible) !== "on");
  const hasAdvisory = catalogue.cards.some((c) => c.package === "advisory" && available.has(c.key));
  if (!hasAdvisory) return <div className="mt-4"><AdvisoryTalkToUs /></div>;
  if (unticked.length === 0) return null;
  const standard = reportSectionsForCards(catalogue, packageCards(catalogue, "standard"));
  return (
    <div className="mt-4 rounded-xl border border-border px-4 py-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">For your practice — not shown to the client</p>
      <ul className="mt-1 space-y-0.5">
        {unticked.map((m) => {
          const adds = reportSectionsForCards(catalogue, m.cards).filter((s) => !standard.includes(s));
          return (
            <li key={m.key}>
              Ticking <span className="font-medium">{m.label}</span> in Client settings → Package{" "}
              {adds.length ? `adds ${adds.map((s) => REPORT_SECTION_LABEL[s] ?? s).join(", ")} to new reports.` : "adds dashboard cards; no report sections yet."}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
