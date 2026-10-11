import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCardGroups } from "@/lib/card-model.functions";
import { cardLabel, CARD_GROUP_LABEL } from "@/lib/card-labels";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * What an organisation buys and its starting card set — shared by the manual
 * "Add organisation" form and "Start from a Xero file", so both capture the
 * package identically. The database re-checks every rule in set_org_purchase.
 */
export function useOrganisationPackage(open: boolean) {
  const listGroups = useServerFn(listCardGroups);
  // What they are buying.
  const [clientLimit, setClientLimit] = useState("1");
  const [billingMode, setBillingMode] = useState<"bookkeeping" | "external">("bookkeeping");
  const [advisory, setAdvisory] = useState(false);
  const [consolidation, setConsolidation] = useState(false);
  const [branding, setBranding] = useState(false);
  const [whiteLabel, setWhiteLabel] = useState(false);
  // Whether the Traction Advisory team is added as members. Default ticked.
  const [addTractionTeam, setAddTractionTeam] = useState(true);
  // How they want it set up — a starting point for clients added later, never a purchase.
  const [unticked, setUnticked] = useState<string[]>([]);
  const groupsQ = useQuery({
    queryKey: ["card-groups"],
    queryFn: () => (listGroups as any)({ data: {} }),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const groups: { group: string; cards: string[] }[] = (groupsQ.data as any)?.groups ?? [];
  const limitNum = Math.max(0, Math.trunc(Number(clientLimit) || 0));

  /** The groups this purchase pays for. Consolidation only bites above one client. */
  const includedGroups = useMemo(
    () =>
      groups.filter(
        (g) =>
          g.group === "standard" ||
          (g.group === "advisory" && advisory) ||
          (g.group === "consolidation" && advisory && consolidation && limitNum > 1),
      ),
    [groups, advisory, consolidation, limitNum],
  );
  const availableCards = useMemo(
    () => includedGroups.flatMap((g) => g.cards),
    [includedGroups],
  );
  const cardsPayload = useMemo(() => {
    const chosen = availableCards.filter((c) => !unticked.includes(c));
    // No template unless something was actually unticked: absent means "every
    // card the purchase allows", exactly as before.
    return chosen.length === availableCards.length ? null : chosen;
  }, [availableCards, unticked]);

  const reset = () => {
    setClientLimit("1"); setBillingMode("bookkeeping");
    setAdvisory(false); setConsolidation(false); setBranding(false); setWhiteLabel(false); setUnticked([]); setAddTractionTeam(true);
  };
  return { clientLimit,setClientLimit,billingMode,setBillingMode,advisory,setAdvisory,consolidation,setConsolidation,branding,setBranding,whiteLabel,setWhiteLabel,addTractionTeam,setAddTractionTeam,unticked,setUnticked,groupsQ,groups,limitNum,includedGroups,availableCards,cardsPayload, reset };
}

export type OrganisationPackage = ReturnType<typeof useOrganisationPackage>;

/** The package payload the server functions accept. */
export function packagePayload(pkg: OrganisationPackage) {
  return {
    clientLimit: pkg.limitNum,
    billingMode: pkg.billingMode,
    advisory: pkg.advisory,
    consolidation: pkg.advisory && pkg.consolidation,
    branding: pkg.advisory && pkg.branding,
    whiteLabel: pkg.whiteLabel,
    cards: pkg.cardsPayload,
    addTractionTeam: pkg.addTractionTeam,
  };
}

export function PackageFields({ pkg }: { pkg: OrganisationPackage }) {
  const { clientLimit,setClientLimit,billingMode,setBillingMode,advisory,setAdvisory,consolidation,setConsolidation,branding,setBranding,whiteLabel,setWhiteLabel,unticked,setUnticked,groupsQ,groups,limitNum,includedGroups,availableCards,cardsPayload } = pkg;
  void groups; void availableCards; void cardsPayload;
  return (
    <>
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">What they are buying</p>
      <p className="text-xs text-muted-foreground">
        This is what they pay for. It decides what exists for every client in the organisation.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="o-clients">Clients</Label>
          <Input
            id="o-clients"
            inputMode="numeric"
            value={clientLimit}
            onChange={(e) => setClientLimit(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Billing</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant={billingMode === "bookkeeping" ? "default" : "outline"} onClick={() => setBillingMode("bookkeeping")}>
              Bookkeeping
            </Button>
            <Button type="button" size="sm" variant={billingMode === "external" ? "default" : "outline"} onClick={() => setBillingMode("external")}>
              External
            </Button>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={advisory}
            onCheckedChange={(v) => {
              const on = !!v;
              setAdvisory(on);
              if (!on) { setConsolidation(false); setBranding(false); }
            }}
          />
          <span>Advisory</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={whiteLabel} onCheckedChange={(v) => setWhiteLabel(!!v)} />
          <span>
            White label
            <span className="block text-xs text-muted-foreground">
              Uses the organisation's name and logo in its app, organisation emails and new reports. Independent of Advisory and Branding.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={consolidation}
            disabled={!advisory}
            onCheckedChange={(v) => setConsolidation(!!v)}
          />
          <span>
            Consolidation
            <span className="block text-xs text-muted-foreground">
              {!advisory
                ? "Needs Advisory."
                : limitNum > 1
                ? "Groups this organisation's clients together."
                : "Only does anything with more than one client."}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={branding}
            disabled={!advisory}
            onCheckedChange={(v) => setBranding(!!v)}
          />
          <span>
            Report branding
            <span className="block text-xs text-muted-foreground">
              {advisory ? "Client logos on reports." : "Needs Advisory."}
            </span>
          </span>
        </label>
      </div>
    </div>

    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">How they want it set up</p>
      <p className="text-xs text-muted-foreground">
        These ticks are not part of what they pay for. They are the starting point for clients
        added from now on — unticking a card here does not reduce what they have bought, and you
        can turn it back on for any client at any time.
      </p>
      {groupsQ.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading cards…</p>
      ) : includedGroups.length === 0 ? (
        <p className="text-xs text-muted-foreground">No cards to show yet.</p>
      ) : (
        <div className="space-y-3">
          {includedGroups.map((g) => (
            <div key={g.group} className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {CARD_GROUP_LABEL[g.group] ?? g.group}
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {g.cards.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={!unticked.includes(c)}
                      onCheckedChange={(v) =>
                        setUnticked((prev) =>
                          v ? prev.filter((x) => x !== c) : [...prev, c],
                        )
                      }
                    />
                    <span>{cardLabel(c)}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
      <Checkbox checked={pkg.addTractionTeam} onCheckedChange={(v) => pkg.setAddTractionTeam(!!v)} />
      <span>
        Traction Advisory looks after this organisation
        <span className="block text-xs text-muted-foreground">
          {pkg.addTractionTeam
            ? "The Traction Advisory team are added as Staff, so they can work on every client."
            : "The Traction Advisory team are not added. Only you and the Organisation Owner you invite will be members."}
        </span>
      </span>
    </label>
    </>
  );
}
