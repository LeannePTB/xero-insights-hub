import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

// Every read runs as the caller under RLS: a thread is returned only to its
// owner, and only while they can still read its client or organisation.

export type TrixieThreadSummary = { id: string; title: string; workspace: string; clientName: string | null; updatedAt: string };
export type TrixieStoredMessage = { id: string; role: "user" | "assistant"; content: string; sources: Array<{ label: string; asAt: string | null; href?: string }> };

const idInput = z.object({ id: z.string().uuid() });

export const listMyTrixieThreads = createServerFn({ method: "GET" }).middleware([requireAal2]).handler(async ({ context }) => {
  const { data, error } = await (context.supabase as any)
    .from("trixie_threads")
    .select("id, title, workspace, updated_at, clients(name)")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Your chats could not be loaded.");
  return (data ?? []).map((t: any): TrixieThreadSummary => ({
    id: t.id,
    title: t.title,
    workspace: t.workspace,
    clientName: t.clients?.name ?? null,
    updatedAt: t.updated_at,
  }));
});

export const getMyTrixieThread = createServerFn({ method: "GET" })
  .middleware([requireAal2])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const { data: thread } = await sb.from("trixie_threads").select("id, title").eq("id", data.id).maybeSingle();
    if (!thread) return null;
    const { data: rows, error } = await sb
      .from("trixie_messages")
      .select("id, role, content, sources")
      .eq("thread_id", data.id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) return null;
    return {
      id: thread.id as string,
      title: thread.title as string,
      messages: (rows ?? []).map((m: any): TrixieStoredMessage => ({ id: m.id, role: m.role, content: m.content, sources: Array.isArray(m.sources) ? m.sources : [] })),
    };
  });

export const deleteMyTrixieThread = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await (context.supabase as any).from("trixie_threads").delete().eq("id", data.id);
    if (error) throw new Error("That chat could not be deleted.");
    return { ok: true };
  });

export const deleteAllMyTrixieThreads = createServerFn({ method: "POST" }).middleware([requireAal2]).handler(async ({ context }) => {
  const { data, error } = await (context.supabase as any).rpc("delete_all_my_trixie_threads");
  if (error) throw new Error("Your chats could not be deleted.");
  return { deleted: Number(data ?? 0) };
});
