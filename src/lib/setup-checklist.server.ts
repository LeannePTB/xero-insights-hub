/**
 * Client setup checklist — what still needs a decision on a client.
 *
 * Read-only reasoning over configuration the app already stores. Every read
 * goes through the caller's session, so RLS decides which clients can be seen
 * (invariants 1 and 6): there is no access rule restated here, and nothing in
 * this file grants anything.
 *
 * Deliberate answers clear an item permanently:
 *  - `not_registered` on a lodgement cycle is a real answer, never a flag.
 *  - Cost classification switched off is a real answer.
 *  - Anything a preparer confirms is stored in `clients.setup_ack`, written
 *    through the same `clients` write policies as the client's name.
 */

export const SETUP_ITEMS = [
  "xero_file",
  "lodgement_cycles",
  "pl_basis",
  "cost_classification",
  "statutory_accounts",
] as const;

export type SetupItemKey = (typeof SETUP_ITEMS)[number];

/** `done` and `not_applicable` need nothing. `unknown` cannot be decided yet. */
export type SetupStatus = "done" | "needs_attention" | "not_applicable" | "unknown";

export type SetupItem = {
  key: SetupItemKey;
  title: string;
  status: SetupStatus;
  /** One plain sentence: what is missing, or what was decided. */
  detail: string;
  /** Hash of the settings section that fixes it. */
  anchor: string;
  /** When set, the item can be cleared with a deliberate answer. */
  acknowledge?: { label: string; choice: string; note: string };
};

export type SetupChecklist = {
  clientId: string;
  items: SetupItem[];
  /** Items genuinely needing a decision. */
  outstanding: number;
  /** Short labels for the client list badge. */
  outstandingTitles: string[];
};

type AckRecord = Record<string, { at?: string; by?: string; choice?: string } | undefined>;

type ClientRow = {
  id: string;
  gst_cycle: string | null;
  payg_withholding_cycle: string | null;
  report_basis: string | null;
  cost_classification_enabled: boolean | null;
  setup_ack: AckRecord | null;
  client_xero_orgs?: { id: string }[] | null;
};

const CLIENT_COLUMNS =
  "id, gst_cycle, payg_withholding_cycle, report_basis, cost_classification_enabled, setup_ack, client_xero_orgs(id)";

function ackedAt(ack: AckRecord | null, key: string): string | null {
  const entry = ack?.[key];
  return entry?.at ?? null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function basisLabel(basis: string | null): string {
  return basis === "cash" ? "Cash" : "Accrual";
}

/**
 * Build the checklist for a set of clients in one pass.
 *
 * `clientIds` is a filter, never a grant (invariant 4): rows the caller may not
 * read simply do not come back, and no checklist is produced for them.
 */
export async function setupChecklists(
  supabase: any,
  clientIds: string[],
): Promise<Map<string, SetupChecklist>> {
  const out = new Map<string, SetupChecklist>();
  if (clientIds.length === 0) return out;

  const [clientsRes, statutoryRes, countsRes] = await Promise.all([
    supabase.from("clients").select(CLIENT_COLUMNS).in("id", clientIds),
    supabase.from("client_statutory_accounts").select("client_id, category").in("client_id", clientIds),
    supabase.rpc("client_setup_account_counts", { _client_ids: clientIds }),
  ]);
  if (clientsRes.error) throw new Error(clientsRes.error.message);
  if (statutoryRes.error) throw new Error(statutoryRes.error.message);
  if (countsRes.error) throw new Error(countsRes.error.message);

  const categoriesByClient = new Map<string, Set<string>>();
  for (const row of (statutoryRes.data ?? []) as any[]) {
    const set = categoriesByClient.get(row.client_id) ?? new Set<string>();
    set.add(String(row.category));
    categoriesByClient.set(row.client_id, set);
  }

  const countsByClient = new Map<string, { expense: number; classified: number }>();
  for (const row of (countsRes.data ?? []) as any[]) {
    countsByClient.set(row.client_id as string, {
      expense: Number(row.expense_accounts ?? 0),
      classified: Number(row.classified_accounts ?? 0),
    });
  }

  for (const client of (clientsRes.data ?? []) as ClientRow[]) {
    out.set(
      client.id,
      buildChecklist(
        client,
        categoriesByClient.get(client.id) ?? new Set<string>(),
        countsByClient.get(client.id) ?? { expense: 0, classified: 0 },
      ),
    );
  }
  return out;
}

export async function setupChecklist(supabase: any, clientId: string): Promise<SetupChecklist> {
  const map = await setupChecklists(supabase, [clientId]);
  const found = map.get(clientId);
  if (!found) throw new Error("Client not found.");
  return found;
}

function buildChecklist(
  client: ClientRow,
  storedCategories: Set<string>,
  counts: { expense: number; classified: number },
): SetupChecklist {
  const ack = client.setup_ack ?? {};
  const linkedFiles = (client.client_xero_orgs ?? []).length;
  const items: SetupItem[] = [];

  // 1. A linked Xero file. Everything else depends on it.
  items.push(
    linkedFiles > 0
      ? {
          key: "xero_file",
          title: "Xero file",
          status: "done",
          detail: `${linkedFiles} Xero file${linkedFiles === 1 ? "" : "s"} linked.`,
          anchor: "xero-organisations",
        }
      : {
          key: "xero_file",
          title: "Xero file",
          status: "needs_attention",
          detail: "No Xero file is linked, so no figures can be read for this client.",
          anchor: "xero-organisations",
        },
  );

  // 2. Lodgement cycles. `not_registered` is a real answer and never a flag.
  const gstUnset = client.gst_cycle == null;
  const paygUnset = client.payg_withholding_cycle == null;
  items.push({
    key: "lodgement_cycles",
    title: "Lodgement cycles",
    status: gstUnset || paygUnset ? "needs_attention" : "done",
    detail:
      gstUnset && paygUnset
        ? "Neither the GST cycle nor the PAYG withholding cycle has been set."
        : gstUnset
          ? "The GST cycle has not been set."
          : paygUnset
            ? "The PAYG withholding cycle has not been set."
            : "GST and PAYG withholding cycles are both set.",
    anchor: "lodgement-cycles",
  });

  // 3. Profit & Loss basis. The column defaults to accrual, so the stored value
  // alone cannot tell a choice from a default — only a recorded confirmation
  // can, which is what `setup_ack.pl_basis` holds.
  const basisAck = ackedAt(ack, "pl_basis");
  items.push({
    key: "pl_basis",
    title: "Profit & Loss basis",
    status: basisAck ? "done" : "needs_attention",
    detail: basisAck
      ? `${basisLabel(client.report_basis)}, confirmed ${formatDate(basisAck)}.`
      : `Set to ${basisLabel(client.report_basis)}, which is also the default — nobody has confirmed it is right for this client.`,
    anchor: "report-basis",
    acknowledge: basisAck
      ? undefined
      : {
          label: `Confirm ${basisLabel(client.report_basis)} is right`,
          choice: `confirmed_${client.report_basis ?? "accrual"}`,
          note: "Records who confirmed the basis and when. Changing the basis later records the new choice.",
        },
  });

  // 4. Cost classification. The toggle is the deliberate "not applicable".
  if (client.cost_classification_enabled === false) {
    items.push({
      key: "cost_classification",
      title: "Cost classification",
      status: "not_applicable",
      detail:
        "Turned off deliberately. Break-even treats all operating expenses as fixed, and cost of sales as variable.",
      anchor: "cost-classification",
    });
  } else if (linkedFiles === 0) {
    items.push({
      key: "cost_classification",
      title: "Cost classification",
      status: "unknown",
      detail: "Link a Xero file first — expense accounts come from the file.",
      anchor: "xero-organisations",
    });
  } else if (counts.expense === 0) {
    items.push({
      key: "cost_classification",
      title: "Cost classification",
      status: "unknown",
      detail:
        "The account list for this file has not been read yet, so untagged accounts cannot be counted.",
      anchor: "cost-classification",
    });
  } else {
    const untagged = Math.max(0, counts.expense - counts.classified);
    items.push({
      key: "cost_classification",
      title: "Cost classification",
      status: untagged > 0 ? "needs_attention" : "done",
      detail:
        untagged > 0
          ? `${untagged} of ${counts.expense} expense accounts are still untagged, so break-even and the cash-flow scenario are working from an incomplete split.`
          : `All ${counts.expense} expense accounts are tagged.`,
      anchor: "cost-classification",
    });
  }

  // 5. GST, PAYG and super account coding. What is required follows the cycles,
  // so a client that is not registered is never asked for coding it cannot have.
  const statutoryAck = ackedAt(ack, "statutory_accounts");
  const needsGst = client.gst_cycle != null && client.gst_cycle !== "not_registered";
  const needsPayroll =
    client.payg_withholding_cycle != null && client.payg_withholding_cycle !== "not_registered";
  const required: string[] = [];
  if (needsGst) required.push("gst");
  if (needsPayroll) required.push("payg", "super");
  const missing = required.filter((c) => !storedCategories.has(c));
  const labels: Record<string, string> = { gst: "GST", payg: "PAYG withholding", super: "super" };

  if (gstUnset || paygUnset) {
    items.push({
      key: "statutory_accounts",
      title: "GST, PAYG and super coding",
      status: "unknown",
      detail: "Set the lodgement cycles first — they decide which coding this client needs.",
      anchor: "lodgement-cycles",
    });
  } else if (required.length === 0) {
    items.push({
      key: "statutory_accounts",
      title: "GST, PAYG and super coding",
      status: "not_applicable",
      detail:
        "Not registered for GST and does not withhold PAYG, so there is no statutory coding to set.",
      anchor: "statutory-accounts",
    });
  } else if (statutoryAck) {
    items.push({
      key: "statutory_accounts",
      title: "GST, PAYG and super coding",
      status: "done",
      detail: `Confirmed ${formatDate(statutoryAck)} — name matching on the Xero file is being relied on.`,
      anchor: "statutory-accounts",
    });
  } else if (missing.length > 0) {
    items.push({
      key: "statutory_accounts",
      title: "GST, PAYG and super coding",
      status: "needs_attention",
      detail: `No account is coded for ${missing.map((m) => labels[m]).join(", ")}, so those balances rely on account names matching.`,
      anchor: "statutory-accounts",
      acknowledge: {
        label: "Name matching is fine for this client",
        choice: "name_matching_accepted",
        note: "Records that nothing needs coding by hand on this file. It can be changed later.",
      },
    });
  } else {
    items.push({
      key: "statutory_accounts",
      title: "GST, PAYG and super coding",
      status: "done",
      detail: `Accounts coded for ${required.map((m) => labels[m]).join(", ")}.`,
      anchor: "statutory-accounts",
    });
  }

  const outstanding = items.filter((i) => i.status === "needs_attention");
  return {
    clientId: client.id,
    items,
    outstanding: outstanding.length,
    outstandingTitles: outstanding.map((i) => i.title),
  };
}
