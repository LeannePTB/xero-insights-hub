import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";

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
 *   public.set_org_purchase(...)        super admin only, audited
 *   public.client_available_cards(c)    what the purchase allows
 *   public.client_visible_cards(c)      purchase ∩ ticked
 *   public.set_client_card_enabled(...)  write access to that client, audited
 *   public.copy_client_cards(from, to[]) same organisation only, audited
 */

export type CardGroup = { group: string; cards: string[] };

export type OrgPurchase = {
  firmId: string;
  clientLimit: number;
  advisory: boolean;
  consolidation: boolean;
  billingMode: "bookkeeping" | "external";
  clientCount: number;
};

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
    const purchase: OrgPurchase = {
      firmId: r.firm_id as string,
      clientLimit: Number(r.client_limit ?? 0),
      advisory: !!r.advisory_enabled,
      consolidation: !!r.consolidation_enabled,
      billingMode: (r.billing_mode === "external" ? "external" : "bookkeeping") as
        | "bookkeeping"
        | "external",
      clientCount: Number(r.client_count ?? 0),
    };
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
      _billing_mode: data.billingMode,
    });
    if (error) {
      if (/CONSOLIDATION_REQUIRES_ADVISORY/.test(error.message)) {
        throw new Error("Consolidation can only be on when Advisory is on.");
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

    return {
      modelActive: true as const,
      available: (available ?? []) as string[],
      visible: (visible ?? []) as string[],
      ticked: ((stored as any)?.cards ?? null) as string[] | null,
      groups: await readGroups(db),
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
