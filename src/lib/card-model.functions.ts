import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";
import { mapCatalogue, offeredCatalogue, withEarlyAccess, type CardCatalogue } from "@/lib/cards/catalogue";

/**
 * Admin reads and writes for the purchase + ticked-list card model (v2).
 *
 * Invariant 6: every rule lives in the database. Nothing here decides what a
 * client can see, what an organisation has bought, or who may change it — each
 * handler forwards to a guarded database function which re-checks aal2 and the
 * caller's authorisation itself:
 *   public.card_model_active()          is the new model live?
 *   public.card_group_list()            Standard / Advisory / Consolidation
 *   public.org_purchase(firm)           one organisation's purchase options
 *   public.set_org_purchase(...)        System Administrator only, audited
 *   public.client_available_cards(c)    what the purchase allows
 *   public.client_visible_cards(c)      purchase ∩ ticked
 *   public.set_client_card_enabled(...)  Organisation Owner or System Administrator, audited
 *   public.set_client_module(...)        same gate; ticks a module's cards, audited
 *   public.copy_client_cards(from, to[]) same gate, same organisation only, audited
 */

export type CardGroup = { group: string; cards: string[] };

export type OrgPurchase = {
  firmId: string;
  clientLimit: number;
  /** What the organisation has purchased. Never merged with a trial. */
  advisory: boolean;
  consolidation: boolean;
  /** Report branding: the per-client logo. Extends Advisory, charged separately. */
  branding: boolean;
  /** Organisation identity in its app, emails and report chrome. Independent option. */
  whiteLabel: boolean;
  billingMode: "bookkeeping" | "external";
  clientCount: number;
  /** Trial grants, stored separately so an expiry reverts to the purchase. */
  trialAdvisory: boolean;
  trialConsolidation: boolean;
  trialBranding: boolean;
  trialWhiteLabel: boolean;
  trialEndsAt: string | null;
  trialActive: boolean;
  /** Purchased OR unexpired trial — what the database actually allows today. */
  effectiveAdvisory: boolean;
  effectiveConsolidation: boolean;
  effectiveBranding: boolean;
  effectiveWhiteLabel: boolean;
};

/** Maps one `public.org_purchase` row. The database decides every value here. */
function mapPurchase(r: any): OrgPurchase {
  return {
    firmId: r.firm_id as string,
    clientLimit: Number(r.client_limit ?? 0),
    advisory: !!r.advisory_enabled,
    consolidation: !!r.consolidation_enabled,
    branding: !!r.branding_enabled,
    whiteLabel: !!r.white_label_enabled,
    billingMode: (r.billing_mode === "external" ? "external" : "bookkeeping") as
      | "bookkeeping"
      | "external",
    clientCount: Number(r.client_count ?? 0),
    trialAdvisory: !!r.trial_advisory_enabled,
    trialConsolidation: !!r.trial_consolidation_enabled,
    trialBranding: !!r.trial_branding_enabled,
    trialWhiteLabel: !!r.trial_white_label_enabled,
    trialEndsAt: (r.trial_ends_at as string | null) ?? null,
    trialActive: !!r.trial_active,
    effectiveAdvisory: !!r.effective_advisory,
    effectiveConsolidation: !!r.effective_consolidation,
    effectiveBranding: !!r.effective_branding,
    effectiveWhiteLabel: !!r.effective_white_label,
  };
}

function rpcError(message: string): Error {
  // Generic, caller-safe messages; the database keys are kept for the UI to
  // recognise the few cases it can explain properly.
  return new Error(message);
}

async function readGroups(supabase: any): Promise<CardGroup[]> {
  const { data, error } = await supabase.rpc("card_group_list");
  if (error) throw rpcError(error.message);
  return ((data ?? []) as any[]).map((r) => ({
    group: r.card_group as string,
    cards: (r.cards ?? []) as string[],
  }));
}

/**
 * The three card groups and the cards each contains, straight from the
 * database catalogue. Used by the create-organisation dialog, which has no
 * organisation to read yet. Presentation data only: no organisation, client or
 * Xero data, and it grants nothing.
 */
export const listCardGroups = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .handler(async ({ context }) => ({ groups: await readGroups(context.supabase as any) }));

/** Is the new card model live? Fails closed. */
export const getCardModel = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).rpc("card_model_active");
    return { active: !error && data === "v2" };
  });

export const getOrgPurchase = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string }) => {
    if (!i?.firmId) throw new Error("firmId is required");
    return { firmId: i.firmId };
  })
  .handler(async ({ data, context }) => {
    const db: any = context.supabase;
    const { data: rows, error } = await db.rpc("org_purchase", { _firm_id: data.firmId });
    if (error) throw rpcError(error.message);
    const r = (rows ?? [])[0];
    if (!r) throw rpcError("Organisation not found");
    const purchase: OrgPurchase = mapPurchase(r);
    const { data: model } = await db.rpc("card_model_active");
    return { purchase, groups: await readGroups(db), modelActive: model === "v2" };
  });

export const saveOrgPurchase = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator(
    (i: {
      firmId: string;
      clientLimit: number;
      advisory: boolean;
      consolidation: boolean;
      branding: boolean;
      whiteLabel: boolean;
      billingMode: "bookkeeping" | "external";
    }) => {
      if (!i?.firmId) throw new Error("firmId is required");
      const limit = Math.floor(Number(i.clientLimit));
      if (!Number.isFinite(limit) || limit < 0 || limit > 9999) {
        throw new Error("Client number must be between 0 and 9999.");
      }
      if (i.billingMode !== "bookkeeping" && i.billingMode !== "external") {
        throw new Error("Billing must be bookkeeping fees or external.");
      }
      return {
        firmId: i.firmId,
        clientLimit: limit,
        advisory: !!i.advisory,
        consolidation: !!i.consolidation,
        branding: !!i.branding,
        whiteLabel: !!i.whiteLabel,
        billingMode: i.billingMode,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("set_org_purchase", {
      _firm_id: data.firmId,
      _client_limit: data.clientLimit,
      _advisory: data.advisory,
      _consolidation: data.consolidation,
      _branding: data.branding,
      _white_label: data.whiteLabel,
      _billing_mode: data.billingMode,
    });
    if (error) {
      if (/CONSOLIDATION_REQUIRES_ADVISORY/.test(error.message)) {
        throw new Error("Consolidation can only be on when Advisory is on.");
      }
      if (/BRANDING_REQUIRES_ADVISORY/.test(error.message)) {
        throw new Error("Branding can only be on when Advisory is on.");
      }
      if (/Forbidden/i.test(error.message)) throw new Error("Forbidden");
      throw rpcError(error.message);
    }
    return { ok: true };
  });

/** One client's card setup: what the purchase allows, and what is ticked. */
export const getClientCardSetup = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string }) => {
    if (!i?.clientId) throw new Error("clientId is required");
    return { clientId: i.clientId };
  })
  .handler(async ({ data, context }) => {
    const db: any = context.supabase;
    const { data: model } = await db.rpc("card_model_active");
    if (model !== "v2") return { modelActive: false as const };

    const [{ data: available, error: aErr }, { data: visible, error: vErr }] = await Promise.all([
      db.rpc("client_available_cards", { _client_id: data.clientId }),
      db.rpc("client_visible_cards", { _client_id: data.clientId }),
    ]);
    if (aErr) throw rpcError(aErr.message);
    if (vErr) throw rpcError(vErr.message);

    // The stored list may hold ticks for cards the purchase does not currently
    // allow — that is deliberate, so an arrangement survives Advisory being
    // switched off and on again.
    const { data: stored } = await db
      .from("client_cards")
      .select("cards")
      .eq("client_id", data.clientId)
      .maybeSingle();

    const { data: client } = await db.from("clients").select("firm_id").eq("id", data.clientId).maybeSingle();
    const firmId = ((client as any)?.firm_id ?? null) as string | null;
    const [base, canManage, early] = await Promise.all([
      readCatalogue(db, true),
      canManageCards(db, firmId),
      db.rpc("client_early_access_cards", { _client_id: data.clientId }),
    ]);
    // Early access: Work-in-progress cards this organisation may try become
    // tickable here. The database decides; this only shows them.
    const earlyRows = early.error ? [] : (early.data ?? []);
    const catalogue = withEarlyAccess(offeredCatalogue(base), earlyRows);
    const earlyKeys = (earlyRows as any[]).map((r) => r.card_key as string);

    return {
      modelActive: true as const,
      available: [...new Set([...((available ?? []) as string[]), ...earlyKeys])],
      visible: (visible ?? []) as string[],
      ticked: ((stored as any)?.cards ?? null) as string[] | null,
      groups: await readGroups(db),
      catalogue,
      canManage,
    };
  });

export const setClientCardTick = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string; card: string; enabled: boolean }) => {
    if (!i?.clientId) throw new Error("clientId is required");
    if (!i?.card) throw new Error("card is required");
    return { clientId: i.clientId, card: i.card, enabled: !!i.enabled };
  })
  .handler(async ({ data, context }) => {
    const { data: visible, error } = await (context.supabase as any).rpc(
      "set_client_card_enabled",
      { _client_id: data.clientId, _card: data.card, _enabled: data.enabled },
    );
    if (error) {
      if (/CARD_NOT_AVAILABLE/.test(error.message)) {
        throw new Error("This card is not part of what the organisation has bought.");
      }
      if (/NO_ACCESS/.test(error.message)) throw new Error("Forbidden");
      throw rpcError(error.message);
    }
    return { visible: (visible ?? []) as string[] };
  });

export const copyClientCardSetup = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { fromClientId: string; toClientIds: string[] }) => {
    if (!i?.fromClientId) throw new Error("fromClientId is required");
    const to = Array.from(new Set((i.toClientIds ?? []).filter(Boolean)));
    if (to.length === 0) throw new Error("Choose at least one client to copy to.");
    if (to.length > 200) throw new Error("Too many clients in one copy.");
    return { fromClientId: i.fromClientId, toClientIds: to };
  })
  .handler(async ({ data, context }) => {
    const { data: n, error } = await (context.supabase as any).rpc("copy_client_cards", {
      _from_client_id: data.fromClientId,
      _to_client_ids: data.toClientIds,
    });
    if (error) {
      if (/DIFFERENT_ORGANISATION/.test(error.message)) {
        throw new Error("Cards can only be copied within the same organisation.");
      }
      if (/NO_ACCESS/.test(error.message)) throw new Error("Forbidden");
      throw rpcError(error.message);
    }
    return { copied: Number(n ?? 0) };
  });

/**
 * Purchase options for several organisations at once, for the Organisations
 * table. One guarded database call per organisation — each re-checks aal2 and
 * the caller's own path to that organisation, so this cannot widen anything.
 * An organisation the caller cannot read is simply absent from the result.
 */
export const listOrgPurchases = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { firmIds: string[] }) => ({
    firmIds: Array.from(
      new Set((i?.firmIds ?? []).filter((id) => typeof id === "string" && id)),
    ).slice(0, 200),
  }))
  .handler(async ({ data, context }) => {
    const db: any = context.supabase;
    const results = await Promise.all(
      data.firmIds.map(async (firmId) => {
        const { data: rows, error } = await db.rpc("org_purchase", { _firm_id: firmId });
        if (error) return null;
        const r = (rows ?? [])[0];
        if (!r) return null;
        return mapPurchase(r);
      }),
    );
    const { data: model } = await db.rpc("card_model_active");
    return {
      purchases: results.filter((p): p is OrgPurchase => !!p),
      modelActive: model === "v2",
    };
  });

/**
 * Start, extend or end an organisation trial. Commercial change: the database
 * function re-checks aal2 and System Administrator, insists on a reason, refuses
 * Consolidation without Advisory, caps the trial at 120 days, and audits every
 * accepted change. When a selected option is already purchased, the database
 * atomically moves it to trialled; it never touches any client's ticked cards.
 */
export const saveOrgTrial = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator(
    (i: {
      firmId: string;
      advisory: boolean;
      consolidation: boolean;
      branding: boolean;
      whiteLabel: boolean;
      endsAt: string | null;
      reason: string;
    }) => {
      if (!i?.firmId) throw new Error("firmId is required");
      const reason = (i.reason ?? "").trim();
      if (reason.length < 3) throw new Error("Please give a reason for this trial change.");
      const advisory = !!i.advisory;
      const consolidation = !!i.consolidation;
      const branding = !!i.branding;
      const whiteLabel = !!i.whiteLabel;
      if (consolidation && !advisory) {
        throw new Error("A Consolidation trial needs Advisory as well.");
      }
      if (branding && !advisory) {
        throw new Error("A Branding trial needs Advisory as well.");
      }
      const ending = !advisory && !consolidation && !branding && !whiteLabel;
      let endsAt: string | null = null;
      if (!ending) {
        if (!i.endsAt) throw new Error("Choose the date the trial ends.");
        const when = new Date(i.endsAt);
        if (Number.isNaN(when.getTime())) throw new Error("That end date is not valid.");
        endsAt = when.toISOString();
      }
      return { firmId: i.firmId, advisory, consolidation, branding, whiteLabel, endsAt, reason };
    },
  )
  .handler(async ({ data, context }) => {
    const { data: ends, error } = await (context.supabase as any).rpc("set_org_trial", {
      _firm_id: data.firmId,
      _advisory: data.advisory,
      _consolidation: data.consolidation,
      _branding: data.branding,
      _white_label: data.whiteLabel,
      _ends_at: data.endsAt,
      _reason: data.reason,
    });
    if (error) {
      if (/CONSOLIDATION_REQUIRES_ADVISORY/.test(error.message)) {
        throw new Error("A Consolidation trial needs Advisory as well.");
      }
      if (/BRANDING_REQUIRES_ADVISORY/.test(error.message)) {
        throw new Error("A Branding trial needs Advisory as well.");
      }
      if (/TRIAL_END_MUST_BE_FUTURE/.test(error.message)) {
        throw new Error("The trial end date must be in the future.");
      }
      if (/TRIAL_TOO_LONG/.test(error.message)) {
        throw new Error("A trial can run for at most 120 days.");
      }
      if (/NO_SUCH_ORGANISATION/.test(error.message)) throw new Error("Organisation not found");
      if (/Forbidden|NO_ACCESS|insufficient/i.test(error.message)) throw new Error("Forbidden");
      throw rpcError(error.message);
    }
    return { trialEndsAt: (ends as string | null) ?? null };
  });

/**
 * Organisation card defaults — the TEMPLATE new clients start from.
 *
 * This is not a resolution layer. Nothing here is read when a dashboard is
 * resolved: `app_private.client_cards_v2` is still the purchase intersected
 * with the one ticked list stored for that client. The template is copied into
 * that list once, by a database trigger, in the same transaction that creates
 * the client.
 *
 *   public.org_card_defaults(firm)        read the template
 *   public.set_org_card_defaults(...)     Organisation Owner or System Administrator, audited
 *   public.apply_org_card_defaults(firm)  overwrites every client, audited
 */
export const getOrgCardDefaults = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string }) => {
    if (!i?.firmId) throw new Error("firmId is required");
    return { firmId: i.firmId };
  })
  .handler(async ({ data, context }) => {
    const db: any = context.supabase;
    const { data: rows, error } = await db.rpc("org_card_defaults", { _firm_id: data.firmId });
    if (error) {
      if (/NO_ACCESS/.test(error.message)) throw new Error("Forbidden");
      throw rpcError(error.message);
    }
    const r = (rows ?? [])[0];
    return {
      cards: (r?.cards ?? []) as string[],
      configured: !!r?.configured,
    };
  });

export const saveOrgCardDefaults = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string; cards: string[] }) => {
    if (!i?.firmId) throw new Error("firmId is required");
    const cards = Array.from(new Set((i.cards ?? []).filter((c) => typeof c === "string" && c)));
    if (cards.length > 100) throw new Error("Too many cards in one default.");
    return { firmId: i.firmId, cards };
  })
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await (context.supabase as any).rpc("set_org_card_defaults", {
      _firm_id: data.firmId,
      _cards: data.cards,
    });
    if (error) {
      if (/NO_ACCESS|Forbidden|insufficient/i.test(error.message)) throw new Error("Forbidden");
      if (/NO_SUCH_ORGANISATION/.test(error.message)) throw new Error("Organisation not found");
      throw rpcError(error.message);
    }
    return { cards: (saved ?? []) as string[] };
  });

export const applyOrgCardDefaults = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { firmId: string }) => {
    if (!i?.firmId) throw new Error("firmId is required");
    return { firmId: i.firmId };
  })
  .handler(async ({ data, context }) => {
    const { data: n, error } = await (context.supabase as any).rpc("apply_org_card_defaults", {
      _firm_id: data.firmId,
    });
    if (error) {
      if (/NO_DEFAULT_SET/.test(error.message)) {
        throw new Error("Save the default card set first.");
      }
      if (/NO_ACCESS|Forbidden|insufficient/i.test(error.message)) throw new Error("Forbidden");
      throw rpcError(error.message);
    }
    return { clientsChanged: Number(n ?? 0) };
  });

// ---------------------------------------------------------------------------
// Packages & modules — the card catalogue as data (public.card_catalogue,
// public.card_modules). Reads are product copy for signed-in aal2 users; writes
// go through System-Administrator-only, audited database functions. Module
// ticks are a grouping over the same client_cards list (client_cards_v2).
// ---------------------------------------------------------------------------

async function readCatalogue(db: any, includeWip = false): Promise<CardCatalogue> {
  const [m, c] = await Promise.all([
    db.from("card_modules").select("module_key, label, description, sort_order").order("sort_order"),
    db.from("card_catalogue").select("card_key, package, module_key, label, description, sort_order, report_sections, status").order("sort_order"),
  ]);
  if (m.error || c.error) throw rpcError("The card catalogue is unavailable.");
  // RLS returns Work-in-progress rows to System Administrators only; offer
  // surfaces drop them regardless so they never appear as tickable.
  const all = mapCatalogue(m.data, c.data);
  return includeWip ? all : offeredCatalogue(all);
}

async function canManageCards(db: any, firmId: string | null): Promise<boolean> {
  const { data, error } = await db.rpc("me_can_manage_cards", { _firm_id: firmId });
  return !error && data === true;
}

export const getCardCatalogue = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ includeWip: z.boolean().optional() }).strict().optional().parse(i))
  .handler(async ({ data, context }) => ({ catalogue: await readCatalogue(context.supabase as any, data?.includeWip === true) }));

/**
 * Catalogue for one client's dashboard: offered cards, WIP rows RLS returns to
 * System Administrators, plus this client's early-access cards (caller-scoped
 * in the database: practice members of the organisation only).
 */
export const getClientCatalogue = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ clientId: z.string().uuid() }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const [base, early] = await Promise.all([
      readCatalogue(db, true),
      db.rpc("client_early_access_cards", { _client_id: data.clientId }),
    ]);
    return { catalogue: withEarlyAccess(base, early.error ? [] : early.data ?? []) };
  });

export type OrgEarlyAccessRow = {
  cardKey: string;
  label: string;
  moduleLabel: string | null;
  granted: boolean;
  active: boolean;
  endsAt: string | null;
  grantedAt: string | null;
};

/** System Administrator: every Work-in-progress card and this organisation's early access. */
export const getOrgEarlyAccess = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ firmId: z.string().uuid() }).strict().parse(i))
  .handler(async ({ data, context }): Promise<{ rows: OrgEarlyAccessRow[] }> => {
    const { data: rows, error } = await (context.supabase as any).rpc("admin_org_early_access", { _firm_id: data.firmId });
    if (error) throw new Error("Early access could not be loaded.");
    return {
      rows: ((rows ?? []) as any[]).map((r) => ({
        cardKey: r.card_key,
        label: r.label,
        moduleLabel: r.module_label ?? null,
        granted: !!r.granted,
        active: !!r.active,
        endsAt: r.ends_at ?? null,
        grantedAt: r.granted_at ?? null,
      })),
    };
  });

export const saveOrgEarlyAccess = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) =>
    z.object({
      firmId: z.string().uuid(),
      cardKey: z.string().regex(/^[a-z][a-z_]{1,39}$/),
      enabled: z.boolean(),
      endsAt: z.string().datetime({ offset: true }).nullable(),
    }).strict().parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("admin_set_org_early_access", {
      _firm_id: data.firmId,
      _card_key: data.cardKey,
      _enabled: data.enabled,
      _ends_at: data.endsAt,
    });
    if (error) {
      if (/END_DATE_IN_PAST/.test(error.message)) throw new Error("The end date must be in the future.");
      if (/NOT_WORK_IN_PROGRESS/.test(error.message)) throw new Error("That card is not work in progress.");
      if (/Forbidden|NO_ACCESS|insufficient|super/i.test(error.message)) throw new Error("Forbidden");
      throw new Error("Early access could not be saved.");
    }
    return { ok: true };
  });

export const saveCardStatus = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ cardKey: z.string().regex(/^[a-z][a-z_]{1,39}$/), status: z.enum(["available", "wip"]) }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("admin_set_card_status", { _card_key: data.cardKey, _status: data.status });
    if (error) {
      if (/Forbidden|NO_ACCESS|insufficient|super/i.test(error.message)) throw new Error("Forbidden");
      throw new Error("The status could not be saved.");
    }
    return { ok: true };
  });

const cardEntrySchema = z.object({
  cardKey: z.string().regex(/^[a-z][a-z_]{1,39}$/),
  package: z.enum(["standard", "advisory", "consolidation"]),
  moduleKey: z.string().regex(/^[a-z][a-z_]{1,39}$/).nullable(),
  description: z.string().trim().max(300),
});

export const saveCardEntry = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => cardEntrySchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("admin_set_card_entry", {
      _card_key: data.cardKey,
      _package: data.package,
      _module_key: data.package === "advisory" ? data.moduleKey : null,
      _description: data.description,
    });
    if (error) {
      if (/MODULE_REQUIRED/.test(error.message)) throw new Error("Choose a module for an Advisory card.");
      if (/Forbidden|NO_ACCESS|insufficient/i.test(error.message)) throw new Error("Forbidden");
      throw new Error("The card could not be saved.");
    }
    return { ok: true };
  });

const moduleSchema = z.object({
  moduleKey: z.string().regex(/^[a-z][a-z_]{1,39}$/),
  label: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300),
});

export const saveCardModule = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => moduleSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("admin_set_card_module", {
      _module_key: data.moduleKey,
      _label: data.label,
      _description: data.description,
    });
    if (error) {
      if (/Forbidden|NO_ACCESS|insufficient/i.test(error.message)) throw new Error("Forbidden");
      throw new Error("The module could not be saved.");
    }
    return { ok: true };
  });

export const setClientModuleTick = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) =>
    z.object({ clientId: z.string().uuid(), moduleKey: z.string().regex(/^[a-z][a-z_]{1,39}$/), enabled: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: visible, error } = await (context.supabase as any).rpc("set_client_module", {
      _client_id: data.clientId,
      _module_key: data.moduleKey,
      _enabled: data.enabled,
    });
    if (error) {
      if (/CARD_NOT_AVAILABLE/.test(error.message)) throw new Error("This module is not part of what the organisation has bought.");
      if (/NO_ACCESS|insufficient/i.test(error.message)) throw new Error("Only the Organisation Owner can change this client's package.");
      throw new Error("The module could not be changed.");
    }
    return { visible: (visible ?? []) as string[] };
  });

/** Catalogue plus whether the caller may change cards for this organisation. */
export const getOrgCardContext = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ firmId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db: any = context.supabase;
    const [catalogue, canManage] = await Promise.all([readCatalogue(db), canManageCards(db, data.firmId)]);
    return { catalogue, canManage };
  });

const VisibleCardsInput = z.object({ clientId: z.string().uuid() }).strict();

/**
 * The client's visible cards for menu filtering — the one rule
 * (public.client_visible_cards: aal2, caller must read the client,
 * purchase ∩ ticked). Fails closed to an empty list. Presentation only: every
 * page's own server reader re-checks the same rule.
 */
export const getMyClientVisibleCards = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => VisibleCardsInput.parse(i))
  .handler(async ({ data, context }): Promise<{ cards: string[] }> => {
    const { data: cards, error } = await (context.supabase as any).rpc("client_visible_cards", {
      _client_id: data.clientId,
    });
    if (error || !Array.isArray(cards)) return { cards: [] };
    return { cards: (cards as unknown[]).filter((c): c is string => typeof c === "string") };
  });

const LoansAccessInput = z
  .object({ clientId: z.string().uuid().optional(), firmId: z.string().uuid().optional() })
  .strict();

/**
 * Menu signal for Loans (client) and Consolidations (organisation). Mirrors
 * public.me_can_open_client_loans / me_can_open_consolidations — the same
 * rules every Loans/Consolidation server reader enforces. Fails closed.
 */
export const getMyLoansAccess = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => LoansAccessInput.parse(i))
  .handler(async ({ data, context }): Promise<{ clientLoans: boolean; consolidations: boolean }> => {
    const db = context.supabase as any;
    const [c, f] = await Promise.all([
      data.clientId ? db.rpc("me_can_open_client_loans", { _client_id: data.clientId }) : { data: false },
      data.firmId ? db.rpc("me_can_open_consolidations", { _firm_id: data.firmId }) : { data: false },
    ]);
    return { clientLoans: !c.error && c.data === true, consolidations: !f.error && f.data === true };
  });

/**
 * Practice-only upsell signal: catalogue module keys this client lacks.
 * public.client_locked_modules returns [] unless the caller may manage cards
 * for the client's organisation and can read the client. Never a grant.
 */
export const getMyLockedModules = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ clientId: z.string().uuid() }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { data: keys, error } = await (context.supabase as any).rpc("client_locked_modules", { _client_id: data.clientId });
    if (error) return { modules: [] as string[] };
    return { modules: ((keys ?? []) as string[]).filter((k) => /^[a-z_]+$/.test(k)) };
  });
