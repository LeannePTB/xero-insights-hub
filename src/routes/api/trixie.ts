import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, stepCountIs, streamText, type UIMessage } from "ai";
import { resolveTrixieContext } from "@/lib/trixie/trixie-context.server";
import { buildTrixieTools, readKnowledge, trixieInstructions } from "@/lib/trixie/trixie-tools.server";
import { createTrixieRunIdFetch, incomingTrixieRunId, withTrixieRunId } from "@/lib/trixie/trixie-run-id.server";
import { estimateTrixieCostUsd, maxOutputTokensForGuard } from "@/lib/trixie/trixie-cost";
import { trixieGuide } from "@/lib/trixie/trixie-guide";
import { pageMapText, trixiePageMap } from "@/lib/trixie/trixie-pagemap";

type Payload = { messages?: UIMessage[]; pathname?: string };

export const TRIXIE_EMPTY_REPLY =
  "Sorry, I couldn't put an answer together for that one. Could you try asking it a slightly different way, or a bit more specifically?";

function errorResponse(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  const raw = error instanceof Error ? error.message : "";
  // Only known, user-safe messages are passed through; everything else is generic.
  const message = /TRIXIE_LIMIT_REACHED|allowance has been used/.test(raw)
    ? "Your organisation has used this month’s Trixie questions."
    : /switched off/.test(raw)
      ? "Trixie is currently switched off."
      : /MFA_REQUIRED|SESSION_IDLE|two-factor|Sign in/.test(raw)
        ? "Please confirm your sign-in again to use Trixie."
        : status === 503 ? "Trixie is not available right now." : "Trixie could not answer that question.";
  const code = /TRIXIE_LIMIT_REACHED|allowance has been used/.test(raw) ? 429 : /MFA_REQUIRED|SESSION_IDLE|Forbidden/.test(raw) ? 403 : status;
  return Response.json({ error: message }, { status: Number.isFinite(code) && code >= 400 ? code : 500 });
}

function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== "user") continue;
    return m.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").slice(0, 1000);
  }
  return "";
}

export const Route = createFileRoute("/api/trixie")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let ctx: Awaited<ReturnType<typeof resolveTrixieContext>> | null = null;
        try {
          const body = await request.json() as Payload;
          if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 60) return Response.json({ error: "The conversation is not valid." }, { status: 400 });
          // Only real conversation turns reach the model; the greeting is UI-only.
          const messages = body.messages.filter((m) => m && (m.role === "user" || m.role === "assistant"));
          ctx = await resolveTrixieContext(request, body.pathname);
          const apiKey = process.env["LOVABLE_API_KEY"];
          if (!apiKey) throw Object.assign(new Error("Trixie’s AI connection is not configured."), { status: 503 });
          const runIdFetch = createTrixieRunIdFetch(incomingTrixieRunId(request));
          const provider = createOpenAI({
            baseURL: "https://ai.gateway.lovable.dev/v1",
            apiKey,
            headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
            fetch: runIdFetch.fetch,
          });
          const c = ctx;
          const finalise = async (status: "completed" | "failed" | "denied" | "cancelled", usage?: { inputTokens?: number; outputTokens?: number; reasoningTokens?: number }, code?: string) => {
            await (c.supabase as any).rpc("finalise_trixie_usage", {
              _reservation_id: c.reservationId,
              _status: status,
              _gateway_run_id: runIdFetch.getRunId() ?? null,
              _input_tokens: usage?.inputTokens ?? null,
              _output_tokens: usage?.outputTokens ?? null,
              _reasoning_tokens: usage?.reasoningTokens ?? null,
              _estimated_cost_usd: usage ? estimateTrixieCostUsd(c.model, usage) : null,
              _error_code: code ?? null,
            });
          };
          // Pre-load the product guide, the caller's page map and the best
          // matching help articles every turn (audience-filtered in the database).
          const question = lastUserText(messages);
          const knowledge = question ? await readKnowledge(c, question, 3).catch(() => ({ articles: [], sources: [] })) : { articles: [], sources: [] };
          const instructions = trixieInstructions(c, {
            guide: trixieGuide(c.audience),
            pages: pageMapText(trixiePageMap({ mode: c.mode, audience: c.audience, firmId: c.firmId, clientId: c.clientId })),
            articles: knowledge.articles,
          });
          // Per-question cost guard, set in System Admin → Trixie.
          const { data: guard } = await (c.supabase as any).rpc("trixie_cost_guard");
          const result = streamText({
            model: provider.responses(c.model),
            instructions,
            messages: await convertToModelMessages(messages),
            tools: buildTrixieTools(c),
            stopWhen: stepCountIs(6),
            abortSignal: request.signal,
            maxRetries: 1,
            maxOutputTokens: maxOutputTokensForGuard(c.model, guard == null ? null : Number(guard)),
            providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
            onFinish: async ({ totalUsage }) => finalise("completed", { inputTokens: totalUsage.inputTokens, outputTokens: totalUsage.outputTokens, reasoningTokens: totalUsage.outputTokenDetails?.reasoningTokens }),
            onAbort: async () => finalise("cancelled", undefined, "cancelled"),
            onError: async ({ error }) => {
              const text = error instanceof Error ? error.message : String(error);
              await finalise(/403|denied|refusal/i.test(text) ? "denied" : "failed", undefined, /402/.test(text) ? "credits" : "gateway_error");
            },
          });
          const stream = createUIMessageStream({
            originalMessages: messages,
            execute: async ({ writer }) => {
              // Sequential copy so the fallback lands before the finish event.
              for await (const chunk of result.toUIMessageStream({ sendReasoning: false, sendFinish: false })) writer.write(chunk);
              const text = (await result.text).trim();
              if (!text) {
                const id = "trixie-fallback";
                writer.write({ type: "text-start", id });
                writer.write({ type: "text-delta", id, delta: TRIXIE_EMPTY_REPLY });
                writer.write({ type: "text-end", id });
              }
              writer.write({ type: "finish" });
            },
            onError: () => "Trixie could not answer that question.",
          });
          return await withTrixieRunId(createUIMessageStreamResponse({ stream }), runIdFetch);
        } catch (error) {
          if (ctx) await (ctx.supabase as any).rpc("finalise_trixie_usage", { _reservation_id: ctx.reservationId, _status: "failed", _error_code: "request_error" });
          return errorResponse(error);
        }
      },
    },
  },
});
